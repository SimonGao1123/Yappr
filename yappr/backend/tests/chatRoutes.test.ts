import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import './setup.js';
import db from '../database.js';
import chatRouter from '../routes/chatRoutes.js';

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use('/chats', chatRouter);

describe('Chat Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== CREATE CHAT ====================
  describe('POST /chats/createChat', () => {
    it('should return 401 when creator_id is missing', async () => {
      const response = await request(app)
        .post('/chats/createChat')
        .send({ creator_username: 'user1', addedFriends: [{ user_id: 2 }], chat_name: 'Test Chat' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid creator id');
    });

    it('should return 401 when chat_name is missing', async () => {
      const response = await request(app)
        .post('/chats/createChat')
        .send({ creator_id: 1, creator_username: 'user1', addedFriends: [{ user_id: 2 }] });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid chat name');
    });

    it('should return 401 when no friends are added', async () => {
      const response = await request(app)
        .post('/chats/createChat')
        .send({ creator_id: 1, creator_username: 'user1', addedFriends: [], chat_name: 'Test Chat' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cannot make a chat by yourself');
    });

    it('should return 401 when too many members (>15)', async () => {
      const tooManyFriends = Array.from({ length: 15 }, (_, i) => ({ username: `user${i}`, user_id: i + 2, friend_id: i + 1 }));

      const response = await request(app)
        .post('/chats/createChat')
        .send({ creator_id: 1, creator_username: 'user1', addedFriends: tooManyFriends, chat_name: 'Test Chat' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Maximum of 15 members');
    });

    it('should create chat successfully', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([{ insertId: 1 }, []] as any) // INSERT INTO Chats
        .mockResolvedValueOnce([{}, []] as any) // INSERT creator into Chat_Users
        .mockResolvedValueOnce([[{ friend_id: 1 }], []] as any) // Check friendship
        .mockResolvedValueOnce([{}, []] as any) // INSERT friend into Chat_Users
        .mockResolvedValueOnce([{}, []] as any); // INSERT opening message

      const response = await request(app)
        .post('/chats/createChat')
        .send({
          creator_id: 1,
          creator_username: 'user1',
          addedFriends: [{ username: 'user2', user_id: 2, friend_id: 1 }],
          chat_name: 'Test Chat'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully created Test Chat');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/chats/createChat')
        .send({
          creator_id: 1,
          creator_username: 'user1',
          addedFriends: [{ username: 'user2', user_id: 2, friend_id: 1 }],
          chat_name: 'Test Chat'
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== LEAVE CHAT ====================
  describe('POST /chats/leaveChat', () => {
    it('should return 401 when user is not in the group', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ user_id: 2 }, { user_id: 3 }], []] as any);

      const response = await request(app)
        .post('/chats/leaveChat')
        .send({ user_id: 1, username: 'user1', chat_id: 1, creator_id: 2 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not in group');
    });

    it('should delete group when only user is left', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ user_id: 1 }], []] as any) // Only user in group
        .mockResolvedValueOnce([{}, []] as any) // DELETE from Chat_Users
        .mockResolvedValueOnce([{}, []] as any); // DELETE from Chats

      const response = await request(app)
        .post('/chats/leaveChat')
        .send({ user_id: 1, username: 'user1', chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully deleted group');
    });

    it('should transfer leadership when creator leaves', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ user_id: 1 }, { user_id: 2 }], []] as any) // Users in group
        .mockResolvedValueOnce([{}, []] as any) // UPDATE creator_id
        .mockResolvedValueOnce([{}, []] as any) // DELETE from Chat_Users
        .mockResolvedValueOnce([[{ username: 'user2' }], []] as any) // Get new leader username
        .mockResolvedValueOnce([{}, []] as any); // INSERT message

      const response = await request(app)
        .post('/chats/leaveChat')
        .send({ user_id: 1, username: 'user1', chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('user2 is the new leader');
    });

    it('should allow normal member to leave', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ user_id: 1 }, { user_id: 2 }], []] as any) // Users in group
        .mockResolvedValueOnce([{}, []] as any) // DELETE from Chat_Users
        .mockResolvedValueOnce([{}, []] as any); // INSERT message

      const response = await request(app)
        .post('/chats/leaveChat')
        .send({ user_id: 2, username: 'user2', chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('user2 has left the chat');
    });
  });

  // ==================== DELETE CHAT ====================
  describe('POST /chats/deleteChat', () => {
    it('should return 401 when user is not the creator', async () => {
      const response = await request(app)
        .post('/chats/deleteChat')
        .send({ user_id: 2, chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not the creator');
    });

    it('should delete chat successfully when user is creator', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([{}, []] as any) // DELETE from Chat_Users
        .mockResolvedValueOnce([{}, []] as any); // DELETE from Chats

      const response = await request(app)
        .post('/chats/deleteChat')
        .send({ user_id: 1, chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully deleted chat');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/chats/deleteChat')
        .send({ user_id: 1, chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== DISPLAY CHATS ====================
  describe('GET /chats/displayChats/:user_id', () => {
    it('should return no chats when user has none', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .get('/chats/displayChats/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('No chats');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/chats/displayChats/1');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== ADD TO CHAT ====================
  describe('POST /chats/addToChat', () => {
    it('should return 401 when user is not in the group', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[{ user_id: 2 }], []] as any);

      const response = await request(app)
        .post('/chats/addToChat')
        .send({ username: 'user1', user_id: 1, addedFriends: [{ user_id: 3, username: 'user3', friend_id: 1 }], chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not in the group');
    });

    it('should return 401 when chat would exceed 15 members', async () => {
      const currentUsers = Array.from({ length: 14 }, (_, i) => ({ user_id: i + 1 }));
      vi.mocked(db.execute).mockResolvedValueOnce([currentUsers, []] as any);

      const response = await request(app)
        .post('/chats/addToChat')
        .send({
          username: 'user1',
          user_id: 1,
          addedFriends: [{ user_id: 15, username: 'user15', friend_id: 1 }, { user_id: 16, username: 'user16', friend_id: 2 }],
          chat_id: 1
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Maximum 15 people per chat');
    });

    it('should add friends to chat successfully', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ user_id: 1 }], []] as any) // Current users
        .mockResolvedValueOnce([[{ friend_id: 1 }], []] as any) // Check friendship
        .mockResolvedValueOnce([[], []] as any) // Check not already member
        .mockResolvedValueOnce([{}, []] as any) // INSERT into Chat_Users
        .mockResolvedValueOnce([{}, []] as any); // INSERT message

      const response = await request(app)
        .post('/chats/addToChat')
        .send({
          username: 'user1',
          user_id: 1,
          addedFriends: [{ user_id: 2, username: 'user2', friend_id: 1 }],
          chat_id: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  // ==================== KICK USER ====================
  describe('POST /chats/kick', () => {
    it('should return 401 when user is not the leader', async () => {
      const response = await request(app)
        .post('/chats/kick')
        .send({ creator_id: 1, user_id: 2, user_username: 'user2', kicked_id: 3, kicked_username: 'user3', chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('user is not the leader, cannot kick');
    });

    it('should return 401 when trying to kick yourself', async () => {
      const response = await request(app)
        .post('/chats/kick')
        .send({ creator_id: 1, user_id: 1, user_username: 'user1', kicked_id: 1, kicked_username: 'user1', chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('cannot kick yourself');
    });

    it('should return 401 when kicked user is not in the group', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([[], []] as any);

      const response = await request(app)
        .post('/chats/kick')
        .send({ creator_id: 1, user_id: 1, user_username: 'user1', kicked_id: 3, kicked_username: 'user3', chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('user3 is not in the group');
    });

    it('should kick user successfully', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([[{ chat_user_id: 1 }], []] as any) // User is in group
        .mockResolvedValueOnce([{}, []] as any) // DELETE from Chat_Users
        .mockResolvedValueOnce([{}, []] as any); // INSERT message

      const response = await request(app)
        .post('/chats/kick')
        .send({ creator_id: 1, user_id: 1, user_username: 'user1', kicked_id: 2, kicked_username: 'user2', chat_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('user2 was kicked by user1');
    });
  });

  // ==================== EDIT CHAT NAME ====================
  describe('POST /chats/editChatName', () => {
    it('should return 401 when required fields are missing', async () => {
      const response = await request(app)
        .post('/chats/editChatName')
        .send({ newChatName: 'New Name' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid');
    });

    it('should return 401 when user is not the creator', async () => {
      const response = await request(app)
        .post('/chats/editChatName')
        .send({ newChatName: 'New Name', chat_id: 1, user_id: 2, creator_id: 1, username: 'user2' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not the creator');
    });

    it('should edit chat name successfully', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([{}, []] as any) // UPDATE Chats
        .mockResolvedValueOnce([{}, []] as any); // INSERT message

      const response = await request(app)
        .post('/chats/editChatName')
        .send({ newChatName: 'New Chat Name', chat_id: 1, user_id: 1, creator_id: 1, username: 'user1' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully changed chat name');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/chats/editChatName')
        .send({ newChatName: 'New Chat Name', chat_id: 1, user_id: 1, creator_id: 1, username: 'user1' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
