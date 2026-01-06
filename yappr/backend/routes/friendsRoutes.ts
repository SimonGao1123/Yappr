import express from 'express';
import db from '../database.js';
import type {Request, Response} from 'express';
import { io } from '../server.js';
const router = express.Router();

import type { CancelRequestInput, FriendRequestQuery, CheckIfUsernameOrID, CurrStatus, AcceptRejectRequestInput, SendRequestInput, UnfriendInput, CurrOutIncFriendsQuery, GetCurrFriendsResponse, GetIncFriendsResponse, GetOutFriendsResponse } from '../../definitions/friendsTypes.js';
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
        const [ifUsername] = await db.execute<CheckIfUsernameOrID[]>(
            'SELECT user_id FROM Users WHERE username = ?', [receiver_id]
        ); // ifUsername/ifId will be [rows, fields] (2d array)
        // assume receiver_id is an id
        const [ifId] = await db.execute<CheckIfUsernameOrID[]>(
            'SELECT username, user_id FROM Users WHERE user_id = ?', [receiver_id]
        );

        if (ifUsername.length !== 0) { // receiver_id is a username
            idReceiver = ifUsername[0]!.user_id;
            usernameReceiver = String(receiver_id);
        }
        else if (ifId.length !== 0) { // if receiver_id is a id
            idReceiver = Number(receiver_id);
            usernameReceiver = String(ifId[0]!.username);
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

        const [rowsCurrStatus] = await db.execute<CurrStatus[]>(
            'SELECT friend_id, status FROM Friends WHERE sender_id = ? AND receiver_id = ?',
            [sender_id, idReceiver]
        );
        
        const [swappedRowsCurrStatus] = await db.execute<CurrStatus[]>(
            'SELECT friend_id, status FROM Friends WHERE sender_id = ? AND receiver_id = ?',
            [idReceiver, sender_id]
        );

        if (rowsCurrStatus.length === 0 && swappedRowsCurrStatus.length === 0) {
            // no existing request
            await db.query(
                'INSERT INTO Friends (sender_id, receiver_id, status) VALUES (?, ?, ?)',
                [sender_id, idReceiver, "pending"]
            );
            // Notify the receiver of new friend request
            io.to(`user_${idReceiver}`).emit('friendUpdate', { type: 'newRequest' });
            io.to(`user_${sender_id}`).emit('friendUpdate', { type: 'sentRequest' });
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        }

        if (rowsCurrStatus[0]?.status === "pending" || swappedRowsCurrStatus[0]?.status === "pending") {
            return res.status(401).json({success: false, message: "friend request already active"});
        }
        else if (rowsCurrStatus[0]?.status === "accepted" || swappedRowsCurrStatus[0]?.status === "accepted") {
            return res.status(401).json({success: false, message: "User is already friends with you"});
        }
        else if (rowsCurrStatus[0]?.status === "unfriended" || rowsCurrStatus[0]?.status === "rejected") {
            await db.query(
                'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
                ["pending", rowsCurrStatus[0].friend_id]
            )
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        }
        else if (swappedRowsCurrStatus[0]?.status === "unfriended" || swappedRowsCurrStatus[0]?.status === "rejected") {
            await db.query(
                'UPDATE Friends SET status=?, sender_id=?, receiver_id=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
                ["pending", sender_id, idReceiver, swappedRowsCurrStatus[0].friend_id]
            )
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
        const [rows] = await db.execute<FriendRequestQuery[]>(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (rows[0]!.status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (rows[0]!.receiver_id !== receiver_id) {
            return res.status(401).json({success: false, message: `You don't have a friend request to ${receiver_username}`});
        }

        await db.query(
            'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
            ["rejected", friend_id]
        );
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
        const [rows] = await db.execute<FriendRequestQuery[]>(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (rows[0]!.status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (rows[0]!.sender_id !== sender_id) {
            return res.status(401).json({success: false, message: `${sender_username} does not have a friend request directed towards you`});
        }

        await db.query(
            'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
            ["rejected", friend_id]
        );
        // Notify sender that request was rejected
        io.to(`user_${sender_id}`).emit('friendUpdate', { type: 'requestRejected' });
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
        const [rows] = await db.execute<FriendRequestQuery[]>(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (rows[0]!.status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (rows[0]!.sender_id !== sender_id) {
            return res.status(401).json({success: false, message: `${sender_username} does not have a friend request directed towards you`});
        }

        await db.query(
            'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
            ["accepted", friend_id]
        );
        // Notify both users that they are now friends
        const receiver_id = rows[0]!.receiver_id;
        io.to(`user_${sender_id}`).emit('friendUpdate', { type: 'requestAccepted' });
        io.to(`user_${receiver_id}`).emit('friendUpdate', { type: 'newFriend' });
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
        const [rows] = await db.execute<FriendRequestQuery[]>(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend not found"});
        }
        if (rows[0]!.status !== "accepted") {
            return res.status(401).json({success: false, message: "Currently not friends with user"});
        }

        await db.query(
            'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
            ["unfriended", friend_id]
        );
        return res.status(201).json({success: true, message: `Successfully unfriended ${other_user_username}`});
    } catch (err) {
        console.log("Error while unfriending: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

// return array of objects including their username, user_id, and friend_id
router.get("/currFriends/:user_id", async(req: Request<{user_id:number}>, res: Response<GetCurrFriendsResponse>) => {
    const user_id = req.params.user_id; // gets the current user logged in id

    try {
        const [currFriends] = await db.execute<CurrOutIncFriendsQuery[]>(
            
            'SELECT f.friend_id, u.username, u.user_id FROM Friends f JOIN Users u ON u.user_id=CASE WHEN f.sender_id=? THEN f.receiver_id ELSE f.sender_id END WHERE (f.sender_id=? OR f.receiver_id=?) AND status="accepted"'
            , [user_id, user_id, user_id]
        )

        return res.status(200).json({success: true, message: "updated current friends list", currFriends:currFriends});
    } catch (err) {
        console.log("Error while displaying friends: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
    
});
router.get("/incomingRequests/:user_id", async(req: Request<{user_id:number}>, res: Response<GetIncFriendsResponse>) => {
    const user_id = req.params.user_id;
    try {
        // user is the receiver and returns all PENDING
        const [rows] = await db.execute<CurrOutIncFriendsQuery[]>(
            'SELECT f.friend_id, u.user_id, u.username FROM Friends f JOIN Users u ON f.sender_id=u.user_id WHERE receiver_id=? AND status="pending"',
            [user_id]
        );

        return res.status(200).json({success: true, message: "updated incoming friend requests list", incomingRequests: rows});
    } catch (err) {
        console.log("Error while displaying incoming friend requests: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
router.get("/outgoingRequests/:user_id", async (req: Request<{user_id:number}>, res: Response<GetOutFriendsResponse>) => {
    const user_id = req.params.user_id;
    try {
        // user is the sender and returns all PENDING
        const [rows] = await db.execute<CurrOutIncFriendsQuery[]>(
            'SELECT f.friend_id, u.user_id, u.username FROM Friends f JOIN Users u ON f.receiver_id=u.user_id WHERE f.sender_id=? AND status="pending"',
            [user_id]
        );

        return res.status(200).json({success: true, message: "updated outgoing friend requests list", outgoingRequests: rows});
    } catch (err) {
        console.log("Error while displaying outgoing friend requests: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;