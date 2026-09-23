import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import { prismaMock } from './setup.js';
import messagingRouter from '../routes/messagingRoutes.js';

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use('/message', messagingRouter);

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    askGemini: 0,
    message_id: 1,
    sender_id: 1,
    message: 'Hello',
    sent_at: new Date('2026-01-01T00:00:00.000Z'),
    user: { username: 'user1' },
    ...overrides,
  } as any;
}

describe('Messaging Routes', () => {
  // ==================== SEND MESSAGE ====================
  describe('POST /message/sendMessage', () => {
    it('should return 401 when message is missing', async () => {
      const response = await request(app)
        .post('/message/sendMessage')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not a valid message');
    });

    it('should return 401 when chat_id is missing', async () => {
      const response = await request(app)
        .post('/message/sendMessage')
        .send({ message: 'Hello', user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 when user_id is missing', async () => {
      const response = await request(app)
        .post('/message/sendMessage')
        .send({ message: 'Hello', chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 when user is not in the chat', async () => {
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/message/sendMessage')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not in the chat');
    });

    it('should send message successfully when user is in the chat', async () => {
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce({ chat_id: 1, user_id: 1 } as any);
      prismaMock.messages.create.mockResolvedValueOnce(messageRow());

      const response = await request(app)
        .post('/message/sendMessage')
        .send({ chat_id: 1, message: 'Hello everyone!', user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sent message');
    });

    it('should return 500 on database error', async () => {
      prismaMock.chat_Users.findFirst.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/message/sendMessage')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== DELETE MESSAGE ====================
  describe('POST /message/deleteMessage', () => {
    it('should return 401 when user tries to delete someone else\'s message', async () => {
      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 2, chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("cannot delete someone else's message");
    });

    it('should return 401 when message does not exist', async () => {
      prismaMock.messages.findUnique.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 999, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("message doesn't exist");
    });

    it('should return 401 when message is already deleted', async () => {
      prismaMock.messages.findUnique.mockResolvedValueOnce({ sender_id: 1, chat_id: 1, deleted: 1 } as any);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("message doesn't exist");
    });

    it('should return 401 when message is in a different chat', async () => {
      prismaMock.messages.findUnique.mockResolvedValueOnce({ sender_id: 1, chat_id: 2, deleted: 0 } as any);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('message is in a different chat');
    });

    it('should delete message successfully', async () => {
      prismaMock.messages.findUnique.mockResolvedValueOnce({ sender_id: 1, chat_id: 1, deleted: 0 } as any);
      prismaMock.messages.update.mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully delete message');
      // soft delete, not a row removal
      expect(prismaMock.messages.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deleted: 1 } })
      );
    });

    it('should return 500 on database error', async () => {
      prismaMock.messages.findUnique.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== GET MESSAGES ====================
  describe('GET /message/getMessages/:user_id', () => {
    it('should return empty array when user has no chats', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/message/getMessages/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.msgData).toEqual([]);
    });

    it('should return messages from all user chats', async () => {
      // Mock: user is in 2 chats
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ chat_id: 1 }, { chat_id: 2 }] as any);
      prismaMock.messages.findMany
        .mockResolvedValueOnce([messageRow({ message_id: 1, sender_id: 1, message: 'Hello' })])
        .mockResolvedValueOnce([messageRow({ message_id: 2, sender_id: 2, message: 'Hi there', user: { username: 'user2' } })]);

      const response = await request(app)
        .get('/message/getMessages/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.msgData).toHaveLength(2);
      expect(response.body.msgData[0].chat_id).toBe(1);
      expect(response.body.msgData[1].chat_id).toBe(2);
    });

    it('should flatten the joined username and serialise sent_at as an ISO string', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ chat_id: 1 }] as any);
      prismaMock.messages.findMany.mockResolvedValueOnce([messageRow()]);

      const response = await request(app)
        .get('/message/getMessages/1');

      expect(response.body.msgData[0].messageData[0]).toEqual({
        askGemini: 0,
        message_id: 1,
        sender_id: 1,
        message: 'Hello',
        username: 'user1',
        sent_at: '2026-01-01T00:00:00.000Z',
      });
    });

    it('should pass the user_id to Prisma as a number, not a string', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([]);

      await request(app).get('/message/getMessages/42');

      expect(prismaMock.chat_Users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 42 } })
      );
    });

    it('should return 500 on database error', async () => {
      prismaMock.chat_Users.findMany.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/message/getMessages/1');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== READ MESSAGES ====================
  describe('POST /message/readMessages', () => {
    it('should return 401 when chat_id is missing', async () => {
      const response = await request(app)
        .post('/message/readMessages')
        .send({ user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("chat does't exist");
    });

    it('should return 401 when user_id is missing', async () => {
      const response = await request(app)
        .post('/message/readMessages')
        .send({ chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return success when no messages in chat', async () => {
      prismaMock.messages.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/message/readMessages')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('no messages in chat');
    });

    it('should update last_seen_message_id successfully', async () => {
      prismaMock.messages.findFirst.mockResolvedValueOnce({ message_id: 50 } as any);
      prismaMock.chat_Users.updateMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/message/readMessages')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successfully read chat');
      expect(prismaMock.chat_Users.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { last_seen_message_id: 50 } })
      );
    });

    it('should return 500 on database error', async () => {
      prismaMock.messages.findFirst.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/message/readMessages')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
