import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

// Import the setup before routes
import { prismaMock } from './setup.js'; // turns into a fake database
import { Prisma } from '../generated/prisma/index.js';
import userLoginRouter from '../routes/userLogin.js';

import crypto from 'crypto';

// Create hash matching your app's format
function createTestHash(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function duplicateKeyError(target: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));

// test server for user logins

app.use('/userLogins', userLoginRouter);

describe('User Login Routes', () => {
  describe('GET /userLogins/me', () => {
    it('should return loggedIn: false when no session', async () => {
        const response = await request(app).get('/userLogins/me');
        expect(response.status).toBe(200);
        expect(response.body.loggedIn).toBe(false);
    });
  });

  describe('POST /userLogins/login', () => {
    it('Should return 401 when credentials are missing (sent empty pass/username)', async () => {
      const response = await request(app)
      .post('/userLogins/login')
      .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('Should return 401 when user does not exist', async () => {
      prismaMock.users.findFirst.mockResolvedValueOnce(null);
      // creates a fake db entry
      const response = await request(app)
        .post('/userLogins/login')
        .send({ userOrEmail: 'nonexistent', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Username or Email doesn't exist");
    });

    it('Should login successfully with valid credentials (testing1)', async () => {
      const testPassword = 'correctpassword';

      const mockUser = {
        user_id: 1,
        username: 'testuser',
        password: createTestHash(testPassword)  // Properly hashed
      };

      prismaMock.users.findFirst.mockResolvedValueOnce(mockUser as any);

      const response = await request(app)
        .post('/userLogins/login')
        .send({ userOrEmail: 'testuser', password: testPassword });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('Should return 500 rather than hang when the database throws', async () => {
      prismaMock.users.findFirst.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/userLogins/login')
        .send({ userOrEmail: 'testuser', password: 'whatever' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /userLogins/register', () => {
    it('should return 401 when fields are missing', async () => {
      const response = await request(app)
        .post('/userLogins/register')
        .send({ username: 'test' }); // Missing password and email

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should register successfully with valid data', async () => {
      prismaMock.users.create.mockResolvedValueOnce({ user_id: 1 } as any);

      const response = await request(app)
        .post('/userLogins/register')
        .send({
          username: 'newuser',
          password: '123Mgwea@123',
          email: 'test@example.com'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // the settings row is created in the same nested write
      expect(prismaMock.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ settings: { create: {} } })
        })
      );
    });

    it('should return 409 when the username is taken', async () => {
      prismaMock.users.create.mockRejectedValueOnce(duplicateKeyError('uniq_username'));

      const response = await request(app)
        .post('/userLogins/register')
        .send({ username: 'taken', password: 'pw', email: 'a@b.com' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Username already exists');
    });

    it('should return 409 when the email is taken', async () => {
      prismaMock.users.create.mockRejectedValueOnce(duplicateKeyError('uniq_email'));

      const response = await request(app)
        .post('/userLogins/register')
        .send({ username: 'fresh', password: 'pw', email: 'taken@b.com' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Email already exists');
    });

    it('should return 500 rather than hang on a non-duplicate error', async () => {
      prismaMock.users.create.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/userLogins/register')
        .send({ username: 'newuser', password: 'pw', email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
