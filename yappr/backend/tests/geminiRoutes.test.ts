import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import { prismaMock } from './setup.js';

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => {
  const mockGenerateContent = vi.fn().mockResolvedValue({
    response: {
      text: () => 'This is a mock Gemini response.'
    }
  });

  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      constructor() {}
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent
        };
      }
    }
  };
});

import geminiRouter from '../routes/geminiRoutes.js';

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use('/gemini', geminiRouter);

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    askGemini: 1,
    message_id: 1,
    sender_id: 1,
    message: 'hello',
    sent_at: new Date('2026-01-01T00:00:00.000Z'),
    user: { username: 'testuser' },
    ...overrides,
  } as any;
}

describe('Gemini Routes', () => {
  // ==================== PROMPT GEMINI ====================
  describe('POST /gemini/prompt', () => {
    it('should return 400 when prompt is missing', async () => {
      const response = await request(app)
        .post('/gemini/prompt')
        .send({ chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid prompt');
    });

    it('should return 400 when chat_id is missing', async () => {
      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'Hello Gemini', user_id: 1, username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid prompt');
    });

    it('should return 400 when user_id is missing', async () => {
      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'Hello Gemini', chat_id: 1, username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid prompt');
    });

    it('should return 401 when user is not in the chat', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce(null); // not in random chat
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce(null);  // not in regular chat

      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'Hello Gemini', chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not in the chat');
    });

    it('should process prompt successfully when user is in the chat', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce(null); // not in random chat
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce({ chat_id: 1, user_id: 1 } as any);
      prismaMock.messages.create
        .mockResolvedValueOnce(messageRow({ message_id: 1 }))  // user prompt
        .mockResolvedValueOnce(messageRow({ message_id: 2, sender_id: -1 })); // Gemini reply

      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'What is 2+2?', chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Prompt successfully processed');
      // both rows flagged askGemini, and random_chat 0 for a regular chat
      expect(prismaMock.messages.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          data: expect.objectContaining({ askGemini: 1, random_chat: 0 })
        })
      );
    });

    it('should flag messages as random_chat when the user is in a random chat', async () => {
      prismaMock.randomChats.findFirst.mockResolvedValueOnce({ chat_id: 1 } as any);
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce(null);
      prismaMock.messages.create
        .mockResolvedValueOnce(messageRow({ message_id: 1 }))
        .mockResolvedValueOnce(messageRow({ message_id: 2, sender_id: -1 }));

      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'hi', chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(200);
      expect(prismaMock.messages.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          data: expect.objectContaining({ random_chat: 1 })
        })
      );
    });

    it('should return 500 on database error', async () => {
      prismaMock.randomChats.findFirst.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'Hello Gemini', chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });

    it('should handle empty prompt string', async () => {
      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: '', chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
