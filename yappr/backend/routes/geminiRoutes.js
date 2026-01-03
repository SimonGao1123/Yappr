import express from 'express';
import db from '../database.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv"; // to get api key

dotenv.config();

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


router.post("/prompt", async (req, res) => {
    const {prompt, chat_id, user_id, username} = req.body;

    if (!prompt || !chat_id || !user_id) {
        return res.status(400).json({success: false, message: "Invalid prompt"});
    }

    try {
        // check if user is in the chat
        const [rows] = await db.promise().query(
            'SELECT * FROM Chat_Users WHERE chat_id=? AND user_id=?',
            [chat_id, user_id]
        );
        if (rows.length === 0) {
            // user is not in chat
            return res.status(401).json({success: false, message: "User is not in the chat"});
        }

        await db.promise().query(
            'INSERT INTO Messages (chat_id, sender_id, message, askGemini) VALUES (?, ?, ?, TRUE)',
            [chat_id, user_id, prompt]
        );

        const model = genAI.getGenerativeModel({model: "gemma-3-4b-it"}); // can switch to better model later

        const systemPrompt = `You are a helpful assistant in a chat application. Provide a quick, concise response to the user's question.

IMPORTANT CONSTRAINTS:
- Maximum 3 sentences
- Maximum 30 words
- Be clear and direct
- No preamble or extra explanation

User Question: ${prompt}`; // can update prompt for more accurate answers

        const result = await model.generateContent(systemPrompt);
        const text = result.response.text();

        await db.promise().query(
            "INSERT INTO Messages (chat_id, sender_id, message, askGemini) VALUES(?,?,?,TRUE)",
            [chat_id, -1, `Gemini Response to ${username}'s prompt: ${text}`]
        );

        // front end check if sender_id is === -1 and if askGemini is true then its gemini response

        res.status(200).json({success: true, message: "Prompt successfully processed"});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;