import express from 'express';
import db from '../database.js';

const router = express.Router();

router.post("/createChat", async (req, res) => {
    const {creator_id, addedFriends, chat_name} = req.body;
    if (addedFriends.length > 14) return res.status(401).json({success: false, message: "Maximum of 15 members"});
    // addedFriends will be array of objects
    // {username, user_id, friend_id}
    if (!creator_id) return res.status(401).json({success: false, message: "Invalid creator id"});
    if (!chat_name) return res.status(401).json({success: false, message: "Invalid chat name"});
    if (addedFriends.length === 0) return res.status(401).json({success: false, message: "Cannot make a chat by yourself"});
    try {
        const [results] = await db.promise().query(
            'INSERT INTO Chats (creator_id, chat_name) VALUES (?, ?)',
            [creator_id, chat_name]
        );

        const insertedId = results.insertId; // automatically gives primary key value of the inserted value
        // will be the chatId of Chat_Users for each user

        await db.promise().query(
            'INSERT INTO Chat_Users (chat_id, user_id) VALUES (?, ?)',
            [insertedId, creator_id]
        );
        for (const friend of addedFriends) {
            const {username, user_id, friend_id} = friend;
            // Check if friends (might not be necessary)
            
            const [rows] = await db.promise().query(
                'SELECT friend_id FROM Friends WHERE friend_id=? AND status="accepted"',
                [friend_id]
            );
            if (rows.length === 0) {
                return res.status(401).json({success: false, message: `${username} is not your friend`});
            }

            await db.promise().query(
                'INSERT INTO Chat_Users (chat_id, user_id) VALUES (?, ?)',
                [insertedId, user_id]
            );
        }
        return res.status(201).json({success: true, message: `Successfully created ${chat_name}`})

    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/leaveChat", async (req, res) => {
    const {user_id, username, chat_id} = req.body;

    console.log("user: ", user_id);
    try {
        // check if user is in the group
        const usersInGroup = await db.promise().query(
            'SELECT user_id FROM Chat_Users WHERE chat_id=?',
            [chat_id]
        );
        const rowsUsersInGroup = usersInGroup[0]; // array of objects where each object is just {user_id}
        console.log(rowsUsersInGroup); // TESTING
        if (!rowsUsersInGroup.some((user) => user.user_id === user_id)) {
            return res.status(401).json({success: false, message: "User is not in group"});
        }

        if (rowsUsersInGroup.length === 1) {
            // only user is left
            await db.promise().query(
                'DELETE FROM Chat_Users WHERE chat_id=?', [chat_id]
            );
            await db.promise().query(
                'DELETE FROM Chats WHERE chat_id=?', [chat_id]
            );
            
            return res.status(201).json({success: true, message: "Successfully deleted group"});
        }
        // check if user is leader, then pass on leadership
        const [rows] = await db.promise().query(
            'SELECT creator_id FROM Chats WHERE chat_id=?',
            [chat_id]
        );

        if (rows[0].creator_id === user_id) {
            await db.promise().query(
                'UPDATE Chats SET creator_id=? WHERE chat_id=?',
                [rowsUsersInGroup[1].user_id, chat_id]
            ); // original creator always will be index 0 of rowsUsersInGroup
            await db.promise().query(
                'DELETE FROM Chat_Users WHERE user_id = ? AND chat_id = ?',
                [user_id, chat_id]
            ); // then delete creator for members list  

            const newLeaderUsername = await db.promise().query(
                'SELECT username FROM Users WHERE user_id = ?',
                [rowsUsersInGroup[1].user_id]
            );
            return res.status(201).json({success: true, message: `${username} has left the chat, ${newLeaderUsername[0][0].username} is the new leader`}); 
        }

        // just normal member and not only member
        await db.promise().query(
            'DELETE FROM Chat_Users WHERE user_id=? AND chat_id=?',
            [user_id, chat_id]
        );
        return res.status(201).json({success: true, message: `${username} has left the chat`});

    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

// only can be done by creator
router.post("/deleteChat", async (req, res) => {
    const {user_id, chat_id} = req.body;

    try {
        // check if user is the creator
        const [rows] = await db.promise().query(
            'SELECT chat_id FROM Chats WHERE creator_id=? AND chat_id=?',
            [user_id, chat_id]
        );
        if (rows.length === 0) return res.status(401).json({success: false, message: "User is not the creator"});

        await db.promise().query(
            'DELETE FROM Chat_Users WHERE chat_id = ?',
            [chat_id]
        );
        await db.promise().query(
            'DELETE FROM Chats WHERE chat_id = ?',
            [chat_id]
        ); // delete members from chat and delete chat itself
        return res.status(201).json({success: true, message: "Successfully deleted chat"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

// TODO: 

// returns chat_id and each member (display status of each member to curr member)
router.get("/displayChats", async (req, res) => {

});

router.post("/addToChat", async (req, res) => {
    // max 15 members to chat
});

router.post("/kickFromChat", async (req, res) => {

});
export default router;