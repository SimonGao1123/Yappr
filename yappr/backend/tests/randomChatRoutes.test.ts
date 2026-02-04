import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import { mockConnection } from './setup.js';
import db from '../database.js';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== JOIN QUEUE ====================
  describe('POST /randomChats/joinQueue', () => {
    it('should successfully join the queue', async () => {
      vi.mocked(db.query).mockResolvedValueOnce([{ insertId: 1 }, []] as any);

      const response = await request(app)
        .post('/randomChats/joinQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('successfully joined queue');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.query).mockRejectedValueOnce(new Error('DB Error'));

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .get('/randomChats/getRandomChat/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Currently Not in Random Chat Queue');
    });

    it('should return waiting status with queue size when available', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ available: 1 }], []] as any) // availability check
        .mockResolvedValueOnce([[{ available_count: 5 }], []] as any); // queue size

      const response = await request(app)
        .get('/randomChats/getRandomChat/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Waiting in Queue...');
      expect(response.body.waiting).toBe(true);
      expect(response.body.queueSize).toBe(5);
    });

    it('should return chat data when matched (available=0)', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ available: 0 }], []] as any) // availability check
        .mockResolvedValueOnce([[{ chat_id: 1, user_id_1: 1, user_id_2: 2, created_at: '2026-01-01' }], []] as any) // get chat
        .mockResolvedValueOnce([[{ username: 'user1', description: 'desc1', joined_at: '2026-01-01' }], []] as any) // user1 data
        .mockResolvedValueOnce([[], []] as any) // check friend status for user1
        .mockResolvedValueOnce([[{ username: 'user2', description: 'desc2', joined_at: '2026-01-01' }], []] as any) // user2 data
        .mockResolvedValueOnce([[], []] as any) // check friend status for user2
        .mockResolvedValueOnce([[{ message_id: 1, sender_id: 1, message: 'Hello', username: 'user1', sent_at: '2026-01-01', askGemini: 0 }], []] as any); // messages

      const response = await request(app)
        .get('/randomChats/getRandomChat/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully Obtained Random Chat');
      expect(response.body.waiting).toBe(false);
      expect(response.body.chatData).toBeDefined();
      expect(response.body.messages).toBeDefined();
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('user is not in a random chat');
    });

    it('should return 401 when sending to invalid chat', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ chat_id: 2, user_id_1: 1, user_id_2: 3 }], []] as any);

      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Sent to invalid chat');
    });

    it('should send message successfully', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ chat_id: 1, user_id_1: 1, user_id_2: 2 }], []] as any);
      vi.mocked(db.query).mockResolvedValueOnce([{ insertId: 1 }, []] as any);

      const response = await request(app)
        .post('/randomChats/sendMsgRandom')
        .send({ chat_id: 1, message: 'Hello there!', user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sent message!');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 2 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("user currently isn't in a chat");
    });

    it('should return 401 when chat id does not match', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ chat_id: 5 }], []] as any);

      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 2 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid chat error');
    });

    it('should leave random chat successfully', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ chat_id: 1 }], []] as any);
      mockConnection.execute.mockResolvedValue([{}, []] as any);
      mockConnection.beginTransaction.mockResolvedValue(undefined);
      mockConnection.commit.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/randomChats/leaveRandomChat')
        .send({ chat_id: 1, user_id: 1, other_user_id: 2 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('successfully left chat');
    });

    it('should return 500 on database error and rollback', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ chat_id: 1 }], []] as any);
      mockConnection.beginTransaction.mockImplementation(() => { throw new Error('Transaction Error'); });
      mockConnection.rollback.mockResolvedValue(undefined);

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("User isn't in queue");
    });

    it('should remove user from pool when available', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ available: 1 }], []] as any);
      vi.mocked(db.query).mockResolvedValueOnce([{ affectedRows: 1 }, []] as any);

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('user successfully removed from pool');
    });

    it('should delete chat and remove from queue when not available', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ available: 0 }], []] as any) // queue status
        .mockResolvedValueOnce([[{ chat_id: 1, user_id_1: 1, user_id_2: 2 }], []] as any); // get chat
      
      mockConnection.beginTransaction.mockResolvedValue(undefined);
      mockConnection.execute.mockResolvedValue([{}, []] as any);
      mockConnection.commit.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('user successfully removed from queue');
    });

    it('should return 401 when chat retrieval fails', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ available: 0 }], []] as any)
        .mockResolvedValueOnce([[], []] as any); // no chat found

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Random Chat retreival error');
    });

    it('should return 500 on database error and rollback', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ available: 0 }], []] as any)
        .mockResolvedValueOnce([[{ chat_id: 1, user_id_1: 1, user_id_2: 2 }], []] as any);
      
      mockConnection.beginTransaction.mockImplementation(() => { throw new Error('Transaction Error'); });
      mockConnection.rollback.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/randomChats/leaveQueue')
        .send({ user_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
