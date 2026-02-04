import type { RowDataPacket } from 'mysql2';
import type { UsernameInChatQuery } from './chatsTypes.js';
import type { SelectMessagesFromChat } from './messagingTypes.js';
import type { CurrOutIncFriendsQuery } from './friendsTypes.js';
export interface QueueUsersPool extends RowDataPacket {
    random_chat_user: number,
    user_id: number,
};

export interface GetAvailability extends RowDataPacket {
    available: 0 | 1
};
export interface GetQueueSize extends RowDataPacket {
    available_count: number
};
export interface GetIfInChat extends RowDataPacket {
    chat_id: number
};

export interface GetRandomChat extends RowDataPacket {
    chat_id: number,
    user_id_1: number,
    user_id_2: number
};
export interface RandomUsersInChat extends RowDataPacket {
    user_id: number,
    friend_id?: number,
    updated_at?: string,
    status?: string,
    username?: string,
    account_created?: string,
    description?: string    
} 
export interface GetRandomChatWithUser extends RowDataPacket {
    chat_id: number,
    created_at: string,
    user_id_1: number,
    user_id_2: number
} 

export type userDataType = {
    user_id: number,
    friend_id: number | undefined,
    updated_at: string | undefined,
    status: string,
    username: string,
    account_created: string,
    description: string | undefined
}
export type chatData = {
    chat_id: number,
    created_at: string,
    userData: userDataType[]
}
export type GetQueueStatus = {
    success: boolean,
    message: string, 
    inChat: boolean,
    waiting: boolean,
    queueSize?: number,
    chatData?: chatData,
    messages?: SelectMessagesFromChat[]
}

export type RandomChatsPage = {
    currentUser: {id: number, username: string},
    ifLightMode: boolean,
    currentFriends: CurrOutIncFriendsQuery[],
    outgoingFriendReq: CurrOutIncFriendsQuery[],
    incomingFriendReq: CurrOutIncFriendsQuery[]
}

export type JoinQueueScreenProps = {
    currentUser: {id: number, username: string},
    setStatus: (value: number)=> void,
    ifLightMode: boolean
}

export type WaitingScreenProps = {
    currentUser: {username: string, id: number}, 
    queueSize: number | null, 
    setStatus: (value: number)=>void, 
    setCurrChatData: (value: chatData | null) => void, 
    setMessageData: (value: SelectMessagesFromChat[] | null) => void,
    ifLightMode: boolean
}

export type ChatsDisplayProps = {
    currentUser: {username: string, id: number}, 
    chatData: chatData | null,
    messageData: SelectMessagesFromChat[] | null,
    setStatus: (value: number)=>void, 
    setCurrChatData: (value: chatData | null) => void, 
    setMessageData: (value: SelectMessagesFromChat[] | null) => void,
    ifLightMode: boolean,
    setQueueSize: (value: number|null)=>void,
    currentFriends: CurrOutIncFriendsQuery[],
    outgoingFriendReq: CurrOutIncFriendsQuery[],
    incomingFriendReq: CurrOutIncFriendsQuery[]
}

export type UserDisplayRandomProps = {
    currentUser: {username: string, id: number}, 
    userData: userDataType[],
    ifLightMode: boolean,
    currentFriends: CurrOutIncFriendsQuery[],
    outgoingFriendReq: CurrOutIncFriendsQuery[],
    incomingFriendReq: CurrOutIncFriendsQuery[]
}
export type DisplayUserDetailsRandomProps = {
    user: userDataType,
    setUserDetailsOpen: (value: number | null)=> void,
    currentUser: {username: string, id: number},
    ifLightMode: boolean,
    friendBtns: any,
    descFriends: string
}
export type RandomMessageDisplayProps = {
    currentUser: {username: string, id: number},
    chat_id: number,
    ifLightMode: boolean,
    messageData: SelectMessagesFromChat[] | null
    setMessageData: (value: SelectMessagesFromChat[] | null) => void, 
    setCurrChatData: (value: chatData | null) => void,
    setStatus: (value: number)=> void,
    setQueueSize: (value: number | null)=> void
}
export type SendMessageInputRandom = {
    currentUser: {username: string, id: number},
    chat_id: number, 
    ifLightMode: boolean, 
    setMessageData: (value: SelectMessagesFromChat[] | null) => void, 
    setCurrChatData: (value: chatData | null) => void,
    setStatus: (value: number)=> void,
    setQueueSize: (value: number | null)=> void
}