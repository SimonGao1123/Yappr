import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

// Import the setup before routes
import './setup.js'; // turns into a fake database
import db from '../database.js';
import userLoginRouter from '../routes/userLogin.js';

import crypto from 'crypto';

// Create hash matching your app's format
function createTestHash(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);
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
      
      vi.mocked(db.execute).mockResolvedValueOnce([[mockUser], []] as any);
      
      const response = await request(app)
        .post('/userLogins/login')
        .send({ userOrEmail: 'testuser', password: testPassword });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
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
      vi.mocked(db.query)
        .mockResolvedValueOnce([{ insertId: 1 }, []] as any) // User insert
        .mockResolvedValueOnce([{}, []] as any); // Settings insert
      
      const response = await request(app)
        .post('/userLogins/register')
        .send({
          username: 'newuser',
          password: '123Mgwea@123',
          email: 'test@example.com'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });
});
  

  
