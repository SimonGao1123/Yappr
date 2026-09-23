import express from 'express';
import type {Request, Response} from 'express';
import prisma from '../prisma.js';
import { messageSelect, toMessagePayload, toSocketPayload } from '../messagePayload.js';

import type { SendMessageInput, DeleteMessageInput, ReadMessagesInput, GetMessagesResponse } from '../../definitions/messagingTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import { getIO } from '../socketInstance.js';

const router = express.Router();

// USE MESSAGE ID TO DELETE USERS

router.post("/sendMessage", async (req: Request<{},{},SendMessageInput>, res: Response<standardResponse>) => {
    const {chat_id, message, user_id} = req.body;
    if (!message || !chat_id || !user_id) {
        return res.status(401).json({success: false, message: "Not a valid message"});
    }

    try {
        // check if user is in the chat
        const membership = await prisma.chat_Users.findFirst({
            where: {chat_id, user_id}
        });
        if (!membership) {
            // user is not in chat
            return res.status(401).json({success: false, message: "User is not in the chat"});
        }

        const created = await prisma.messages.create({
            data: {chat_id, sender_id: user_id, message},
            select: messageSelect
        });

        // Emit new message to all clients in this chat room
        try { getIO().to(`chat:${chat_id}`).emit('new-message', toSocketPayload(created)); } catch {}

        return res.status(201).json({success: true, message: "Sent message"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

// CAN BE USED TO DELETE RANDOM CHAT MESSAGES
router.post("/deleteMessage", async (req: Request<{},{},DeleteMessageInput>, res: Response<standardResponse>) => {
    const {message_id, user_id, sender_id, chat_id} = req.body;

    // check user is the sender
    if (user_id !== sender_id) return res.status(401).json({success: false, message: "cannot delete someone else's message"});

    try {
        // check if message exists/is already deleted
        const row = await prisma.messages.findUnique({
            where: {message_id},
            select: {sender_id: true, chat_id: true, deleted: true}
        });

        if (!row || row.deleted) {
            return res.status(401).json({success: false, message: "message doesn't exist"});
        }
        if (row.sender_id !== sender_id) {
            return res.status(401).json({success: false, message: "this is not message from sender"});
        }
        if (row.chat_id !== chat_id) {
            return res.status(401).json({success: false, message: "message is in a different chat"});
        }

        await prisma.messages.update({
            where: {message_id},
            data: {deleted: 1}
        });
        return res.status(201).json({success: true, message: "Successfully delete message"});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

});

// returns messages for ALL chats
router.get("/getMessages/:user_id", async (req: Request<{user_id: string}>, res: Response<GetMessagesResponse>) => {
    const user_id = Number(req.params.user_id);

    try {
        const allChatsWithUser = Number.isInteger(user_id)
            ? await prisma.chat_Users.findMany({
                where: {user_id},
                select: {chat_id: true}
              })
            : [];

        const messageData = [];
        for (const chat of allChatsWithUser) {

            // only saves past 100 messages
            const rows = await prisma.messages.findMany({
                where: {random_chat: 0, chat_id: chat.chat_id, deleted: 0},
                select: messageSelect,
                orderBy: {message_id: 'asc'},
                take: 100
            }); // good practice, select username and id at same time

            messageData.push({chat_id: chat.chat_id, messageData: rows.map(toMessagePayload)});
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
        const row = await prisma.messages.findFirst({
            where: {chat_id, deleted: 0, random_chat: 0},
            select: {message_id: true},
            orderBy: {message_id: 'desc'}
        });

        if (!row) {
            return res.status(201).json({success: true, message: "no messages in chat"});
        }

        await prisma.chat_Users.updateMany({
            where: {user_id, chat_id},
            data: {last_seen_message_id: row.message_id}
        });
        return res.status(201).json({success: true, message: `successfully read chat, new message id: ${row.message_id}`});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});




export default router;
