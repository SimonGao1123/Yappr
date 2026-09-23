import express from 'express';
import prisma from '../prisma.js';
import type {Request, Response} from 'express';
import type{ CreateChatInput, LeaveChatInput, DeleteChatInput, AddToChatInput, AddToChatResponse, KickUserInput, EditChatNameInput, CurrChat, AllUsersInChatQuery, GetChatsResponse } from '../../definitions/chatsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';


const router = express.Router();

// Thrown inside createChat's transaction so a failed validation rolls back the
// rows already written instead of leaving an orphaned chat behind.
class ChatValidationError extends Error {
    constructor(public body: standardResponse) {
        super(body.message as string);
    }
}

router.post("/createChat", async (req: Request<{},{},CreateChatInput>, res: Response<standardResponse>) => {
    const {creator_id, creator_username, addedFriends, chat_name} = req.body;
    if (addedFriends.length > 14) return res.status(401).json({success: false, message: "Maximum of 15 members"});
    // addedFriends will be array of objects
    // {username, user_id, friend_id}
    if (!creator_id) return res.status(401).json({success: false, message: "Invalid creator id"});
    if (!chat_name) return res.status(401).json({success: false, message: "Invalid chat name"});
    if (addedFriends.length === 0) return res.status(401).json({success: false, message: "Cannot make a chat by yourself"});
    try {
        await prisma.$transaction(async (tx) => {
            // AllChats allocates the chat_id shared by group chats and random chats
            const allChat = await tx.allChats.create({data: {}});
            const insertedId = allChat.chat_id;

            await tx.chats.create({
                data: {chat_id: insertedId, creator_id, chat_name}
            });

            await tx.chat_Users.create({
                data: {chat_id: insertedId, user_id: creator_id}
            });

            for (const friend of addedFriends) {
                const {username, user_id, friend_id} = friend;
                // Check if friends (might not be necessary)

                const row = await tx.friends.findFirst({
                    where: {friend_id, status: "accepted"},
                    select: {friend_id: true}
                });
                if (!row) {
                    throw new ChatValidationError({success: false, message: `${username} is not your friend`});
                }
                if (friend.user_id === creator_id) {
                    throw new ChatValidationError({success: false, message: "error, will add creator twice"});
                }

                await tx.chat_Users.create({
                    data: {chat_id: insertedId, user_id}
                });
            }

            // Server creates opening message
            await tx.messages.create({
                data: {chat_id: insertedId, sender_id: -1, message: `${creator_username} has created chat: "${chat_name}"`}
            });
        });

        return res.status(201).json({success: true, message: `Successfully created ${chat_name}`})

    } catch (err) {
        if (err instanceof ChatValidationError) return res.status(401).json(err.body);
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/leaveChat", async (req: Request<{},{},LeaveChatInput>, res: Response<standardResponse>) => {
    const {user_id, username, chat_id, creator_id} = req.body;

    try {
        // check if user is in the group
        // ordered by membership id so the creator is index 0, as assumed below
        const rowsUsersInGroup = await prisma.chat_Users.findMany({
            where: {chat_id},
            select: {user_id: true},
            orderBy: {chat_user_id: 'asc'}
        });
        if (!rowsUsersInGroup.some((user) => user.user_id === user_id)) {
            return res.status(401).json({success: false, message: "User is not in group"});
        }

        if (rowsUsersInGroup.length === 1) {
            // only user is left
            await prisma.$transaction([
                prisma.messages.deleteMany({where: {chat_id}}),
                prisma.chat_Users.deleteMany({where: {chat_id}}),
                prisma.chats.deleteMany({where: {chat_id}}),
                prisma.allChats.deleteMany({where: {chat_id}})
            ]);

            return res.status(201).json({success: true, message: "Successfully deleted group"});
        }
        // check if user is leader, then pass on leadership

        if (creator_id === user_id && rowsUsersInGroup.length > 1) {
            const nextLeaderId = rowsUsersInGroup[1]!.user_id;
            await prisma.chats.updateMany({
                where: {chat_id},
                data: {creator_id: nextLeaderId}
            }); // original creator always will be index 0 of rowsUsersInGroup
            await prisma.chat_Users.deleteMany({
                where: {user_id, chat_id}
            }); // then delete creator for members list

            const newLeader = await prisma.users.findUnique({
                where: {user_id: nextLeaderId},
                select: {username: true}
            });

            await prisma.messages.create({
                data: {chat_id, sender_id: -1, message: `${username} has left, ${newLeader!.username} is the new leader`}
            });
            return res.status(201).json({success: true, message: `${username} has left the chat, ${newLeader!.username} is the new leader`});
        }

        // just normal member and not only member
        await prisma.chat_Users.deleteMany({
            where: {user_id, chat_id}
        });

        await prisma.messages.create({
            data: {chat_id, sender_id: -1, message: `${username} has left the chat`}
        });
        return res.status(201).json({success: true, message: `${username} has left the chat`});

    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

// only can be done by creator
router.post("/deleteChat", async (req: Request<{},{},DeleteChatInput>, res: Response<standardResponse>) => {
    const {user_id, chat_id, creator_id} = req.body; // creator id from chat_data

    if (user_id !== creator_id) return res.status(401).json({success: false, message: "User is not the creator"});

    try {
        await prisma.$transaction([
            prisma.messages.deleteMany({where: {chat_id}}),
            prisma.chat_Users.deleteMany({where: {chat_id}}),
            prisma.chats.deleteMany({where: {chat_id}}),
            prisma.allChats.deleteMany({where: {chat_id}})
        ]);
        return res.status(201).json({success: true, message: "Successfully deleted chat"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});


// returns chat_id and each member (display status of each member to curr member)
router.get("/displayChats/:user_id", async (req: Request<{user_id: string}>, res: Response<GetChatsResponse>) => {
    const user_id = Number(req.params.user_id);

    try {
        const allChatIdWithUser = Number.isInteger(user_id)
            ? await prisma.chat_Users.findMany({
                where: {user_id},
                select: {chat_id: true}
              })
            : [];
        if (allChatIdWithUser.length === 0) {
            return res.status(201).json({success: true, message: "No chats"});
        }

        const chatsData = [];

        // ARRAYS OF OBJECTS

        for (const chat of allChatIdWithUser) {
            const currChat: CurrChat = {} as any;

            // obtain users
            const chatMembers = await prisma.chat_Users.findMany({
                where: {chat_id: chat.chat_id},
                select: {user_id: true, joined_at: true},
                orderBy: {chat_user_id: 'asc'}
            }); // obtains all the users in the specific chat

            const allUsers: AllUsersInChatQuery[] = [];

            // obtain username of that user and the status with the user, (friends, Pending Incoming Req, Pending Outgoing Req, None)
            for (const member of chatMembers) {
                const userRow = await prisma.users.findUnique({
                    where: {user_id: member.user_id},
                    select: {username: true, joined_at: true, description: true}
                });

                const checkStatus = await prisma.friends.findFirst({
                    where: {OR: [
                        {sender_id: user_id, receiver_id: member.user_id},
                        {sender_id: member.user_id, receiver_id: user_id}
                    ]},
                    select: {status: true, sender_id: true, receiver_id: true, friend_id: true, updated_at: true}
                }); // if they already are friends only one possibility
                let status = "none";
                let friend_id: number | undefined = undefined;
                let updated_at: string | undefined = undefined;

                if (checkStatus) {
                    friend_id = checkStatus.friend_id;
                    updated_at = checkStatus.updated_at.toISOString();

                    if (checkStatus.status === "accepted") {
                        status = "friends";
                    } else if (checkStatus.status === "pending" && checkStatus.sender_id === user_id) {
                        status = "outgoing";
                    } else if (checkStatus.status === "pending" && checkStatus.receiver_id === user_id) {
                        status = "incoming";
                    }
                }

                // key order matches the old in-place mutation order
                allUsers.push({
                    user_id: member.user_id,
                    joined_at: member.joined_at.toISOString(),
                    friend_id,
                    updated_at,
                    status,
                    username: userRow!.username,
                    account_created: userRow!.joined_at.toISOString(),
                    description: userRow!.description
                });

                // now all Users stores array of objects of {username, user_id}
            }

            // now get creator id and chat name

            const chatData = await prisma.chats.findUnique({
                where: {chat_id: chat.chat_id},
                select: {creator_id: true, chat_name: true}
            });
            const usernameLeader = await prisma.users.findUnique({
                where: {user_id: chatData!.creator_id},
                select: {username: true}
            });

            // GET if unread messages (unread = true means unread messages unread = false means all messages read)
            let ifUnread = false;
            // select most up to date message id and compare to user's latest read message
            const rowsUpToDateMsg = await prisma.messages.findFirst({
                where: {chat_id: chat.chat_id, deleted: 0, sender_id: {not: user_id}},
                select: {message_id: true},
                orderBy: {message_id: 'desc'}
            }); // dont count if most up to date is from the user themselves

            if (rowsUpToDateMsg) {
                // if no messages in chat then ifUnread = false
                const userLatest = await prisma.chat_Users.findFirst({
                    where: {user_id, chat_id: chat.chat_id},
                    select: {last_seen_message_id: true}
                });

                if (userLatest!.last_seen_message_id < rowsUpToDateMsg.message_id) {
                    ifUnread = true; // has unread messages if up to date message is larger id
                }
            }

            currChat.unread = ifUnread;

            currChat.creator_id = chatData!.creator_id;
            currChat.creator_username = usernameLeader!.username;
            currChat.chat_name = chatData!.chat_name;

            currChat.userList = allUsers;
            currChat.chat_id = chat.chat_id;

            chatsData.push(currChat);
        }

        // sort chatsData such that all unread chats are at the front
        chatsData.sort((a, b) => {
            return Number(b.unread === true) - Number(a.unread === true);
        }); // puts unread = true first

        return res.status(201).json({success: true, message: "Successfully retreived user chats",
                chat_data: chatsData
        });


    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});


router.post("/addToChat", async (req: Request<{},{},AddToChatInput>, res: Response<AddToChatResponse>) => {
    // max 15 members to chat
    const {username, user_id, addedFriends, chat_id} = req.body;
    // added friends is array of objects {user_id, username, friend_id}
    try {
        const currUsers = await prisma.chat_Users.findMany({
            where: {chat_id},
            select: {user_id: true}
        });
        // check if user is in the group
        if (!currUsers.some((user) => user.user_id === user_id)) return res.status(401).json({success: false, message: "User not in the group"});

        // check overflow
        if (currUsers.length + addedFriends.length > 15) return res.status(401).json({success: false, message: "Maximum 15 people per chat"});

        // check if all users are actually friends and if they're already in the group

        for (const friend of addedFriends) {
            const checkExistingFriendship = await prisma.friends.findFirst({
                where: {
                    friend_id: friend.friend_id,
                    status: "accepted",
                    OR: [{sender_id: user_id}, {receiver_id: user_id}]
                },
                select: {friend_id: true}
            });

            const checkExistingMembership = await prisma.chat_Users.findFirst({
                where: {chat_id, user_id: friend.user_id},
                select: {chat_user_id: true}
            });
            if (!checkExistingFriendship) {
                return res.status(401).json({success: false, message: `User ${friend.username} is not friends with you`});
            }
            if (checkExistingMembership) {
                return res.status(401).json({success: false, message: `User ${friend.username} is already in the group`});
            }
        }

        // add users to Chat_Users with chat_id
        const finalMessage = []; // will return an array of messages for each memeber added by the user

        for (const friend of addedFriends) {
            await prisma.chat_Users.create({
                data: {chat_id, user_id: friend.user_id}
            });
            finalMessage.push(`${username} has added ${friend.username} to the chat`);
        }

        const compressedUsernameList = addedFriends.map((friend) => friend.username).join(", ");
        await prisma.messages.create({
            data: {chat_id, sender_id: -1, message: `${username} has added: ${compressedUsernameList} to the chat`}
        });
        return res.status(201).json({success: true, message: finalMessage});
        // note if success is true then message will be an array

    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/kick", async (req: Request<{},{},KickUserInput>, res: Response<standardResponse>) => {
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
        const kickInGroup = await prisma.chat_Users.findFirst({
            where: {user_id: kicked_id, chat_id},
            select: {chat_user_id: true}
        });
        if (!kickInGroup) {
            return res.status(401).json({success: false, message: `${kicked_username} is not in the group`});
        }

        await prisma.chat_Users.deleteMany({
            where: {chat_id, user_id: kicked_id}
        });

        await prisma.messages.create({
            data: {chat_id, sender_id: -1, message: `${user_username} has kicked ${kicked_username} from the chat`}
        });
        return res.status(201).json({success: true, message: `${kicked_username} was kicked by ${user_username}`});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/editChatName", async (req: Request<{},{},EditChatNameInput>, res: Response<standardResponse>) => {
    const {newChatName, chat_id, user_id, creator_id, username} = req.body;

    if (!newChatName || !creator_id || !chat_id || !user_id || !username) {
        return res.status(401).json({success: false, message: "Invalid"});
    }

    try {
        // check if user is creator
        if (user_id !== creator_id) {
            return res.status(401).json({success: false, message: "User is not the creator"});
        }

        await prisma.chats.updateMany({
            where: {chat_id},
            data: {chat_name: newChatName}
        });
        await prisma.messages.create({
            data: {chat_id, sender_id: -1, message: `${username} changed the chat name to ${newChatName}`}
        });
        return res.status(201).json({success: true, message: "Successfully changed chat name"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

export default router;
