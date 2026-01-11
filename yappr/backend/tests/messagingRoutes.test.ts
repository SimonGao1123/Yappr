import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import './setup.js';
import db from '../database.js';
import messagingRouter from '../routes/messagingRoutes.js';

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use('/message', messagingRouter);

describe('Messaging Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .post('/message/sendMessage')
        .send({ chat_id: 1, message: 'Hello', user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not in the chat');
    });

    it('should send message successfully when user is in the chat', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ chat_id: 1, user_id: 1 }], []] as any);
      vi.mocked(db.query).mockResolvedValueOnce([{ insertId: 1 }, []] as any);

      const response = await request(app)
        .post('/message/sendMessage')
        .send({ chat_id: 1, message: 'Hello everyone!', user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sent message');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 999, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("message doesn't exist");
    });

    it('should return 401 when message is already deleted', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ sender_id: 1, chat_id: 1, deleted: true }], []] as any);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("message doesn't exist");
    });

    it('should return 401 when message is in a different chat', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ sender_id: 1, chat_id: 2, deleted: false }], []] as any);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('message is in a different chat');
    });

    it('should delete message successfully', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ sender_id: 1, chat_id: 1, deleted: false }], []] as any);
      vi.mocked(db.query).mockResolvedValueOnce([{ affectedRows: 1 }, []] as any);

      const response = await request(app)
        .post('/message/deleteMessage')
        .send({ message_id: 1, user_id: 1, sender_id: 1, chat_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully delete message');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .get('/message/getMessages/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.msgData).toEqual([]);
    });

    it('should return messages from all user chats', async () => {
      // Mock: user is in 2 chats
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ chat_id: 1 }, { chat_id: 2 }], []] as any)
        // Messages for chat 1
        .mockResolvedValueOnce([[
          { message_id: 1, sender_id: 1, message: 'Hello', username: 'user1', sent_at: '2026-01-01', askGemini: false }
        ], []] as any)
        // Messages for chat 2
        .mockResolvedValueOnce([[
          { message_id: 2, sender_id: 2, message: 'Hi there', username: 'user2', sent_at: '2026-01-01', askGemini: false }
        ], []] as any);

      const response = await request(app)
        .get('/message/getMessages/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.msgData).toHaveLength(2);
      expect(response.body.msgData[0].chat_id).toBe(1);
      expect(response.body.msgData[1].chat_id).toBe(2);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .post('/message/readMessages')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('no messages in chat');
    });

    it('should update last_seen_message_id successfully', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ message_id: 50 }], []] as any);
      vi.mocked(db.query).mockResolvedValueOnce([{ affectedRows: 1 }, []] as any);

      const response = await request(app)
        .post('/message/readMessages')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successfully read chat');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/message/readMessages')
        .send({ chat_id: 1, user_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
