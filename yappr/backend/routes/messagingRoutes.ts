import express from 'express';
import type {Request, Response} from 'express';
import db from '../database.js';
import mysql from 'mysql2/promise';
import { io } from '../server.js';

import type { SendMessageInput, SelectChatUsers, DeleteMessageInput, SelectIfMessageExists, ReadMessagesInput, SelectMessagesFromChat, GetAllChatsMessages, GetMessagesResponse, GetAllMessageId } from '../../definitions/messagingTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';

const router = express.Router();

// USE MESSAGE ID TO DELETE USERS 

router.post("/sendMessage", async (req: Request<{},{},SendMessageInput>, res: Response<standardResponse>) => {
    const {chat_id, message, user_id} = req.body;
    if (!message || !chat_id || !user_id) {
        return res.status(401).json({success: false, message: "Not a valid message"});
    }

    try {
        // check if user is in the chat
        const [rows] = await db.execute<SelectChatUsers[]>(
            'SELECT * FROM Chat_Users WHERE chat_id=? AND user_id=?',
            [chat_id, user_id]
        );
        if (rows.length === 0) {
            // user is not in chat
            return res.status(401).json({success: false, message: "User is not in the chat"});
        }

        await db.query(
            'INSERT INTO Messages (chat_id, sender_id, message) VALUES (?, ?, ?)',
            [chat_id, user_id, message]
        );

        // Get all users in the chat and notify them
        const [chatUsers] = await db.execute<SelectChatUsers[]>(
            'SELECT user_id FROM Chat_Users WHERE chat_id=?',
            [chat_id]
        );
        
        // Emit to all users in the chat
        chatUsers.forEach(user => {
            io.to(`user_${user.user_id}`).emit('newMessage', { chat_id });
        });

        return res.status(201).json({success: true, message: "Sent message"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/deleteMessage", async (req: Request<{},{},DeleteMessageInput>, res: Response<standardResponse>) => {
    const {message_id, user_id, sender_id, chat_id} = req.body;

    // check user is the sender
    if (user_id !== sender_id) return res.status(401).json({success: false, message: "cannot delete someone else's message"});

    try {
        // check if message exists/is already deleted
        const [rows] = await db.execute<SelectIfMessageExists[]>(
            'SELECT sender_id, chat_id, deleted FROM Messages WHERE message_id=?',
            [message_id] 
        );

        if (rows.length === 0 || rows[0]!.deleted) {
            return res.status(401).json({success: false, message: "message doesn't exist"});
        }
        if (rows[0]!.sender_id !== sender_id) {
            return res.status(401).json({success: false, message: "this is not message from sender"});
        }
        if (rows[0]!.chat_id !== chat_id) {
            return res.status(401).json({success: false, message: "message is in a different chat"});
        }

        await db.query(
            'UPDATE Messages SET deleted=1 WHERE message_id=?',
            [message_id]
        );
        return res.status(201).json({success: true, message: "Successfully delete message"});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

});

// returns messages for ALL chats
router.get("/getMessages/:user_id", async (req: Request<{user_id: number}>, res: Response<GetMessagesResponse>) => {
    const user_id = req.params.user_id;

    try {
        const [allChatsWithUser] = await db.execute<GetAllChatsMessages[]>(
            'SELECT chat_id FROM Chat_Users WHERE user_id=?',
            [user_id]
        ); 

        const messageData = [];
        for (const chat of allChatsWithUser) {

            // only saves past 100 messages
            const [rows] = await db.execute<SelectMessagesFromChat[]>(
                "SELECT m.askGemini, m.message_id, m.sender_id, m.message, u.username, m.sent_at FROM Messages m JOIN Users u ON u.user_id=m.sender_id WHERE m.chat_id=? AND m.deleted=0 ORDER BY m.message_id ASC LIMIT 100",
                [chat.chat_id]
            ); // good practice, select username and id at same time
            

            messageData.push({chat_id: chat.chat_id, messageData: rows});
        }
        
        return res.status(200).json({success: true, message: "success get messages", msgData: messageData});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

});

router.post("/readMessages", async (req: Request<{},{},ReadMessagesInput>, res: Response<standardResponse>) => {
    const {chat_id, user_id} = req.body;
    // goes into chat_users and sets last read message id to most recent message id

    try {
        if (!chat_id || !user_id) return res.status(401).json({success: false, message: "chat does't exist"});

        // get most recent message id from the chat
        const [rows] = await db.execute<GetAllMessageId[]>(
            'SELECT message_id FROM Messages WHERE chat_id=? AND deleted=0 ORDER BY message_id DESC LIMIT 1',
            [chat_id]
        );

        if (rows.length === 0) {
            return res.status(201).json({success: true, message: "no messages in chat"});
        }

        await db.query(
            'UPDATE Chat_Users SET last_seen_message_id=? WHERE user_id=? AND chat_id=?',
            [rows[0]!.message_id, user_id, chat_id]
        ); 
        return res.status(201).json({success: true, message: `successfully read chat, new message id: ${rows[0]!.message_id}`});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});




export default router;