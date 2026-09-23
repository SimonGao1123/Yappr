import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import { prismaMock } from './setup.js';
import randomChatRouter from '../routes/randomChatRoutes.js';

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use('/randomChats', randomChatRouter);

describe('Random Chat Routes', () => {
  // ==================== JOIN QUEUE ====================
  describe('POST /randomChats/joinQueue', () => {
    it('should successfully join the queue', async () => {
      prismaMock.randomChatPool.create.mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/randomChats/joinQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('successfully joined queue');
    });

    it('should return 500 on database error', async () => {
      prismaMock.randomChatPool.create.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/randomChats/joinQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== GET RANDOM CHAT ====================
  describe('GET /randomChats/getRandomChat/:user_id', () => {
    it('should return not in queue when user is not in RandomChatPool', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/randomChats/getRandomChat/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Currently Not in Random Chat Queue');
    });

    it('should return waiting status with queue size when available', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce({ available: 1 } as any);
      prismaMock.randomChatPool.count.mockResolvedValueOnce(5);

      const response = await request(app)
        .get('/randomChats/getRandomChat/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Waiting in Queue...');
      expect(response.body.waiting).toBe(true);
      expect(response.body.queueSize).toBe(5);
    });

    it('should return chat data when matched (available=0)', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce({ available: 0 } as any);
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({
        chat_id: 1, user_id_1: 1, user_id_2: 2, created_at: new Date('2026-01-01T00:00:00.000Z')
      } as any);
      prismaMock.users.findUnique
        .mockResolvedValueOnce({ username: 'user1', description: 'desc1', joined_at: new Date('2026-01-01T00:00:00.000Z') } as any)
        .mockResolvedValueOnce({ username: 'user2', description: 'desc2', joined_at: new Date('2026-01-01T00:00:00.000Z') } as any);
      prismaMock.friends.findFirst
        .mockResolvedValueOnce(null)   // friend status for user1
        .mockResolvedValueOnce(null);  // friend status for user2
      prismaMock.messages.findMany.mockResolvedValueOnce([{
        askGemini: 0,
        message_id: 1,
        sender_id: 1,
        message: 'Hello',
        sent_at: new Date('2026-01-01T00:00:00.000Z'),
        user: { username: 'user1' }
      }] as any);

      const response = await request(app)
        .get('/randomChats/getRandomChat/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully Obtained Random Chat');
      expect(response.body.waiting).toBe(false);
      expect(response.body.chatData).toBeDefined();
      expect(response.body.chatData.created_at).toBe('2026-01-01T00:00:00.000Z');
      expect(response.body.chatData.userData).toHaveLength(2);
      expect(response.body.messages).toEqual([{
        askGemini: 0,
        message_id: 1,
        sender_id: 1,
        message: 'Hello',
        username: 'user1',
        sent_at: '2026-01-01T00:00:00.000Z'
      }]);
    });

    it('should return 500 on database error', async () => {
      prismaMock.randomChatPool.findFirst.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/randomChats/getRandomChat/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== SEND MESSAGE RANDOM ====================
  describe('POST /randomChats/sendMsgRandom', () => {
    it('should return 401 when message is missing', async () => {
      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not a valid message');
    });

    it('should return 401 when user is not in a random chat', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('user is not in a random chat');
    });

    it('should return 401 when sending to invalid chat', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 2, user_id_1: 1, user_id_2: 3 } as any);

      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Sent to invalid chat');
    });

    it('should send message successfully, flagged as a random chat message', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 1, user_id_1: 1, user_id_2: 2 } as any);
      prismaMock.messages.create.mockResolvedValueOnce({
        askGemini: 0,
        message_id: 1,
        sender_id: 1,
        message: 'Hello there!',
        sent_at: new Date('2026-01-01T00:00:00.000Z'),
        user: { username: 'user1' }
      } as any);

      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, message: 'Hello there!', user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sent message!');
      expect(prismaMock.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ random_chat: 1 })
        })
      );
    });

    it('should return 500 on database error', async () => {
      prismaMock.randomChats.findFirst.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== LEAVE RANDOM CHAT ====================
  describe('POST /randomChats/leaveRandomChat', () => {
    it('should return 401 when providing same user ids', async () => {
      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('cannot provide 2 of the same users');
    });

    it('should return 401 when user is not in a chat', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 2 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("user currently isn't in a chat");
    });

    it('should return 401 when chat id does not match', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 5 } as any);

      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 2 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid chat error');
    });

    it('should leave random chat successfully and free both users', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 1 } as any);
      prismaMock.messages.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaMock.randomChats.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.allChats.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.randomChatPool.updateMany.mockResolvedValueOnce({ count: 2 });

      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 2 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('successfully left chat');
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.randomChatPool.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { available: 1 } })
      );
    });

    it('should return 500 when the transaction fails', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 1 } as any);
      (prismaMock.$transaction as any).mockRejectedValueOnce(new Error('Transaction Error'));

      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 2 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== LEAVE QUEUE ====================
  describe('POST /randomChats/leaveQueue', () => {
    it('should return 401 when user is not in queue', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("User isn't in queue");
    });

    it('should remove user from pool when available', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce({ available: 1 } as any);
      prismaMock.randomChatPool.deleteMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('user successfully removed from pool');
    });

    it('should delete chat and remove from queue when not available', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce({ available: 0 } as any);
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 1, user_id_1: 1, user_id_2: 2 } as any);
      prismaMock.messages.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaMock.randomChats.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.allChats.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.randomChatPool.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.randomChatPool.deleteMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('user successfully removed from queue');
      // only the *other* user is freed back into the pool
      expect(prismaMock.randomChatPool.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 2 }, data: { available: 1 } })
      );
    });

    it('should return 401 when chat retrieval fails', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce({ available: 0 } as any);
      prismaMock.randomChats.findFirst.mockResolvedValueOnce(null); // no chat found

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Random Chat retreival error');
    });

    it('should return 500 when the transaction fails', async () => {
      prismaMock.randomChatPool.findFirst.mockResolvedValueOnce({ available: 0 } as any);
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 1, user_id_1: 1, user_id_2: 2 } as any);
      (prismaMock.$transaction as any).mockRejectedValueOnce(new Error('Transaction Error'));

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
