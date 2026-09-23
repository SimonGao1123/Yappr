import express from 'express';
import prisma from '../prisma.js';
import { notifyFriendsChanged } from '../socketInstance.js';
import type {Request, Response} from 'express';
const router = express.Router();

import type { CancelRequestInput, AcceptRejectRequestInput, SendRequestInput, UnfriendInput, GetCurrFriendsResponse, GetIncFriendsResponse, GetOutFriendsResponse } from '../../definitions/friendsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';


/*
    POSSIBLE STATUS:
        - pending
        - rejected
        - accepted
        - unfriended
*/

router.post("/sendFriendRequest", async (req: Request<{},{},SendRequestInput>, res: Response<standardResponse>) => {
    const {sender_id, receiver_id} = req.body; // receiver_id is a string!!!
    let usernameReceiver: string; // stores username of user receiving request
    let idReceiver: number;
    try {
        if (!receiver_id || Number(receiver_id) === -1) {
            return res.status(401).json({success: false, message: "Invalid User ID/Username"});
        }

        // Check if receiver_id is a username or id
        const ifUsername = await prisma.users.findUnique({
            where: {username: String(receiver_id)},
            select: {user_id: true}
        });
        // assume receiver_id is an id. MySQL used to coerce a non-numeric
        // string to 0 here; Prisma rejects it, so only look up a real integer.
        const receiverIdNum = /^-?\d+$/.test(String(receiver_id)) ? Number(receiver_id) : null;
        const ifId = receiverIdNum === null ? null : await prisma.users.findUnique({
            where: {user_id: receiverIdNum},
            select: {username: true, user_id: true}
        });

        if (ifUsername) { // receiver_id is a username
            idReceiver = ifUsername.user_id;
            usernameReceiver = String(receiver_id);
        }
        else if (ifId) { // if receiver_id is a id
            idReceiver = Number(receiver_id);
            usernameReceiver = String(ifId.username);
        }
        else {
            return res.status(401).json({success: false, message: "User doesn't exist"});
        }

        if (idReceiver === sender_id) {
            return res.status(401).json({success: false, message: "Cannot send friend request to yourself"});
        }
        if (idReceiver === -1) {
            return res.status(401).json({success: false, message: "Invalid User ID/Username"});
            // sent to server user
        }

        const rowsCurrStatus = await prisma.friends.findFirst({
            where: {sender_id, receiver_id: idReceiver},
            select: {friend_id: true, status: true}
        });

        const swappedRowsCurrStatus = await prisma.friends.findFirst({
            where: {sender_id: idReceiver, receiver_id: sender_id},
            select: {friend_id: true, status: true}
        });

        if (!rowsCurrStatus && !swappedRowsCurrStatus) {
            // no existing request
            await prisma.friends.create({
                data: {sender_id, receiver_id: idReceiver, status: "pending"}
            });
            notifyFriendsChanged([sender_id, idReceiver]);
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        }

        if (rowsCurrStatus?.status === "pending" || swappedRowsCurrStatus?.status === "pending") {
            return res.status(401).json({success: false, message: "friend request already active"});
        }
        else if (rowsCurrStatus?.status === "accepted" || swappedRowsCurrStatus?.status === "accepted") {
            return res.status(401).json({success: false, message: "User is already friends with you"});
        }
        else if (rowsCurrStatus?.status === "unfriended" || rowsCurrStatus?.status === "rejected") {
            await prisma.friends.updateMany({
                where: {friend_id: rowsCurrStatus.friend_id},
                data: {status: "pending", updated_at: new Date()}
            });
            notifyFriendsChanged([sender_id, idReceiver]);
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        }
        else if (swappedRowsCurrStatus?.status === "unfriended" || swappedRowsCurrStatus?.status === "rejected") {
            await prisma.friends.updateMany({
                where: {friend_id: swappedRowsCurrStatus.friend_id},
                data: {status: "pending", sender_id, receiver_id: idReceiver, updated_at: new Date()}
            });
            notifyFriendsChanged([sender_id, idReceiver]);
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        } else {
            return res.status(401).json({success: false, message: "Invalid status"});
        }
    } catch (err) {
        console.log("Internal server error while sending friend request: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }


});


router.post("/cancel", async (req: Request<{},{},CancelRequestInput>, res: Response<standardResponse>) => {
    const {friend_id, receiver_id, receiver_username} = req.body;

    // USER IS SENDER
    try {
        const row = await prisma.friends.findUnique({
            where: {friend_id},
            select: {status: true, sender_id: true, receiver_id: true}
        });
        if (!row) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (row.status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (row.receiver_id !== receiver_id) {
            return res.status(401).json({success: false, message: `You don't have a friend request to ${receiver_username}`});
        }

        await prisma.friends.updateMany({
            where: {friend_id},
            data: {status: "rejected", updated_at: new Date()}
        });
        notifyFriendsChanged([row.sender_id, row.receiver_id]);
        return res.status(201).json({success: true, message: `Successfully cancelled request towards ${receiver_username}`});
    } catch (err) {
        console.log("Error while cancelling friend request: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
router.post("/reject", async (req: Request<{},{},AcceptRejectRequestInput>, res: Response<standardResponse>) => {
    const {friend_id, sender_username, sender_id} = req.body; // user is the receiver

    // only valid for pending requests
    try {
        const row = await prisma.friends.findUnique({
            where: {friend_id},
            select: {status: true, sender_id: true, receiver_id: true}
        });
        if (!row) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (row.status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (row.sender_id !== sender_id) {
            return res.status(401).json({success: false, message: `${sender_username} does not have a friend request directed towards you`});
        }

        await prisma.friends.updateMany({
            where: {friend_id},
            data: {status: "rejected", updated_at: new Date()}
        });
        notifyFriendsChanged([row.sender_id, row.receiver_id]);
        return res.status(201).json({success: true, message: `Successfully rejected ${sender_username}'s friend request`});
    } catch (err) {
        console.log("Error while rejecting friend request: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

});

router.post("/accept", async (req: Request<{},{},AcceptRejectRequestInput>, res:Response<standardResponse>) => {
    const {friend_id, sender_username, sender_id} = req.body; // user is the receiver

    // only valid for pending requests
    try {
        const row = await prisma.friends.findUnique({
            where: {friend_id},
            select: {status: true, sender_id: true, receiver_id: true}
        });
        if (!row) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (row.status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (row.sender_id !== sender_id) {
            return res.status(401).json({success: false, message: `${sender_username} does not have a friend request directed towards you`});
        }

        await prisma.friends.updateMany({
            where: {friend_id},
            data: {status: "accepted", updated_at: new Date()}
        });
        notifyFriendsChanged([row.sender_id, row.receiver_id]);
        return res.status(201).json({success: true, message: `Successfully accepted ${sender_username}'s friend request`});
    } catch (err) {
        console.log("Error while accepting friend request: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/unfriend", async(req: Request<{},{},UnfriendInput>, res: Response<standardResponse>) => {
    const {friend_id, other_user_username} = req.body; // user can be receiver or sender

    // only valid for accepted
    try {
        const row = await prisma.friends.findUnique({
            where: {friend_id},
            select: {status: true, sender_id: true, receiver_id: true}
        });
        if (!row) {
            return res.status(401).json({success: false, message: "Friend not found"});
        }
        if (row.status !== "accepted") {
            return res.status(401).json({success: false, message: "Currently not friends with user"});
        }

        await prisma.friends.updateMany({
            where: {friend_id},
            data: {status: "unfriended", updated_at: new Date()}
        });
        notifyFriendsChanged([row.sender_id, row.receiver_id]);
        return res.status(201).json({success: true, message: `Successfully unfriended ${other_user_username}`});
    } catch (err) {
        console.log("Error while unfriending: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

// return array of objects including their username, user_id, and friend_id
router.get("/currFriends/:user_id", async(req: Request<{user_id:string}>, res: Response<GetCurrFriendsResponse>) => {
    const user_id = Number(req.params.user_id); // gets the current user logged in id

    try {
        // Replaces a JOIN whose ON clause was a CASE expression picking the
        // "other" side of the friendship. Both sides are selected instead and
        // the branch is resolved in JS.
        const rows = Number.isInteger(user_id)
            ? await prisma.friends.findMany({
                where: {status: "accepted", OR: [{sender_id: user_id}, {receiver_id: user_id}]},
                select: {
                    friend_id: true,
                    sender_id: true,
                    sender: {select: {user_id: true, username: true}},
                    receiver: {select: {user_id: true, username: true}}
                },
                orderBy: {friend_id: 'asc'}
              })
            : [];

        // key order matches the old SELECT list: friend_id, username, user_id
        const currFriends = rows.map((r) => {
            const other = r.sender_id === user_id ? r.receiver : r.sender;
            return {friend_id: r.friend_id, username: other.username, user_id: other.user_id};
        });

        return res.status(200).json({success: true, message: "updated current friends list", currFriends:currFriends});
    } catch (err) {
        console.log("Error while displaying friends: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

});
router.get("/incomingRequests/:user_id", async(req: Request<{user_id:string}>, res: Response<GetIncFriendsResponse>) => {
    const user_id = Number(req.params.user_id);
    try {
        // user is the receiver and returns all PENDING
        const rows = Number.isInteger(user_id)
            ? await prisma.friends.findMany({
                where: {receiver_id: user_id, status: "pending"},
                select: {friend_id: true, sender: {select: {user_id: true, username: true}}},
                orderBy: {friend_id: 'asc'}
              })
            : [];

        // key order matches the old SELECT list: friend_id, user_id, username
        const incomingRequests = rows.map((r) => ({
            friend_id: r.friend_id,
            user_id: r.sender.user_id,
            username: r.sender.username
        }));

        return res.status(200).json({success: true, message: "updated incoming friend requests list", incomingRequests});
    } catch (err) {
        console.log("Error while displaying incoming friend requests: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
router.get("/outgoingRequests/:user_id", async (req: Request<{user_id:string}>, res: Response<GetOutFriendsResponse>) => {
    const user_id = Number(req.params.user_id);
    try {
        // user is the sender and returns all PENDING
        const rows = Number.isInteger(user_id)
            ? await prisma.friends.findMany({
                where: {sender_id: user_id, status: "pending"},
                select: {friend_id: true, receiver: {select: {user_id: true, username: true}}},
                orderBy: {friend_id: 'asc'}
              })
            : [];

        // key order matches the old SELECT list: friend_id, user_id, username
        const outgoingRequests = rows.map((r) => ({
            friend_id: r.friend_id,
            user_id: r.receiver.user_id,
            username: r.receiver.username
        }));

        return res.status(200).json({success: true, message: "updated outgoing friend requests list", outgoingRequests});
    } catch (err) {
        console.log("Error while displaying outgoing friend requests: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;
