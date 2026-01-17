import express from 'express';
import type {Request, Response} from 'express';
import db from '../database.js';
import mysql from 'mysql2/promise';
import type { standardResponse } from '../../definitions/globalType.js';
import { type GetRandomChatWithUser, type GetAvailability, type GetQueueSize, type GetRandomChat, type GetIfInChat, type GetQueueStatus } from '../../definitions/randomChatTypes.js';
import type { SelectMessagesFromChat, SendMessageInput } from '../../definitions/messagingTypes.js';
import type { AllUsersInChatQuery, CheckStatusQuery, UsernameInChatQuery } from '../../definitions/chatsTypes.js';
import { use } from 'react';

const router = express.Router();

router.post('/joinQueue', async (req: Request<{},{},{user_id: number}>, res: Response<standardResponse>) => {
    // will add the user to the queue
    const {user_id} = req.body;
    try {
        await db.query('INSERT INTO RandomChatPool (user_id) VALUES (?)',
            [user_id]
        );
        return res.status(201).json({success: true, message: "successfully joined queue"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

});


router.get('/getRandomChat/:user_id', async (req: Request<{user_id: number}>, res: Response<GetQueueStatus>) => {
    const user_id = req.params.user_id;

    try {
        const [availability] = await db.execute<GetAvailability[]>(
            'SELECT available FROM RandomChatPool WHERE user_id=?',
            [user_id]
        );
        if (availability.length == 0) {
            return res.status(201).json({success: true, message: "Currently Not in Random Chat Queue", inChat: false, waiting: false});
        }
        if (availability[0]?.available == 1) {
            // display # of ppl in queue
            const [queueSize] = await db.execute<GetQueueSize[]>(
                'SELECT COUNT(*) AS available_count FROM RandomChatPool WHERE available=TRUE'
            );
            return res.status(201).json({success: true, message: "Waiting in Queue...", waiting: true, inChat: false, queueSize: queueSize[0]?.available_count});
        }

        if (availability[0]?.available == 0) {
            // that means just added to a chat
            const [currChat] = await db.execute<GetRandomChat[]>(
                'SELECT created_at, chat_id, user_id_1, user_id_2 FROM RandomChats WHERE user_id_1=? OR user_id_2=?',
                [user_id, user_id]
            ); 
            const allUsers = [currChat[0]?.user_id_1, currChat[0]?.user_id_2];

            // stores user data for user_id_1 and user_id_2
            // user_id, friend_id, updated_at, status, username, account_created, description
            const usersData = [];
            for (let i = 0; i < allUsers.length; i++) {
                const currentUserId = allUsers[i];
                if (currentUserId === undefined) continue;
                
                const [currUserData] = await db.execute<UsernameInChatQuery[]>(
                    `
                    SELECT username, description, joined_at FROM Users WHERE user_id=? 
                    `, [allUsers[i]]
                );

                let status="none";
                let friend_id: number | undefined = undefined;
                let updated_at: string | undefined = undefined;
                const [checkFriendStatus] = await db.execute<CheckStatusQuery[]>(
                    `SELECT status, sender_id, receiver_id, friend_id, updated_at FROM Friends WHERE 
                    (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)`,
                    [user_id, allUsers[i], allUsers[i], user_id]  
                );

                if (user_id !== allUsers[i] && checkFriendStatus.length > 0) {
                    const row = checkFriendStatus[0];
                    friend_id = row?.friend_id;
                    updated_at = row?.updated_at;
                    
                    if (status==="accepted") {
                        status="friends";
                    } else if (status==="pending" && row?.sender_id===user_id && row?.receiver_id===currentUserId) {
                        status="outgoing";
                    } else if (status==="pending" && row?.sender_id===currentUserId && row?.receiver_id===user_id) {
                        status="incoming";
                    }
                } 
                const currentUser = {
                    user_id: currentUserId,
                    friend_id: friend_id,
                    updated_at: updated_at,
                    status: status,
                    username: currUserData[0]!.username,
                    account_created: currUserData[0]!.joined_at,
                    description: currUserData[0]!.description
                };
                usersData.push(currentUser);
            }

            if (typeof currChat[0]?.chat_id !== "number") {
                return res.status(404).json({success: false, message: "Chat not found", waiting: false, inChat: false});
            }
            const chatData = {chat_id: currChat[0].chat_id, created_at: currChat[0]?.created_at, userData: usersData};
            // chat which user is currently in
            const [messages] = await db.execute<SelectMessagesFromChat[]>(
                "SELECT m.askGemini, m.message_id, m.sender_id, m.message, u.username, m.sent_at FROM Messages m JOIN Users u ON u.user_id=m.sender_id WHERE m.random_chat=TRUE AND m.chat_id=? AND m.deleted=0 ORDER BY m.message_id ASC LIMIT 100",
                [currChat[0].chat_id]
            );

            return res.status(201).json({success: true, message: "Successfully Obtained Random Chat", waiting: false, inChat: true, chatData: chatData, messages: messages});
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false, message: "Internal server error",
            inChat: false,
            waiting: false
        });
    }
});

router.post("/sendMsgRandom", async (req: Request<{},{},SendMessageInput>, res: Response<standardResponse>) => {
    const {chat_id, message, user_id} = req.body;

    if (!message || !chat_id || !user_id) {
        return res.status(401).json({success: false, message: "Not a valid message"});
    }
    try {
        // check if user is in the random chat
        const [chat] = await db.execute<GetRandomChatWithUser[]>(
            `SELECT * FROM RandomChats WHERE user_id_1=? OR user_id_2=?`,
            [user_id, user_id]
        );
        if (chat.length == 0) {
            return res.status(401).json({success: false, message: "user is not in a random chat"});
        }
        if (chat_id !== chat[0]?.chat_id) {
            return res.status(401).json({success: false, message: "Sent to invalid chat"});
        }

        await db.query(
            `INSERT INTO Messages (chat_id, sender_id, message, random_chat) 
            VALUES (?, ?, ?, TRUE)`,
            [chat_id, user_id, message]
        )
        return res.status(201).json({success: true, message: "Sent message!"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/leaveRandomChat", async (req: Request<{},{},{chat_id: number, user_id: number, other_user_id: number}>, res: Response<standardResponse>) => {
    const {chat_id, user_id, other_user_id} = req.body;
    if (user_id === other_user_id) {
        return res.status(401).json({success: false, message: "cannot provide 2 of the same users"});
    }
    const conn = await db.getConnection();
    try {
        // check if user is in chat
        const [checkInChat] = await db.execute<GetIfInChat[]>(
            `SELECT chat_id FROM RandomChats WHERE user_id_1=? OR user_id_2=?`,
            [user_id, user_id]
        );
        if (checkInChat.length == 0) {
            return res.status(401).json({success: false, message: "user currently isn't in a chat"});
        }
        if (checkInChat[0]?.chat_id !== chat_id) {
            return res.status(401).json({success: false, message: "Invalid chat error"});
        }
        conn.beginTransaction();
        conn.execute('DELETE FROM Messages WHERE chat_id = ?', [chat_id]);
        conn.execute('DELETE FROM RandomChats WHERE chat_id = ?', [chat_id]);
        conn.execute('DELETE FROM AllChats WHERE chat_id = ?', [chat_id]);
        conn.execute('UPDATE RandomChatPool SET available=TRUE WHERE user_id=? OR user_id=?', [user_id, other_user_id]);
        // set both users to available again
        conn.commit();
        
        return res.status(201).json({success: true, message: "successfully left chat"});
    } catch (err) {
        conn.rollback();
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    } finally {
        conn.release();
    }
});

router.post("/leaveQueue", async (req: Request<{},{},{user_id: number}>, res: Response<standardResponse>) => {
    const {user_id} = req.body;

    const conn = await db.getConnection();

    try {
        // check if user is even in a queue
        const [queueStatus] = await db.execute<any[]>(
            `SELECT available FROM RandomChatPool WHERE user_id=?`,[user_id]
        )

        // if they aren't available THEN:
        if (queueStatus.length === 0) {
            return res.status(401).json({success: false, message:"User isn't in queue"});
        }
        
        // if user is available just simply remove
        if (queueStatus[0].available === 1) {
            await db.query(
                `DELETE FROM RandomChatPool WHERE user_id=?`,[user_id]
            );

            return res.status(201).json({success: true, message: "user successfully removed from pool"});
        }
        // if user is not available NEED to delete the chat TOO
        conn.beginTransaction();

        // get other user in the chat
        const [getChat] = await db.execute<any[]>(
            'SELECT chat_id, user_id_1, user_id_2 FROM RandomChats WHERE user_id_1=? OR user_id_2=?',
            [user_id, user_id]
        );
        if (getChat.length === 0) {
            return res.status(401).json({success: false, message:"Random Chat retreival error"});
        }
        let other_user = 0;
        const chat_id = getChat[0].chat_id;
        if (getChat[0].user_id_1 !== user_id) {
            other_user=getChat[0].user_id_1;
        } else {
            other_user=getChat[0].user_id_2;
        }

        conn.execute('DELETE FROM Messages WHERE chat_id = ?', [chat_id]);
        conn.execute('DELETE FROM RandomChats WHERE chat_id = ?', [chat_id]);
        conn.execute('DELETE FROM AllChats WHERE chat_id = ?', [chat_id]);
        conn.execute('UPDATE RandomChatPool SET available=TRUE WHERE user_id=?', [other_user]);
        // set ONLY otheruser to available again
        conn.execute(`DELETE FROM RandomChatPool WHERE user_id=?`,[user_id]);
        conn.commit();
        return res.status(201).json({success: true, message: "user successfully removed from queue"});
    } catch (err) {
        conn.rollback();
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    } finally {
        conn.release();
    }
});

export default router;