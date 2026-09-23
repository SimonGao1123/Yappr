import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

import { prismaMock } from './setup.js'; // turns into a fake database
import friendsRouter from '../routes/friendsRoutes.js';

const app = express();
app.use(express.json());

app.use('/friends', friendsRouter); // call friends router to test

describe('Friends Routes Testing', () => {
    describe('POST /friends/sendFriendRequest', () => {
        it('Should return Invalid user ID/username if try to friend server id=-1', async () => {
            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 1, receiver_id: -1});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid User ID/Username');
        });

        it('Should send valid friend request from user_id 1 to user_id 2 (no friendship prior)', async () => {
            prismaMock.users.findUnique.mockResolvedValueOnce({user_id: 1} as any); // inputted username
            prismaMock.friends.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);
            prismaMock.friends.create.mockResolvedValueOnce({} as any);

            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "test"}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        it('Should not attempt a numeric id lookup when receiver_id is a username', async () => {
            prismaMock.users.findUnique.mockResolvedValueOnce({user_id: 1} as any);
            prismaMock.friends.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);
            prismaMock.friends.create.mockResolvedValueOnce({} as any);

            await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "someusername"});

            // MySQL used to coerce 'someusername' to 0 here; Prisma would throw,
            // so the id lookup must be skipped entirely for non-numeric input.
            expect(prismaMock.users.findUnique).toHaveBeenCalledTimes(1);
            expect(prismaMock.users.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({where: {username: "someusername"}})
            );
        });

        it('Should reject, sending friend request to someone who already friends with', async () => {
            prismaMock.users.findUnique.mockResolvedValueOnce({user_id: 1} as any); // inputted username
            prismaMock.friends.findFirst
                .mockResolvedValueOnce({friend_id: 1, status: "accepted"} as any)
                .mockResolvedValueOnce(null);

            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "test"}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("User is already friends with you");
        });

        it('Should reject, friend request pending (sender has already sent a friend request)', async () => {
            prismaMock.users.findUnique
                .mockResolvedValueOnce(null) // inputted username
                .mockResolvedValueOnce({username: "test", user_id: 1} as any);
            prismaMock.friends.findFirst
                .mockResolvedValueOnce({friend_id: 1, status: "pending"} as any)
                .mockResolvedValueOnce(null);

            const response = await request(app).post('/friends/sendFriendRequest')
            .send({sender_id: 2, receiver_id: "1"}) // will get username "test" and first database query gets id of 1
            // sends from user_id of 2
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("friend request already active");
        });

        it('Should reject, friend request pending (receiver has already sent a friend request to sender)', async () => {
            prismaMock.users.findUnique
                .mockResolvedValueOnce(null) // inputted username
                .mockResolvedValueOnce({username: "test", user_id: 1} as any);
            prismaMock.friends.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({friend_id: 1, status: "pending"} as any);

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
            prismaMock.friends.findUnique.mockResolvedValueOnce(null);

            const response = await request(app).post('/friends/cancel')
            .send({friend_id: 1, receiver_id: 1, receiver_username: 'test'});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request not found");
        });

        it('Friend request is not pending', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "accepted", sender_id: 2, receiver_id: 1} as any);

            const response = await request(app).post('/friends/cancel')
            .send({friend_id: 1, receiver_id: 1, receiver_username: 'test'});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request is not pending");
        });

        it('It is actually the other user who is sending a friend request at you', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "pending", sender_id: 1, receiver_id: 2} as any);

            const response = await request(app).post('/friends/cancel')
            .send({friend_id: 1, receiver_id: 1, receiver_username: 'test'});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("You don't have a friend request to test");
        });

        it('Successfully cancel friend request directed at user_id 1 username: testing', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "pending", sender_id: 2, receiver_id: 1} as any);
            prismaMock.friends.updateMany.mockResolvedValueOnce({count: 1});

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
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "pending", sender_id: 2, receiver_id: 1} as any);
            prismaMock.friends.updateMany.mockResolvedValueOnce({count: 1});

            const response = await request(app).post('/friends/reject')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Successfully rejected testing's friend request");
        });

        it('Friend request was not pending', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "accepted", sender_id: 2, receiver_id: 1} as any);

            const response = await request(app).post('/friends/reject')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request is not pending");
        });

        // turns out you are the sender
        it('Roles are reversed, you are the sender (cannot reject your own request)', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "pending", sender_id: 1, receiver_id: 2} as any);

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
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "pending", sender_id: 2, receiver_id: 1} as any);
            prismaMock.friends.updateMany.mockResolvedValueOnce({count: 1});

            const response = await request(app).post('/friends/accept')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Successfully accepted testing's friend request");
        });

        it('Friend request was not pending', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "accepted", sender_id: 2, receiver_id: 1} as any);

            const response = await request(app).post('/friends/accept')
            .send({friend_id: 1, sender_username: "testing", sender_id: 2});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend request is not pending");
        });

        // turns out you are the sender
        it('Roles are reversed, you are the sender (cannot reject your own request)', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "pending", sender_id: 1, receiver_id: 2} as any);

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
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "accepted", sender_id: 1, receiver_id: 2} as any);
            prismaMock.friends.updateMany.mockResolvedValueOnce({count: 1});

            const response = await request(app).post('/friends/unfriend')
            .send({friend_id: 1, other_user_username: "testing"});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Successfully unfriended testing");
        });

        it('Friend request is currently pending', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce({status: "pending", sender_id: 1, receiver_id: 2} as any);

            const response = await request(app).post('/friends/unfriend')
            .send({friend_id: 1, other_user_username: "testing"});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Currently not friends with user");
        });

        it('Friend request doesnt exist', async () => {
            prismaMock.friends.findUnique.mockResolvedValueOnce(null);

            const response = await request(app).post('/friends/unfriend')
            .send({friend_id: 1, other_user_username: "testing"});

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Friend not found");
        });
    });

    describe("GET /friends/currFriends", () => {
        it("Successfully get current friends list, resolving both sides of the friendship", async () => {
            // user 3 is the sender on the first row and the receiver on the second,
            // so the "other" user has to be picked from opposite columns
            prismaMock.friends.findMany.mockResolvedValueOnce([
                {friend_id: 1, sender_id: 3, sender: {user_id: 3, username: "me"}, receiver: {user_id: 1, username: "test1"}},
                {friend_id: 2, sender_id: 2, sender: {user_id: 2, username: "test2"}, receiver: {user_id: 3, username: "me"}}
            ] as any);

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
            prismaMock.friends.findMany.mockResolvedValueOnce([
                {friend_id: 1, sender: {user_id: 1, username: "test1"}},
                {friend_id: 2, sender: {user_id: 2, username: "test2"}}
            ] as any);

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
            prismaMock.friends.findMany.mockResolvedValueOnce([
                {friend_id: 1, receiver: {user_id: 1, username: "test1"}},
                {friend_id: 2, receiver: {user_id: 2, username: "test2"}}
            ] as any);

            const response = await request(app).get('/friends/outgoingRequests/3');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("updated outgoing friend requests list");
            expect(response.body.outgoingRequests).toEqual([
                {friend_id: 1, username: "test1", user_id: 1},
                {friend_id: 2, username: "test2", user_id: 2}]);
        })
    });

});
