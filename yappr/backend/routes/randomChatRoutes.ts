import express from 'express';
import type {Request, Response} from 'express';
import prisma from '../prisma.js';
import type { standardResponse } from '../../definitions/globalType.js';
import { getIO } from '../socketInstance.js';
import { messageSelect, toMessagePayload, toSocketPayload } from '../messagePayload.js';
import { type GetQueueStatus } from '../../definitions/randomChatTypes.js';
import type { SendMessageInput } from '../../definitions/messagingTypes.js';

const router = express.Router();

router.post('/joinQueue', async (req: Request<{},{},{user_id: number}>, res: Response<standardResponse>) => {
    // will add the user to the queue
    const {user_id} = req.body;
    try {
        await prisma.randomChatPool.create({data: {user_id}});
        return res.status(201).json({success: true, message: "successfully joined queue"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

});


router.get('/getRandomChat/:user_id', async (req: Request<{user_id: string}>, res: Response<GetQueueStatus>) => {
    const user_id = Number(req.params.user_id);

    try {
        const availability = Number.isInteger(user_id)
            ? await prisma.randomChatPool.findFirst({
                where: {user_id},
                select: {available: true}
              })
            : null;
        if (!availability) {
            return res.status(201).json({success: true, message: "Currently Not in Random Chat Queue", inChat: false, waiting: false});
        }
        if (availability.available === 1) {
            // display # of ppl in queue
            const available_count = await prisma.randomChatPool.count({
                where: {available: 1}
            });
            return res.status(201).json({success: true, message: "Waiting in Queue...", waiting: true, inChat: false, queueSize: available_count});
        }

        if (availability.available === 0) {
            // that means just added to a chat
            const currChat = await prisma.randomChats.findFirst({
                where: {OR: [{user_id_1: user_id}, {user_id_2: user_id}]},
                select: {created_at: true, chat_id: true, user_id_1: true, user_id_2: true}
            });
            const allUsers = [currChat?.user_id_1, currChat?.user_id_2];

            // stores user data for user_id_1 and user_id_2
            // user_id, friend_id, updated_at, status, username, account_created, description
            const usersData = [];
            for (let i = 0; i < allUsers.length; i++) {
                const currentUserId = allUsers[i];
                if (currentUserId === undefined) continue;

                const currUserData = await prisma.users.findUnique({
                    where: {user_id: currentUserId},
                    select: {username: true, description: true, joined_at: true}
                });

                let status="none";
                let friend_id: number | undefined = undefined;
                let updated_at: string | undefined = undefined;
                const row = await prisma.friends.findFirst({
                    where: {OR: [
                        {sender_id: user_id, receiver_id: currentUserId},
                        {sender_id: currentUserId, receiver_id: user_id}
                    ]},
                    select: {status: true, sender_id: true, receiver_id: true, friend_id: true, updated_at: true}
                });

                if (user_id !== currentUserId && row) {
                    friend_id = row.friend_id;
                    updated_at = row.updated_at.toISOString();

                    // NOTE: these branches test the local `status` (always "none")
                    // rather than row.status, so status never resolves here. That
                    // is pre-existing behaviour, preserved deliberately.
                    if (status==="accepted") {
                        status="friends";
                    } else if (status==="pending" && row.sender_id===user_id && row.receiver_id===currentUserId) {
                        status="outgoing";
                    } else if (status==="pending" && row.sender_id===currentUserId && row.receiver_id===user_id) {
                        status="incoming";
                    }
                }
                const currentUser = {
                    user_id: currentUserId,
                    friend_id: friend_id,
                    updated_at: updated_at,
                    status: status,
                    username: currUserData!.username,
                    account_created: currUserData!.joined_at.toISOString(),
                    description: currUserData!.description
                };
                usersData.push(currentUser);
            }

            if (typeof currChat?.chat_id !== "number") {
                return res.status(404).json({success: false, message: "Chat not found", waiting: false, inChat: false});
            }
            const chatData = {chat_id: currChat.chat_id, created_at: currChat.created_at.toISOString(), userData: usersData};
            // chat which user is currently in
            const messageRows = await prisma.messages.findMany({
                where: {random_chat: 1, chat_id: currChat.chat_id, deleted: 0},
                select: messageSelect,
                orderBy: {message_id: 'asc'},
                take: 100
            });

            return res.status(201).json({success: true, message: "Successfully Obtained Random Chat", waiting: false, inChat: true, chatData: chatData, messages: messageRows.map(toMessagePayload)});
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
        const chat = await prisma.randomChats.findFirst({
            where: {OR: [{user_id_1: user_id}, {user_id_2: user_id}]}
        });
        if (!chat) {
            return res.status(401).json({success: false, message: "user is not in a random chat"});
        }
        if (chat_id !== chat.chat_id) {
            return res.status(401).json({success: false, message: "Sent to invalid chat"});
        }

        const created = await prisma.messages.create({
            data: {chat_id, sender_id: user_id, message, random_chat: 1},
            select: messageSelect
        });

        try { getIO().to(`chat:${chat_id}`).emit('new-message', toSocketPayload(created)); } catch {}

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
    try {
        // check if user is in chat
        const checkInChat = await prisma.randomChats.findFirst({
            where: {OR: [{user_id_1: user_id}, {user_id_2: user_id}]},
            select: {chat_id: true}
        });
        if (!checkInChat) {
            return res.status(401).json({success: false, message: "user currently isn't in a chat"});
        }
        if (checkInChat.chat_id !== chat_id) {
            return res.status(401).json({success: false, message: "Invalid chat error"});
        }
        await prisma.$transaction([
            prisma.messages.deleteMany({where: {chat_id}}),
            prisma.randomChats.deleteMany({where: {chat_id}}),
            prisma.allChats.deleteMany({where: {chat_id}}),
            // set both users to available again
            prisma.randomChatPool.updateMany({
                where: {OR: [{user_id}, {user_id: other_user_id}]},
                data: {available: 1}
            })
        ]);

        return res.status(201).json({success: true, message: "successfully left chat"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/leaveQueue", async (req: Request<{},{},{user_id: number}>, res: Response<standardResponse>) => {
    const {user_id} = req.body;

    if (!user_id) {
        return res.status(401).json({success: false, message:"No user selected"});
    }
    try {
        // check if user is even in a queue
        const queueStatus = await prisma.randomChatPool.findFirst({
            where: {user_id},
            select: {available: true}
        });

        // if they aren't available THEN:
        if (!queueStatus) {
            return res.status(401).json({success: false, message:"User isn't in queue"});
        }

        // if user is available just simply remove
        if (queueStatus.available === 1) {
            await prisma.randomChatPool.deleteMany({where: {user_id}});

            return res.status(201).json({success: true, message: "user successfully removed from pool"});
        }
        // if user is not available NEED to delete the chat TOO

        // get other user in the chat
        const getChat = await prisma.randomChats.findFirst({
            where: {OR: [{user_id_1: user_id}, {user_id_2: user_id}]},
            select: {chat_id: true, user_id_1: true, user_id_2: true}
        });
        if (!getChat) {
            return res.status(401).json({success: false, message:"Random Chat retreival error"});
        }
        let other_user = 0;
        const chat_id = getChat.chat_id;
        if (getChat.user_id_1 !== user_id) {
            other_user=getChat.user_id_1;
        } else {
            other_user=getChat.user_id_2;
        }

        await prisma.$transaction([
            prisma.messages.deleteMany({where: {chat_id}}),
            prisma.randomChats.deleteMany({where: {chat_id}}),
            prisma.allChats.deleteMany({where: {chat_id}}),
            // set ONLY otheruser to available again
            prisma.randomChatPool.updateMany({where: {user_id: other_user}, data: {available: 1}}),
            prisma.randomChatPool.deleteMany({where: {user_id}})
        ]);
        return res.status(201).json({success: true, message: "user successfully removed from queue"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;
