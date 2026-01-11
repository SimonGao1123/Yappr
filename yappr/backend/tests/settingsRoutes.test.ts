import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import './setup.js';
import db from '../database.js';
import settingsRouter from '../routes/settingsRoutes.js';

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use('/settings', settingsRouter);

describe('Settings Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== SET DESCRIPTION ====================
  describe('POST /settings/setDescription', () => {
    it('should return 401 when description is missing', async () => {
      const response = await request(app)
        .post('/settings/setDescription')
        .send({ user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid description');
    });

    it('should return 401 when user_id is missing', async () => {
      const response = await request(app)
        .post('/settings/setDescription')
        .send({ description: 'Hello world' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should update description successfully', async () => {
      vi.mocked(db.query).mockResolvedValueOnce([{ affectedRows: 1 }, []] as any);

      const response = await request(app)
        .post('/settings/setDescription')
        .send({ user_id: 1, description: 'My new description' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully updated description');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.query).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/settings/setDescription')
        .send({ user_id: 1, description: 'Test description' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== GET DESCRIPTION ====================
  describe('GET /settings/getDescription/:user_id', () => {
    it('should return empty description when user has no description', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ description: null }], []] as any);

      const response = await request(app)
        .get('/settings/getDescription/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.desc).toBe('');
    });

    it('should return description when user has one', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ description: 'Hello I am a test user' }], []] as any);

      const response = await request(app)
        .get('/settings/getDescription/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.desc).toBe('Hello I am a test user');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/settings/getDescription/1');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== SWITCH LIGHT/DARK MODE ====================
  describe('POST /settings/switchLightDarkMode', () => {
    it('should return 401 when ifLightMode is undefined', async () => {
      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ user_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid option');
    });

    it('should return 401 when user_id is missing', async () => {
      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ ifLightMode: true });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should switch to light mode successfully', async () => {
      vi.mocked(db.query).mockResolvedValueOnce([{ affectedRows: 1 }, []] as any);

      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ user_id: 1, ifLightMode: true });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully updated mode');
    });

    it('should switch to dark mode successfully', async () => {
      vi.mocked(db.query).mockResolvedValueOnce([{ affectedRows: 1 }, []] as any);

      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ user_id: 1, ifLightMode: false });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.query).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ user_id: 1, ifLightMode: true });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== GET IF LIGHT MODE ====================
  describe('GET /settings/ifLightMode/:user_id', () => {
    it('should return light_mode true when user has light mode enabled', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ light_mode: true }], []] as any);

      const response = await request(app)
        .get('/settings/ifLightMode/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.light_mode).toBe(true);
    });

    it('should return light_mode false when user has dark mode enabled', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ light_mode: false }], []] as any);

      const response = await request(app)
        .get('/settings/ifLightMode/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.light_mode).toBe(false);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/settings/ifLightMode/1');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
