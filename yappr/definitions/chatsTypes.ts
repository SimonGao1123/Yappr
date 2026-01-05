import type { RowDataPacket } from "mysql2"
import type { CurrOutIncFriendsQuery } from "./friendsTypes.js"

export type CreateChatInput = {
    creator_id: number, 
    creator_username: string, 
    addedFriends: CurrOutIncFriendsQuery[], 
    chat_name: string
}
export interface GetFriendsId extends RowDataPacket {
    friend_id: number,
    
} 
export interface UsersInGroupQuery extends RowDataPacket {
    user_id: number,
    
} 
export interface NewLeaderUsernameQuery extends RowDataPacket {
    username: string
    
} 
export type LeaveChatInput = {
    user_id: number, 
    username: string, 
    chat_id: number, 
    creator_id: number
}
export type DeleteChatInput = {
    user_id: number, 
    chat_id: number, 
    creator_id: number
}
export interface ChatIdWithUserQuery extends RowDataPacket {
    chat_id: number    
} 
export interface AllUsersInChatQuery extends RowDataPacket {
    user_id: number,
    joined_at: string,
    friend_id?: number,
    updated_at?: string,
    status?: string,
    username?: string,
    account_created?: string,
    description?: string    
} 
export interface UsernameInChatQuery extends RowDataPacket {
    username: string,
    joined_at: string,
    description: string
} 
export interface CheckStatusQuery extends RowDataPacket {
    status: string, 
    sender_id: number, 
    receiver_id: number, 
    friend_id: number, 
    updated_at: string
} 
export interface RowChatDataQuery extends RowDataPacket {
    creator_id: number,
    chat_name: string
}
export interface MostUpToDateMessageQuery extends RowDataPacket {
    message_id: number
}
export interface LastSeenMessageQuery extends RowDataPacket {
    last_seen_message_id: number
}
export type AddToChatInput = {
    username: string, 
    user_id: number, 
    addedFriends: CurrOutIncFriendsQuery[], 
    chat_id: number
}
export interface CurrUsersQuery extends RowDataPacket {
    user_id: number
} 
export interface CheckExistingFriendshipQuery extends RowDataPacket {
    friend_id: number
} 
export interface CheckExistingMemberShipQuery extends RowDataPacket {
    chat_user_id: number
} 
export type AddToChatResponse = | {
    success: false,
    message: string
} | {
    success: true,
    message: string[]
}
export type KickUserInput = {
    creator_id: number, 
    user_id: number, 
    user_username: string, 
    kicked_id: number, 
    kicked_username: string, 
    chat_id: number
}
export type EditChatNameInput = {
    newChatName: string, 
    chat_id: number, 
    user_id: number, 
    creator_id: number, 
    username: string
}
export type ChatsPageProps = {
    currentUser: {username: string, id: number},
    currentFriends: CurrOutIncFriendsQuery[],
    ifLightMode: boolean
}
export type CurrChat = {
    unread: boolean;
    creator_id: number;
    creator_username: string;
    chat_name: string;
    userList: AllUsersInChatQuery[];
    chat_id: number;
}
export type DisplayChatsProps = {
    setCreateChatsDisplay: (value: boolean)=> void, 
    addMembersDisplay: boolean,
    setAddMembersDisplay: (value: boolean)=> void,
    currentUser: {username: string, id: number},
    allChats: CurrChat[],
    setAllChats: (value: CurrChat[])=> void,
    currentFriends: CurrOutIncFriendsQuery[],
    ifLightMode: boolean,
    mobileView: string,
    setMobileView: (value: string)=> void,
}
export type ChatLayoutProps = {
    chat_name: string,
    chat_id: number,
    currentUser: {username: string, id: number},
    ifLightMode: boolean,
    selectedChat: CurrChat
}
export type UsersLayoutProps = {
    addMembersDisplay: boolean,
    setAddMembersDisplay: (value: boolean)=> void,
    chat_id: number,
    userList: AllUsersInChatQuery[],
    creator_id: number,
    currentUser: {username: string, id: number},
    currentFriends: CurrOutIncFriendsQuery[],
    ifLightMode: boolean
}
export type DisplayUserDetailsProps = {
    user_id: number,
    username: string,
    description: string,
    account_created: string,
    joined_at: string,
    friendsBtns: any,
    updated_at: string,
    descFriends: string,
    setUserDetailsOpen: (value: number | null)=> void,
    currentUser: {username: string, id: number},
    ifLightMode: boolean
}
export type AddMembersPopupProps = {
    setAddMembersDisplay: (value: boolean)=> void,
    userList: AllUsersInChatQuery[];
    currentFriends: CurrOutIncFriendsQuery[],
    chat_id: number,
    currentUser: {username: string, id: number},
    ifLightMode: boolean
}
export type GetChatsResponse = {
    success: boolean,
    message: string,
    chat_data?: CurrChat[]
}
export type CreateChatsPopupProps = {
    currentFriends: CurrOutIncFriendsQuery[],
    currentUser: {username: string, id: number},
    setCreateChatsDisplay: (value: boolean)=> void,
    ifLightMode: boolean
}