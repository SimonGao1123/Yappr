import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

import './setup.js'; // turns into a fake database
import db from '../database.js';
import friendsRouter from '../routes/friendsRoutes.js';

const app = express();
app.use(express.json());

app.use('/friends', friendsRouter); // call friends router to test

describe('Friends Routes Testing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /friends/sendFriendRequest', () => {
        it('Should return Invalid user ID/username if try to friend server id=-1', async () => {
            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 1, receiver_id: -1});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid User ID/Username');
        });

        it('Should send valid friend request from user_id 1 to user_id 2 (no friendship prior)', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{user_id: 1}], []] as any) // inputted username
            .mockResolvedValueOnce([[], []] as any)
            .mockResolvedValueOnce([[], []] as any)
            .mockResolvedValueOnce([[], []] as any)

            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "test"}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        it('Should reject, sending friend request to someone who already friends with', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{user_id: 1}], []] as any) // inputted username
            .mockResolvedValueOnce([[], []] as any)
            .mockResolvedValueOnce([[{friend_id: 1, status: "accepted"}], []] as any)
            .mockResolvedValueOnce([[], []] as any)

            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "test"}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("User is already friends with you");
        });

        it('Should reject, friend request pending (sender has already sent a friend request)', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[], []] as any) // inputted username
            .mockResolvedValueOnce([[{username: "test", user_id: 1}], []] as any)
            .mockResolvedValueOnce([[{friend_id: 1, status: "pending"}], []] as any)
            .mockResolvedValueOnce([[], []] as any)

            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "1"}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("friend request already active");
        });

        it('Should reject, friend request pending (receiver has already sent a friend request to sender)', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[], []] as any) // inputted username
            .mockResolvedValueOnce([[{username: "test", user_id: 1}], []] as any)
            .mockResolvedValueOnce([[], []] as any)
            .mockResolvedValueOnce([[{friend_id: 1, status: "pending"}], []] as any)

            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "1"}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("friend request already active");
        });

        it('Should reject, receiver id is null (not a valid user)', async () => {
            
            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 1, receiver_id: null}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Invalid User ID/Username");
        });
    });

    describe('POST /friends/cancel', () => {
        it('No friend request found', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[], []] as any)
            
            const response = await request(app).post('/friends/cancel')
            .send({friend_id: 1, receiver_id: 1, receiver_username: 'test'});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request not found");
        });

        it('Friend request is not pending', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "accepted", sender_id: 2, receiver_id: 1}], []] as any)
            
            const response = await request(app).post('/friends/cancel')
            .send({friend_id: 1, receiver_id: 1, receiver_username: 'test'});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request is not pending");
        });

        it('It is actually the other user who is sending a friend request at you', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "pending", sender_id: 1, receiver_id: 2}], []] as any)
            
            const response = await request(app).post('/friends/cancel')
            .send({friend_id: 1, receiver_id: 1, receiver_username: 'test'});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("You don't have a friend request to test");
        });

        it('Successfully cancel friend request directed at user_id 1 username: testing', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "pending", sender_id: 2, receiver_id: 1}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/cancel') 
            .send({friend_id: 1, receiver_id: 1, receiver_username: 'testing'});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Successfully cancelled request towards testing");
        });
    });

    describe('POST /friends/reject', () => {
        // when friend request is directed at you (you are the receiver)
        it('Successfully reject friend request', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "pending", sender_id: 2, receiver_id: 1}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/reject')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Successfully rejected testing's friend request");
        });

        it('Friend request was not pending', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "accepted", sender_id: 2, receiver_id: 1}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/reject')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request is not pending");
        });

        // turns out you are the sender
        it('Roles are reversed, you are the sender (cannot reject your own request)', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "pending", sender_id: 1, receiver_id: 2}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/reject')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("testing does not have a friend request directed towards you");
        });
    });

    describe('POST /friends/accept', () => {
        // when friend request is directed at you (you are the receiver)
        it('Successfully accept friend request', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "pending", sender_id: 2, receiver_id: 1}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/accept')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Successfully accepted testing's friend request");
        });

        it('Friend request was not pending', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "accepted", sender_id: 2, receiver_id: 1}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/accept')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request is not pending");
        });

        // turns out you are the sender
        it('Roles are reversed, you are the sender (cannot reject your own request)', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "pending", sender_id: 1, receiver_id: 2}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);
            const response = await request(app).post('/friends/accept')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("testing does not have a friend request directed towards you");
        });
    });

    describe("POST /friends/unfriend", () => {
        // only valid for accepted
        it('Successfully unfriend', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "accepted", sender_id: 1, receiver_id: 2}], []] as any)
            
            vi.mocked(db.query).mockResolvedValueOnce({} as any);

            const response = await request(app).post('/friends/unfriend')
            .send({friend_id: 1, other_user_username: "testing"});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Successfully unfriended testing");
        });

        it('Friend request is currently pending', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[{status: "pending", sender_id: 1, receiver_id: 2}], []] as any)
            

            const response = await request(app).post('/friends/unfriend')
            .send({friend_id: 1, other_user_username: "testing"});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Currently not friends with user");
        });

        it('Friend request doesnt exist', async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[], []] as any)
            

            const response = await request(app).post('/friends/unfriend')
            .send({friend_id: 1, other_user_username: "testing"});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend not found");
        });
    });

    describe("GET /friends/currFriends", () => {
        it("Successfully get current friends list", async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[
                {friend_id: 1, username: "test1", user_id: 1},
            {friend_id: 2, username: "test2", user_id: 2}], []] as any)
            
            const response = await request(app).get('/friends/currFriends/3');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("updated current friends list");
            expect(response.body.currFriends).toEqual([
                {friend_id: 1, username: "test1", user_id: 1},
            {friend_id: 2, username: "test2", user_id: 2}]);
        })
    });

    describe("GET /friends/incomingRequests", () => {
        it("Successfully get incoming friend requests list", async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[
                {friend_id: 1, username: "test1", user_id: 1},
            {friend_id: 2, username: "test2", user_id: 2}], []] as any)
            
            const response = await request(app).get('/friends/incomingRequests/3');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("updated incoming friend requests list");
            expect(response.body.incomingRequests).toEqual([
                {friend_id: 1, username: "test1", user_id: 1},
            {friend_id: 2, username: "test2", user_id: 2}]);
        })
    });

    describe("GET /friends/outgoingRequests", () => {
        it("Successfully get outgoing friend requests list", async () => {
            vi.mocked(db.execute)
            .mockResolvedValueOnce([[
                {friend_id: 1, username: "test1", user_id: 1},
            {friend_id: 2, username: "test2", user_id: 2}], []] as any)
            
            const response = await request(app).get('/friends/outgoingRequests/3');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("updated outgoing friend requests list");
            expect(response.body.outgoingRequests).toEqual([
                {friend_id: 1, username: "test1", user_id: 1},
            {friend_id: 2, username: "test2", user_id: 2}]);
        })
    });

});
