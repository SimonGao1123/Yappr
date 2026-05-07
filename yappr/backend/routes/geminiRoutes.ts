import express from 'express';
import db from '../database.js';
import type {Request, Response} from 'express';
import { getIO } from '../socketInstance.js';
import mysql from 'mysql2/promise';

import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv"; // to get api key
import path from 'path';
import { fileURLToPath } from 'url';
import type { SelectChatUsers, PromptGeminiInput } from '../../definitions/messagingTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);


router.post("/prompt", async (req:Request<{},{},PromptGeminiInput>, res:Response<standardResponse>) => {
    const {prompt, chat_id, user_id, username} = req.body;

    if (!prompt || !chat_id || !user_id) {
        return res.status(400).json({success: false, message: "Invalid prompt"});
    }

    try {
        // check if user is in the chat
        const [ifRandChat] = await db.execute<any>(
            'SELECT * FROM RandomChats WHERE chat_id=? AND (user_id_1=? OR user_id_2=?)'
            , [chat_id, user_id, user_id]
        )
        const [rows] = await db.execute<SelectChatUsers[]>(
            'SELECT * FROM Chat_Users WHERE chat_id=? AND user_id=?',
            [chat_id, user_id]
        );
        if (ifRandChat.length === 0 && rows.length === 0) {
            // user is not in chat
            return res.status(401).json({success: false, message: "User is not in the chat"});
        }

        const [promptInsert] = await db.query(
            'INSERT INTO Messages (chat_id, sender_id, message, askGemini, random_chat) VALUES (?, ?, ?, TRUE, ?)',
            [chat_id, user_id, prompt, ifRandChat.length === 0 ? 0 : 1]
        );
        // Emit the user's prompt message immediately (before AI responds)
        const promptId = (promptInsert as any).insertId;
        const [promptRows] = await db.execute<any[]>(
            `SELECT m.message_id, m.sender_id, m.message,
                    IFNULL(u.username, 'Gemini') AS username, m.sent_at, m.askGemini
             FROM Messages m LEFT JOIN Users u ON u.user_id=m.sender_id WHERE m.message_id=?`,
            [promptId]
        );
        if (promptRows.length > 0) {
            try { getIO().to(`chat:${chat_id}`).emit('new-message', promptRows[0]); } catch {}
        }

        const model = genAI.getGenerativeModel({model: "gemma-3-4b-it"});

        const systemPrompt = `You are a helpful assistant in a chat application. Provide a quick, concise response to the user's question.

IMPORTANT CONSTRAINTS:
- Maximum 3 sentences
- Maximum 30 words
- Be clear and direct
- No preamble or extra explanation

User Question: ${prompt}`;

        const result = await model.generateContent(systemPrompt);
        const text = result.response.text();

        const [aiInsert] = await db.query(
            "INSERT INTO Messages (chat_id, sender_id, message, askGemini, random_chat) VALUES(?,?,?,TRUE, ?)",
            [chat_id, -1, `Gemini Response to ${username}'s prompt: ${text}`, ifRandChat.length === 0 ? 0 : 1]
        );
        // Emit the Gemini response (sender_id=-1, no matching Users row, username='Gemini')
        const aiId = (aiInsert as any).insertId;
        const [aiRows] = await db.execute<any[]>(
            `SELECT message_id, sender_id, message, 'Gemini' AS username, sent_at, askGemini
             FROM Messages WHERE message_id=?`,
            [aiId]
        );
        if (aiRows.length > 0) {
            try { getIO().to(`chat:${chat_id}`).emit('new-message', aiRows[0]); } catch {}
        }

        res.status(200).json({success: true, message: "Prompt successfully processed"});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;