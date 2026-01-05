import express from 'express';
import db from '../database.js';
import type {Request, Response} from 'express';
import type{ GetFriendsId, CreateChatInput, LeaveChatInput, UsersInGroupQuery, DeleteChatInput, NewLeaderUsernameQuery, ChatIdWithUserQuery, AllUsersInChatQuery, UsernameInChatQuery, CheckStatusQuery, RowChatDataQuery, MostUpToDateMessageQuery, LastSeenMessageQuery, AddToChatInput, CurrUsersQuery, CheckExistingFriendshipQuery, CheckExistingMemberShipQuery, AddToChatResponse, KickUserInput, EditChatNameInput, CurrChat, GetChatsResponse } from '../../definitions/chatsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import type { ResultSetHeader } from 'mysql2';


const router = express.Router();

router.post("/createChat", async (req: Request<{},{},CreateChatInput>, res: Response<standardResponse>) => {
    const {creator_id, creator_username, addedFriends, chat_name} = req.body;
    if (addedFriends.length > 14) return res.status(401).json({success: false, message: "Maximum of 15 members"});
    // addedFriends will be array of objects
    // {username, user_id, friend_id}
    if (!creator_id) return res.status(401).json({success: false, message: "Invalid creator id"});
    if (!chat_name) return res.status(401).json({success: false, message: "Invalid chat name"});
    if (addedFriends.length === 0) return res.status(401).json({success: false, message: "Cannot make a chat by yourself"});
    try {
        const [results] = await db.execute<ResultSetHeader>(
            'INSERT INTO Chats (creator_id, chat_name) VALUES (?, ?)',
            [creator_id, chat_name]
        );

        const insertedId = results.insertId; // automatically gives primary key value of the inserted value
        // will be the chatId of Chat_Users for each user

        await db.execute(
            'INSERT INTO Chat_Users (chat_id, user_id) VALUES (?, ?)',
            [insertedId, creator_id]
        );
        for (const friend of addedFriends) {
            const {username, user_id, friend_id} = friend;
            // Check if friends (might not be necessary)
            
            const [rows] = await db.execute<GetFriendsId[]>(
                'SELECT friend_id FROM Friends WHERE friend_id=? AND status="accepted"',
                [friend_id]
            );
            if (rows.length === 0) {
                return res.status(401).json({success: false, message: `${username} is not your friend`});
            }
            if (friend.user_id === creator_id) {
                return res.status(401).json({success: false, message: "error, will add creator twice"});
            }

            await db.execute(
                'INSERT INTO Chat_Users (chat_id, user_id) VALUES (?, ?)',
                [insertedId, user_id]
            );
        }

        // Server creates opening message
        await db.execute(
            'INSERT INTO Messages (chat_id, sender_id, message) VALUES(?,?,?)',
            [insertedId, -1, `${creator_username} has created chat: "${chat_name}"`]
        );

        return res.status(201).json({success: true, message: `Successfully created ${chat_name}`})

    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.post("/leaveChat", async (req: Request<{},{},LeaveChatInput>, res: Response<standardResponse>) => {
    const {user_id, username, chat_id, creator_id} = req.body;

    console.log("user: ", user_id);
    try {
        // check if user is in the group
        const [rowsUsersInGroup] = await db.execute<UsersInGroupQuery[]>(
            'SELECT user_id FROM Chat_Users WHERE chat_id=?',
            [chat_id]
        );
        console.log(rowsUsersInGroup); // TESTING
        if (!rowsUsersInGroup.some((user) => user.user_id === user_id)) {
            return res.status(401).json({success: false, message: "User is not in group"});
        }

        if (rowsUsersInGroup.length === 1) {
            // only user is left
            await db.execute(
                'DELETE FROM Chat_Users WHERE chat_id=?', [chat_id]
            );
            await db.execute(
                'DELETE FROM Chats WHERE chat_id=?', [chat_id]
            );
    

            return res.status(201).json({success: true, message: "Successfully deleted group"});
        }
        // check if user is leader, then pass on leadership

        if (creator_id === user_id && rowsUsersInGroup.length > 1) {
            await db.execute(
                'UPDATE Chats SET creator_id=? WHERE chat_id=?',
                [rowsUsersInGroup[1]!.user_id, chat_id]
            ); // original creator always will be index 0 of rowsUsersInGroup
            await db.execute(
                'DELETE FROM Chat_Users WHERE user_id = ? AND chat_id = ?',
                [user_id, chat_id]
            ); // then delete creator for members list  

            const [newLeaderUsername] = await db.execute<NewLeaderUsernameQuery[]>(
                'SELECT username FROM Users WHERE user_id = ?',
                [rowsUsersInGroup[1]!.user_id]
            );

            await db.execute(
            'INSERT INTO Messages (chat_id, sender_id, message) VALUES(?,?,?)',
            [chat_id, -1, `${username} has left, ${newLeaderUsername[0]!.username} is the new leader`]
            );
            return res.status(201).json({success: true, message: `${username} has left the chat, ${newLeaderUsername[0]!.username} is the new leader`}); 
        }

        // just normal member and not only member
        await db.execute(
            'DELETE FROM Chat_Users WHERE user_id=? AND chat_id=?',
            [user_id, chat_id]
        );
        
        await db.execute(
            'INSERT INTO Messages (chat_id, sender_id, message) VALUES(?,?,?)',
            [chat_id, -1, `${username} has left the chat`]
        );
        return res.status(201).json({success: true, message: `${username} has left the chat`});

    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

// only can be done by creator
router.post("/deleteChat", async (req: Request<{},{},DeleteChatInput>, res: Response<standardResponse>) => {
    const {user_id, chat_id, creator_id} = req.body; // creator id from chat_data
    try {
        
        if (user_id !== creator_id) return res.status(401).json({success: false, message: "User is not the creator"});

        await db.execute(
            'DELETE FROM Chat_Users WHERE chat_id = ?',
            [chat_id]
        );
        await db.execute(
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
router.get("/displayChats/:user_id", async (req: Request<{user_id: number}>, res: Response<GetChatsResponse>) => {
    const user_id = req.params.user_id;

    try {
        const [allChatIdWithUser] = await db.execute<ChatIdWithUserQuery[]>(
            'SELECT chat_id FROM Chat_Users WHERE user_id=?',
            [user_id]
        );
        if (allChatIdWithUser.length === 0) {
            return res.status(201).json({success: true, message: "No chats"});
        }

        const chatsData = [];
        
        // ARRAYS OF OBJECTS 

        for (const chat of allChatIdWithUser) {
            const currChat: CurrChat = {} as any;

            // obtain users
            const [allUsers] = await db.execute<AllUsersInChatQuery[]>(
                'SELECT user_id, joined_at FROM Chat_Users WHERE chat_id=?',
                [chat.chat_id]
            ); // obtains all the users in the specific chat

            // obtain username of that user and the status with the user, (friends, Pending Incoming Req, Pending Outgoing Req, None)
            for (let i = 0; i < allUsers.length; i++) {
                const currentUser = allUsers[i]!;
                const [username] = await db.execute<UsernameInChatQuery[]>(
                    'SELECT username, joined_at, description FROM Users WHERE user_id = ?',
                    [currentUser.user_id]
                );

                
                const [checkStatus] = await db.execute<CheckStatusQuery[]>(
                    'SELECT status, sender_id, receiver_id, friend_id, updated_at FROM Friends WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)',
                    [user_id, currentUser.user_id, currentUser.user_id, user_id]
                ) // if they already are friends only one possibility 
                let status = "none";
                let friend_id: number | undefined = undefined;
                let updated_at: string | undefined = undefined;

                if (checkStatus.length > 0) {
                    const row = checkStatus[0]!;
                    friend_id = row.friend_id;
                    updated_at = row.updated_at;

                    if (row.status === "accepted") {
                        status = "friends";
                    } else if (row.status === "pending" && row.sender_id === Number(user_id)) {
                        status = "outgoing";
                    } else if (row.status === "pending" && row.receiver_id === Number(user_id)) {
                        status = "incoming";
                    }
                }

                currentUser.friend_id = friend_id;
                currentUser.updated_at = updated_at;
                
                currentUser.status = status;
                currentUser.username = username[0]!.username;
                currentUser.account_created = username[0]!.joined_at;

                currentUser.description = username[0]!.description;
                
                // now all Users stores array of objects of {username, user_id}
            }

            // now get creator id and chat name

            const [rowChatData] = await db.execute<RowChatDataQuery[]>(
                'SELECT creator_id, chat_name FROM Chats WHERE chat_id=?',
                [chat.chat_id]
            );
            const chatData = rowChatData[0]!;
            const [usernameLeader] = await db.execute<NewLeaderUsernameQuery[]>(
                'SELECT username FROM Users WHERE user_id = ?',
                [chatData.creator_id]
            );

            // GET if unread messages (unread = true means unread messages unread = false means all messages read)
            let ifUnread = false;
            // select most up to date message id and compare to user's latest read message
            const [rowsUpToDateMsg] = await db.execute<MostUpToDateMessageQuery[]>(
                'SELECT message_id FROM Messages WHERE chat_id=? AND deleted=0 AND sender_id!=? ORDER BY message_id DESC LIMIT 1',
                [chat.chat_id, user_id]
            ); // dont count if most up to date is from the user themselves

            if (rowsUpToDateMsg.length !== 0) {
                // if no messages in chat then ifUnread = false
                const [userLatest] = await db.execute<LastSeenMessageQuery[]>(
                    'SELECT last_seen_message_id FROM Chat_Users WHERE user_id=? AND chat_id=?',
                    [user_id, chat.chat_id]
                );

                if (userLatest[0]!.last_seen_message_id < rowsUpToDateMsg[0]!.message_id) {
                    ifUnread = true; // has unread messages if up to date message is larger id
                }
            }

            currChat.unread = ifUnread;

            currChat.creator_id = chatData.creator_id;    
            currChat.creator_username = usernameLeader[0]!.username;
            currChat.chat_name = chatData.chat_name;

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
    console.log(chat_id);
    try {
        const [currUsers] = await db.execute<CurrUsersQuery[]>(
            'SELECT user_id FROM Chat_Users WHERE chat_id=?',
            [chat_id]
        );
        // check if user is in the group
        if (!currUsers.some((user) => user.user_id === user_id)) return res.status(401).json({success: false, message: "User not in the group"});

        // check overflow
        if (currUsers.length + addedFriends.length > 15) return res.status(401).json({success: false, message: "Maximum 15 people per chat"});

        // check if all users are actually friends and if they're already in the group
        
        for (const friend of addedFriends) {
            const [checkExistingFriendship] = await db.execute<CheckExistingFriendshipQuery[]>(
                'SELECT friend_id FROM Friends WHERE friend_id=? AND status="accepted" AND (sender_id=? OR receiver_id=?)',
                [friend.friend_id, user_id, user_id]
            );

            const [checkExistingMembership] = await db.execute<CheckExistingMemberShipQuery[]>(
                'SELECT chat_user_id FROM Chat_Users WHERE chat_id=? AND user_id=?',
                [chat_id, friend.user_id]
            );
            if (checkExistingFriendship.length === 0) {
                return res.status(401).json({success: false, message: `User ${friend.username} is not friends with you`});
            }
            if (checkExistingMembership.length > 0) {
                return res.status(401).json({success: false, message: `User ${friend.username} is already in the group`});
            }
        }

        // add users to Chat_Users with chat_id
        const finalMessage = []; // will return an array of messages for each memeber added by the user

        for (const friend of addedFriends) {
            await db.execute(
                'INSERT INTO Chat_Users (chat_id, user_id) VALUES (?, ?)',
                [chat_id, friend.user_id]
            );
            finalMessage.push(`${username} has added ${friend.username} to the chat`);
        }

        const compressedUsernameList = addedFriends.map((friend) => friend.username).join(", ");
        await db.execute(
            'INSERT INTO Messages (chat_id, sender_id, message) VALUES(?,?,?)',
            [chat_id, -1, `${username} has added: ${compressedUsernameList} to the chat`]
        );
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
        const [kickInGroup] = await db.execute<CheckExistingMemberShipQuery[]>(
            'SELECT chat_user_id FROM Chat_Users WHERE user_Id=? AND chat_id=?',
            [kicked_id, chat_id]
        );
        if (kickInGroup.length === 0) {
            return res.status(401).json({success: false, message: `${kicked_username} is not in the group`});
        }

        await db.execute(
            'DELETE FROM Chat_Users WHERE chat_id=? AND user_id=?',
            [chat_id, kicked_id]
        );

        await db.execute(
            'INSERT INTO Messages (chat_id, sender_id, message) VALUES(?,?,?)',
            [chat_id, -1, `${user_username} has kicked ${kicked_username} from the chat`]
        );
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

        await db.execute(
            'UPDATE Chats SET chat_name=? WHERE chat_id=?',
            [newChatName, chat_id]
        );
        await db.execute(
            'INSERT INTO Messages (chat_id, sender_id, message) VALUES(?,?,?)',
            [chat_id, -1, `${username} changed the chat name to ${newChatName}`]
        );
        return res.status(201).json({success: true, message: "Successfully changed chat name"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
export default router;