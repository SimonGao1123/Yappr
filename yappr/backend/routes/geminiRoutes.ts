import express from 'express';
import prisma from '../prisma.js';
import type {Request, Response} from 'express';
import { getIO } from '../socketInstance.js';
import { messageSelect, toSocketPayload } from '../messagePayload.js';

import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv"; // to get api key
import path from 'path';
import { fileURLToPath } from 'url';
import type { PromptGeminiInput } from '../../definitions/messagingTypes.js';
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
        const randChat = await prisma.randomChats.findFirst({
            where: {chat_id, OR: [{user_id_1: user_id}, {user_id_2: user_id}]}
        });
        const membership = await prisma.chat_Users.findFirst({
            where: {chat_id, user_id}
        });
        if (!randChat && !membership) {
            // user is not in chat
            return res.status(401).json({success: false, message: "User is not in the chat"});
        }

        const isRandom = randChat ? 1 : 0;

        const promptRow = await prisma.messages.create({
            data: {chat_id, sender_id: user_id, message: prompt, askGemini: 1, random_chat: isRandom},
            select: messageSelect
        });
        // Emit the user's prompt message immediately (before AI responds)
        try { getIO().to(`chat:${chat_id}`).emit('new-message', toSocketPayload(promptRow)); } catch {}

        const model = genAI.getGenerativeModel({model: "gemini-3.1-flash-lite"});

        const systemPrompt = `You are a helpful assistant in a chat application. Provide a quick, concise response to the user's question.

IMPORTANT CONSTRAINTS:
- Maximum 3 sentences
- Maximum 30 words
- Be clear and direct
- No preamble or extra explanation

User Question: ${prompt}`;

        const result = await model.generateContent(systemPrompt);
        const text = result.response.text();

        const aiRow = await prisma.messages.create({
            data: {
                chat_id,
                sender_id: -1,
                message: `Gemini Response to ${username}'s prompt: ${text}`,
                askGemini: 1,
                random_chat: isRandom
            },
            select: messageSelect
        });
        // sender_id=-1 resolves to the seeded "server" user, but this emit has
        // always labelled the AI reply 'Gemini' regardless — keep that.
        try {
            getIO().to(`chat:${chat_id}`).emit('new-message', {
                ...toSocketPayload(aiRow),
                username: 'Gemini'
            });
        } catch {}

        res.status(200).json({success: true, message: "Prompt successfully processed"});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;