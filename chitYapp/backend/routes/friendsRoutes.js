import express from 'express';
import db from '../database.js';

const router = express.Router();
/* 
    POSSIBLE STATUS: 
        - pending
        - rejected
        - accepted
        - unfriended
*/

router.post("/sendFriendRequest", async (req, res) => {
    const {sender_id, receiver_id} = req.body;
    let usernameReceiver; // stores username of user receiving request
    let idReceiver;

    try {
        if (!receiver_id) {
            return res.status(401).json({success: false, message: "Invalid User ID/Username"});
        }

        // Check if receiver_id is a username or id
        const ifUsername = await db.promise().query(
            'SELECT user_id FROM Users WHERE username = ?', [receiver_id]
        ); // ifUsername/ifId will be [rows, fields] (2d array)
        // assume receiver_id is an id
        const ifId = await db.promise().query(
            'SELECT username, user_id FROM Users WHERE user_id = ?', [receiver_id]
        );

        console.log(ifUsername[0]);
        console.log(ifId[0]);

        if (ifUsername[0].length !== 0) { // receiver_id is a username
            idReceiver = ifUsername[0][0].user_id;
            usernameReceiver = receiver_id;
        }
        else if (ifId[0].length !== 0) { // if receiver_id is a id
            idReceiver = receiver_id;
            usernameReceiver = ifId[0][0].username;
        }
        else {
            return res.status(401).json({success: false, message: "User doesn't exist"});
        }

        if (Number(idReceiver) === sender_id) {
            return res.status(401).json({success: false, message: "Cannot send friend request to yourself"});
        }

        const checkCurrStatus = await db.promise().query(
            'SELECT friend_id, status FROM Friends WHERE sender_id = ? AND receiver_id = ?',
            [sender_id, idReceiver]
        );
        const rowsCurrStatus = checkCurrStatus[0];
        
        const swappedCurrStatus = await db.promise().query(
            'SELECT friend_id, status FROM Friends WHERE sender_id = ? AND receiver_id = ?',
            [idReceiver, sender_id]
        );
        const swappedRowsCurrStatus = swappedCurrStatus[0];

        // TEST:
        console.log("rows curr", rowsCurrStatus);
        console.log("swapped rows", swappedRowsCurrStatus);

        if (rowsCurrStatus.length === 0 && swappedRowsCurrStatus.length === 0) {
            // no existing request
            await db.promise().query(
                'INSERT INTO Friends (sender_id, receiver_id, status) VALUES (?, ?, ?)',
                [sender_id, idReceiver, "pending"]
            );
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        }

        if (rowsCurrStatus[0]?.status === "pending" || swappedRowsCurrStatus[0]?.status === "pending") {
            return res.status(401).json({success: false, message: "friend request already active"});
        }
        else if (rowsCurrStatus[0]?.status === "accepted" || swappedRowsCurrStatus[0]?.status === "accepted") {
            return res.status(401).json({success: false, message: "User is already friends with you"});
        }
        else if (rowsCurrStatus[0]?.status === "unfriended" || rowsCurrStatus[0]?.status === "rejected") {
            await db.promise().query(
                'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
                ["pending", rowsCurrStatus[0].friend_id]
            )
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        }
        else if (swappedRowsCurrStatus[0]?.status === "unfriended" || swappedRowsCurrStatus[0]?.status === "rejected") {
            await db.promise().query(
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
router.post("/cancel", async (req, res) => {
    const {friend_id, receiver_id, receiver_username} = req.body;

    // USER IS SENDER
    try {
        const [rows] = await db.promise().query(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (rows[0].status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (rows[0].receiver_id !== receiver_id) {
            return res.status(401).json({success: false, message: `You don't have a friend request to ${receiver_username}`});
        }

        await db.promise().query(
            'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
            ["rejected", friend_id]
        );
        return res.status(201).json({success: true, message: `Successfully cancelled request towards ${receiver_username}`});
    } catch (err) {
        console.log("Error while cancelling friend request: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
router.post("/reject", async (req, res) => {
    const {friend_id, sender_username, sender_id} = req.body; // user is the receiver

    // only valid for pending requests
    try {
        const [rows] = await db.promise().query(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (rows[0].status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (rows[0].sender_id !== sender_id) {
            return res.status(401).json({success: false, message: `${sender_username} does not have a friend request directed towards you`});
        }

        await db.promise().query(
            'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
            ["rejected", friend_id]
        );
        return res.status(201).json({success: true, message: `Successfully rejected ${sender_username}'s friend request`});
    } catch (err) {
        console.log("Error while rejecting friend request: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
    
});
router.post("/accept", async (req, res) => {
    const {friend_id, sender_username, sender_id} = req.body; // user is the receiver

    // only valid for pending requests
    try {
        const [rows] = await db.promise().query(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend request not found"});
        }
        if (rows[0].status !== "pending") {
            return res.status(401).json({success: false, message: "Friend request is not pending"});
        }
        if (rows[0].sender_id !== sender_id) {
            return res.status(401).json({success: false, message: `${sender_username} does not have a friend request directed towards you`});
        }

        await db.promise().query(
            'UPDATE Friends SET status=?, updated_at = CURRENT_TIMESTAMP WHERE friend_id = ?',
            ["accepted", friend_id]
        );
        return res.status(201).json({success: true, message: `Successfully accepted ${sender_username}'s friend request`});
    } catch (err) {
        console.log("Error while accepting friend request: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/unfriend", async(req, res) => {
    const {friend_id, other_user_username, other_user_id} = req.body; // user can be receiver or sender

    // only valid for accepted
    try {
        const [rows] = await db.promise().query(
            'SELECT status, sender_id, receiver_id FROM Friends WHERE friend_id=?',
            [friend_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Friend not found"});
        }
        if (rows[0].status !== "accepted") {
            return res.status(401).json({success: false, message: "Currently not friends with user"});
        }

        await db.promise().query(
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
router.get("/currFriends/:user_id", async(req, res) => {
    const user_id = req.params.user_id; // gets the current user logged in id

    try {
        const userSender = await db.promise().query(
            'SELECT friend_id, receiver_id FROM Friends WHERE sender_id=? AND status="accepted"',
            [user_id]
        );
        const userReceiver = await db.promise().query(
            'SELECT friend_id, sender_id FROM Friends WHERE receiver_id=? AND status="accepted"',
            [user_id]
        ); 

        const rowsUserSender = userSender[0];
        const rowsUserReceiver = userReceiver[0];

        const currFriends = []; // to be returned
        
        for (const friends of rowsUserSender) {
            // friends will store friend_id and receiver_id (where user_id is the sender)
            const [rows] = await db.promise().query(
                'SELECT username FROM Users WHERE user_id = ?',
                [friends.receiver_id]
            );
            currFriends.push(
                {
                    username: rows[0].username, 
                    user_id: friends.receiver_id, 
                    friend_id: friends.friend_id
                }
            );
        }
        for (const friends of rowsUserReceiver) {
            // friends will store friend_id and sender_id (where user_id is the receiver)
            const [rows] = await db.promise().query(
                'SELECT username FROM Users WHERE user_id = ?',
                [friends.sender_id]
            );
            currFriends.push(
                {
                    username: rows[0].username, 
                    user_id: friends.sender_id, 
                    friend_id: friends.friend_id
                }
            );
        }

        return res.status(200).json({success: true, message: "updated current friends list", currFriends:currFriends});
    } catch (err) {
        console.log("Error while displaying friends: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
    
});
router.get("/incomingRequests/:user_id", async(req, res) => {
    const user_id = req.params.user_id;
    try {
        // user is the receiver and returns all PENDING
        const incomingReq = await db.promise().query(
            'SELECT friend_id, sender_id FROM Friends WHERE receiver_id=? AND status="pending"',
            [user_id]
        );
        const rowsIncomReq = incomingReq[0];

        const allRequests = [];

        for (const incoming of rowsIncomReq) {
            const [rows] = await db.promise().query(
                'SELECT username FROM Users WHERE user_id =?',
                [incoming.sender_id]
            );
            allRequests.push(
                {
                    username: rows[0].username,
                    user_id: incoming.sender_id,
                    friend_id: incoming.friend_id
                }
            );
        }

        return res.status(200).json({success: true, message: "updated incoming friend requests list", incomingRequests: allRequests});
    } catch (err) {
        console.log("Error while displaying incoming friend requests: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
router.get("/outgoingRequests/:user_id", async (req, res) => {
    const user_id = req.params.user_id;
    try {
        // user is the sender and returns all PENDING
        const outgoingReq = await db.promise().query(
            'SELECT friend_id, receiver_id FROM Friends WHERE sender_id=? AND status="pending"',
            [user_id]
        );
        const rowsOutReq = outgoingReq[0];

        const allRequests = [];

        for (const outgoing of rowsOutReq) {
            const [rows] = await db.promise().query(
                'SELECT username FROM Users WHERE user_id =?',
                [outgoing.receiver_id]
            );
            allRequests.push(
                {
                    username: rows[0].username,
                    user_id: outgoing.receiver_id,
                    friend_id: outgoing.friend_id
                }
            );
        }

        return res.status(200).json({success: true, message: "updated outgoing friend requests list", outgoingRequests: allRequests});
    } catch (err) {
        console.log("Error while displaying outgoing friend requests: ", err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;