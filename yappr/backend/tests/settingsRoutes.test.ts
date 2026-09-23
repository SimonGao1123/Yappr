import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import { prismaMock } from './setup.js';
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
      prismaMock.users.updateMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/settings/setDescription')
        .send({ user_id: 1, description: 'My new description' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully updated description');
    });

    it('should return 500 on database error', async () => {
      prismaMock.users.updateMany.mockRejectedValueOnce(new Error('DB Error'));

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
      prismaMock.users.findUnique.mockResolvedValueOnce({ description: null } as any);

      const response = await request(app)
        .get('/settings/getDescription/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.desc).toBe('');
    });

    it('should return description when user has one', async () => {
      prismaMock.users.findUnique.mockResolvedValueOnce({ description: 'Hello I am a test user' } as any);

      const response = await request(app)
        .get('/settings/getDescription/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.desc).toBe('Hello I am a test user');
    });

    it('should pass the user_id to Prisma as a number, not a string', async () => {
      prismaMock.users.findUnique.mockResolvedValueOnce({ description: 'x' } as any);

      await request(app).get('/settings/getDescription/7');

      expect(prismaMock.users.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 7 } })
      );
    });

    it('should return 500 on database error', async () => {
      prismaMock.users.findUnique.mockRejectedValueOnce(new Error('DB Error'));

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

    it('should switch to light mode successfully, writing 1 not true', async () => {
      prismaMock.settings.updateMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ user_id: 1, ifLightMode: true });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully updated mode');
      // light_mode is a tinyint column, so the boolean must be coerced
      expect(prismaMock.settings.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { light_mode: 1 } })
      );
    });

    it('should switch to dark mode successfully, writing 0 not false', async () => {
      prismaMock.settings.updateMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ user_id: 1, ifLightMode: false });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(prismaMock.settings.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { light_mode: 0 } })
      );
    });

    it('should return 500 on database error', async () => {
      prismaMock.settings.updateMany.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/settings/switchLightDarkMode')
        .send({ user_id: 1, ifLightMode: true });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== GET IF LIGHT MODE ====================
  describe('GET /settings/ifLightMode/:user_id', () => {
    it('should return light_mode 1 when user has light mode enabled', async () => {
      prismaMock.settings.findUnique.mockResolvedValueOnce({ light_mode: 1 } as any);

      const response = await request(app)
        .get('/settings/ifLightMode/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // must stay numeric — the frontend compares with === 1
      expect(response.body.light_mode).toBe(1);
    });

    it('should return light_mode 0 when user has dark mode enabled', async () => {
      prismaMock.settings.findUnique.mockResolvedValueOnce({ light_mode: 0 } as any);

      const response = await request(app)
        .get('/settings/ifLightMode/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.light_mode).toBe(0);
    });

    it('should return 404 when the user has no settings row', async () => {
      prismaMock.settings.findUnique.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/settings/ifLightMode/1');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 500 on database error', async () => {
      prismaMock.settings.findUnique.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/settings/ifLightMode/1');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
