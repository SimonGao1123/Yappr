import express from 'express';
import db from '../database.js';
import { use } from 'react';

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
    const {user_id, username, chat_id, creator_id} = req.body;

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

        if (creator_id === user_id) {
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
    const {user_id, chat_id, creator_id} = req.body; // creator id from chat_data
    try {
        
        if (user_id !== creator_id) return res.status(401).json({success: false, message: "User is not the creator"});

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


// returns chat_id and each member (display status of each member to curr member)
router.get("/displayChats/:user_id", async (req, res) => {
    const user_id = req.params.user_id;

    try {
        const ChatIdQuery = await db.promise().query(
            'SELECT chat_id FROM Chat_Users WHERE user_id=?',
            [user_id]
        );
        const allChatIdWithUser = ChatIdQuery[0]; // array of objects {chat_id} for each chat the user is in
        if (allChatIdWithUser.length === 0) {
            return res.status(201).json({success: true, message: "No chats"});
        }

        const chatsData = [];
        
        // ARRAYS OF OBJECTS 

        for (const chat of allChatIdWithUser) {
            const currChat = {};

            // obtain users
            const users = await db.promise().query(
                'SELECT user_id FROM Chat_Users WHERE chat_id=?',
                [chat.chat_id]
            ); // obtains all the users in the specific chat

            const allUsers = users[0]; 

            // obtain username of that user and the status with the user, (friends, Pending Incoming Req, Pending Outgoing Req, None)
            for (let i = 0; i < allUsers.length; i++) {
                const username = await db.promise().query(
                    'SELECT username FROM Users WHERE user_id = ?',
                    [allUsers[i].user_id]
                );

                
                const checkStatus = await db.promise().query(
                    'SELECT status, sender_id, receiver_id, friend_id FROM Friends WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)',
                    [user_id, allUsers[i].user_id, allUsers[i].user_id, user_id]
                ) // if they already are friends only one possibility 
                let status = "none";
                let friend_id = null;

                if (checkStatus[0].length > 0) {
                    const row = checkStatus[0][0];
                    friend_id = row.friend_id;

                    if (row.status === "accepted") {
                        status = "friends";
                    } else if (row.status === "pending" && row.sender_id === Number(user_id)) {
                        status = "outgoing";
                    } else if (row.status === "pending" && row.receiver_id === Number(user_id)) {
                        status = "incoming";
                    }
                }

                allUsers[i].friend_id = friend_id;
                
                allUsers[i].status = status;
                allUsers[i].username = username[0][0].username;
                // now all Users stores array of objects of {username, user_id}
            }

            // now get creator id and chat name

            const chatData = await db.promise().query(
                'SELECT creator_id, chat_name FROM Chats WHERE chat_id=?',
                [chat.chat_id]
            );
            const rowChatData = chatData[0];
            const usernameLeader = await db.promise().query(
                'SELECT username FROM Users WHERE user_id = ?',
                [rowChatData[0].creator_id]
            );

            currChat.creator_id = rowChatData[0].creator_id;
            currChat.creator_username = usernameLeader[0][0].username;
            currChat.chat_name = rowChatData[0].chat_name;

            currChat.userList = allUsers;
            currChat.chat_id = chat.chat_id;

            chatsData.push(currChat);
        }

        return res.status(201).json({success: true, message: "Successfully retreived user chats",
                chat_data: chatsData
        });


    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    } 
});


router.post("/addToChat", async (req, res) => {
    // max 15 members to chat
    const {username, user_id, addedFriends, chat_id} = req.body;
    // added friends is array of objects {user_id, username, friend_id}
    console.log(chat_id);
    try {
        const currUsers = await db.promise().query(
            'SELECT user_id FROM Chat_Users WHERE chat_id=?',
            [chat_id]
        );
        console.log(currUsers[0]);
        // check if user is in the group
        if (!currUsers[0].some((user) => user.user_id === user_id)) return res.status(401).json({success: false, message: "User not in the group"});

        // check overflow
        if (currUsers[0].length + addedFriends.length > 15) return res.status(401).json({success: false, message: "Maximum 15 people per chat"});

        // check if all users are actually friends and if they're already in the group
        
        for (const friend of addedFriends) {
            const checkExistingFriendship = await db.promise().query(
                'SELECT friend_id FROM Friends WHERE friend_id=? AND status="accepted" AND (sender_id=? OR receiver_id=?)',
                [friend.friend_id, user_id, user_id]
            );

            const checkExistingMembership = await db.promise().query(
                'SELECT chat_user_id FROM Chat_Users WHERE chat_id=? AND user_id=?',
                [chat_id, friend.user_id]
            );
            if (checkExistingFriendship[0].length === 0) {
                return res.status(401).json({success: false, message: `User ${friend.username} is not friends with you`});
            }
            if (checkExistingMembership[0].length > 0) {
                return res.status(401).json({success: false, message: `User ${friend.username} is already in the group`});
            }
        }

        // add users to Chat_Users with chat_id
        const finalMessage = []; // will return an array of messages for each memeber added by the user

        for (const friend of addedFriends) {
            await db.promise().query(
                'INSERT INTO Chat_Users (chat_id, user_id) VALUES (?, ?)',
                [chat_id, friend.user_id]
            );
            finalMessage.push(`${username} has added ${friend.username} to the chat`);
        }
        return res.status(201).json({success: true, message: finalMessage});
        // note if success is true then message will be an array
        
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/kick", async (req, res) => {
    const {creator_id, user_id, user_username, kicked_id, kicked_username, chat_id} = req.body;

    try {
        // check if user is the creator
        if (creator_id !== user_id) {
            return res.status(401).json({success: false, message: "user is not the leader, cannot kick"});
        }
        // cannot kick yourself
        if (user_id === kicked_id) {
            return res.status(401).json({success: false, message: "cannot kick yourself"});
        }
        // check if kick_id is in the group
        const kickInGroup = await db.promise().query(
            'SELECT chat_user_id FROM Chat_Users WHERE user_Id=? AND chat_id=?',
            [kicked_id, chat_id]
        );
        if (kickInGroup[0].length === 0) {
            return res.status(401).json({success: false, message: `${kicked_username} is not in the group`});
        }

        await db.promise().query(
            'DELETE FROM Chat_Users WHERE chat_id=? AND user_id=?',
            [chat_id, kicked_id]
        );
        return res.status(201).json({success: true, message: `${kicked_username} was kicked by ${user_username}`});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;