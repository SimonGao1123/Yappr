import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import './setup.js';
import db from '../database.js';

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

describe('Gemini Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[], []] as any) // RandomChats check - not in random chat
        .mockResolvedValueOnce([[], []] as any); // Chat_Users check - not in regular chat

      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'Hello Gemini', chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not in the chat');
    });

    it('should process prompt successfully when user is in the chat', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[], []] as any) // RandomChats check - not in random chat
        .mockResolvedValueOnce([[{ chat_id: 1, user_id: 1 }], []] as any); // Chat_Users check - user is in regular chat
      vi.mocked(db.query)
        .mockResolvedValueOnce([{ insertId: 1 }, []] as any) // Insert user prompt
        .mockResolvedValueOnce([{ insertId: 2 }, []] as any); // Insert Gemini response

      const response = await request(app)
        .post('/gemini/prompt')
        .send({ prompt: 'What is 2+2?', chat_id: 1, user_id: 1, username: 'testuser' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Prompt successfully processed');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

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
