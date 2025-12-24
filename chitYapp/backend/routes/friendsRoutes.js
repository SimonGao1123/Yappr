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
                'UPDATE Friends SET status=?, updated_at = CURDATE() WHERE friend_id = ?',
                ["pending", rowsCurrStatus[0].friend_id]
            )
            return res.status(201).json({success: true, message: `Successfully sent friend request to ${usernameReceiver}`});
        }
        else if (swappedRowsCurrStatus[0]?.status === "unfriended" || swappedRowsCurrStatus[0]?.status === "rejected") {
            await db.promise().query(
                'UPDATE Friends SET status=?, sender_id=?, receiver_id=?, updated_at = CURDATE() WHERE friend_id = ?',
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

export default router;