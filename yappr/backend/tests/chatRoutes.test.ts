import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

import { prismaMock } from './setup.js';
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
      prismaMock.allChats.create.mockResolvedValueOnce({ chat_id: 1 } as any);
      prismaMock.chats.create.mockResolvedValueOnce({} as any);
      prismaMock.chat_Users.create.mockResolvedValue({} as any);
      prismaMock.friends.findFirst.mockResolvedValueOnce({ friend_id: 1 } as any);
      prismaMock.messages.create.mockResolvedValueOnce({} as any);

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

    it('should roll back and leave no chat behind when a friend check fails', async () => {
      prismaMock.allChats.create.mockResolvedValueOnce({ chat_id: 1 } as any);
      prismaMock.chats.create.mockResolvedValueOnce({} as any);
      prismaMock.chat_Users.create.mockResolvedValue({} as any);
      prismaMock.friends.findFirst.mockResolvedValueOnce(null); // not actually friends

      const response = await request(app)
        .post('/chats/createChat')
        .send({
          creator_id: 1,
          creator_username: 'user1',
          addedFriends: [{ username: 'user2', user_id: 2, friend_id: 1 }],
          chat_name: 'Test Chat'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('user2 is not your friend');
      // the whole handler runs inside one interactive transaction, so the
      // AllChats/Chats rows written before the failed check are rolled back
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.messages.create).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      prismaMock.allChats.create.mockRejectedValueOnce(new Error('DB Error'));

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
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ user_id: 2 }, { user_id: 3 }] as any);

      const response = await request(app)
        .post('/chats/leaveChat')
        .send({ user_id: 1, username: 'user1', chat_id: 1, creator_id: 2 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not in group');
    });

    it('should delete group when only user is left', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ user_id: 1 }] as any); // Only user in group
      prismaMock.messages.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaMock.chat_Users.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.chats.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.allChats.deleteMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/chats/leaveChat')
        .send({ user_id: 1, username: 'user1', chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully deleted group');
      // the four deletes are now genuinely atomic
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('should transfer leadership when creator leaves', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ user_id: 1 }, { user_id: 2 }] as any);
      prismaMock.chats.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.chat_Users.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.users.findUnique.mockResolvedValueOnce({ username: 'user2' } as any);
      prismaMock.messages.create.mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/chats/leaveChat')
        .send({ user_id: 1, username: 'user1', chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('user2 is the new leader');
    });

    it('should allow normal member to leave', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ user_id: 1 }, { user_id: 2 }] as any);
      prismaMock.chat_Users.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.messages.create.mockResolvedValueOnce({} as any);

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
      // membership is read before the deletes so the socket push can reach
      // members who are about to be removed
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([
        { user_id: 1 }, { user_id: 2 },
      ] as any);
      prismaMock.messages.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaMock.chat_Users.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.chats.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.allChats.deleteMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .post('/chats/deleteChat')
        .send({ user_id: 1, chat_id: 1, creator_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully deleted chat');
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('should return 500 when the transaction fails', async () => {
      // Previously this path returned 201 even on failure, because the
      // transaction calls were never awaited. It now fails loudly.
      (prismaMock.$transaction as any).mockRejectedValueOnce(new Error('DB Error'));

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
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/chats/displayChats/1');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('No chats');
    });

    it('should pass the user_id to Prisma as a number, not a string', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([]);

      await request(app).get('/chats/displayChats/1');

      expect(prismaMock.chat_Users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 1 } })
      );
    });

    it('should assemble the chat payload with a stable shape', async () => {
      prismaMock.chat_Users.findMany
        .mockResolvedValueOnce([{ chat_id: 1 }] as any)  // chats the user belongs to
        .mockResolvedValueOnce([                          // members of chat 1
          { user_id: 1, joined_at: new Date('2026-01-01T00:00:00.000Z') }
        ] as any);
      prismaMock.users.findUnique
        .mockResolvedValueOnce({                          // member profile
          username: 'user1',
          joined_at: new Date('2025-06-01T00:00:00.000Z'),
          description: null
        } as any)
        .mockResolvedValueOnce({ username: 'user1' } as any); // creator username
      prismaMock.friends.findFirst.mockResolvedValueOnce(null);
      prismaMock.chats.findUnique.mockResolvedValueOnce({ creator_id: 1, chat_name: 'Test Chat' } as any);
      prismaMock.messages.findFirst.mockResolvedValueOnce(null); // no messages -> read

      const response = await request(app).get('/chats/displayChats/1');

      expect(response.status).toBe(201);
      expect(response.body.chat_data).toHaveLength(1);
      expect(response.body.chat_data[0]).toEqual({
        unread: false,
        creator_id: 1,
        creator_username: 'user1',
        chat_name: 'Test Chat',
        userList: [{
          user_id: 1,
          status: 'none',
          username: 'user1',
          account_created: '2025-06-01T00:00:00.000Z',
          description: null,
          joined_at: '2026-01-01T00:00:00.000Z'
        }],
        chat_id: 1
      });
    });

    it('should return 500 on database error', async () => {
      prismaMock.chat_Users.findMany.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/chats/displayChats/1');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  // ==================== ADD TO CHAT ====================
  describe('POST /chats/addToChat', () => {
    it('should return 401 when user is not in the group', async () => {
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ user_id: 2 }] as any);

      const response = await request(app)
        .post('/chats/addToChat')
        .send({ username: 'user1', user_id: 1, addedFriends: [{ user_id: 3, username: 'user3', friend_id: 1 }], chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not in the group');
    });

    it('should return 401 when chat would exceed 15 members', async () => {
      const currentUsers = Array.from({ length: 14 }, (_, i) => ({ user_id: i + 1 }));
      prismaMock.chat_Users.findMany.mockResolvedValueOnce(currentUsers as any);

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
      prismaMock.chat_Users.findMany.mockResolvedValueOnce([{ user_id: 1 }] as any); // Current users
      prismaMock.friends.findFirst.mockResolvedValueOnce({ friend_id: 1 } as any);   // Check friendship
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce(null);                   // Not already a member
      prismaMock.chat_Users.create.mockResolvedValueOnce({} as any);
      prismaMock.messages.create.mockResolvedValueOnce({} as any);

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
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/chats/kick')
        .send({ creator_id: 1, user_id: 1, user_username: 'user1', kicked_id: 3, kicked_username: 'user3', chat_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('user3 is not in the group');
    });

    it('should kick user successfully', async () => {
      prismaMock.chat_Users.findFirst.mockResolvedValueOnce({ chat_user_id: 1 } as any);
      prismaMock.chat_Users.deleteMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.messages.create.mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/chats/kick')
        .send({ creator_id: 1, user_id: 1, user_username: 'user1', kicked_id: 2, kicked_username: 'user2', chat_id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('user2 was kicked by user1');
      // the raw SQL spelled this column `user_Id`; MySQL was case-insensitive
      expect(prismaMock.chat_Users.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 2, chat_id: 1 } })
      );
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
      prismaMock.chats.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.messages.create.mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/chats/editChatName')
        .send({ newChatName: 'New Chat Name', chat_id: 1, user_id: 1, creator_id: 1, username: 'user1' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully changed chat name');
    });

    it('should return 500 on database error', async () => {
      prismaMock.chats.updateMany.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/chats/editChatName')
        .send({ newChatName: 'New Chat Name', chat_id: 1, user_id: 1, creator_id: 1, username: 'user1' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
