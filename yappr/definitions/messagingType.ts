import type { RowDataPacket } from 'mysql2';

export type SendMessageInput = {
    chat_id: number,
    message: string, 
    user_id: number
}
export interface SelectChatUsers extends RowDataPacket {
    chat_user_id: number,
    chat_id: number,
    user_id: number,
    joined_at: string,
    last_seen_message_id: number
}
export type DeleteMessageInput = {
    message_id: number, 
    user_id: number, 
    sender_id: number, 
    chat_id: number
}
export interface SelectIfMessageExists extends RowDataPacket {
    sender_id: number, 
    chat_id: number, 
    deleted: number
}
export interface GetAllChatsMessages extends RowDataPacket {
    chat_id: number
}
export interface GetAllMessageId extends RowDataPacket {
    message_id: number
}
export interface SelectMessagesFromChat extends RowDataPacket {
    askGemini: number,
    message_id: number,
    sender_id: number,
    message: string,
    username: string, 
    sent_at: string
}
export interface ChatMessages {
    chat_id: number;
    messageData: SelectMessagesFromChat[];
}

export type GetMessagesResponse = {
    success: boolean;
    message: string;
    msgData?: ChatMessages[];
};
export type ReadMessagesInput = {
    chat_id: number,
    user_id: number
}
export type MessagingSectionProp = {
    currentUser: {username: string, id: number}, 
    chat_id: number, 
    ifLightMode: boolean
}
export type PastMessagesDataProp = {
    pastMessageData: SelectMessagesFromChat[], 
    currentUser: {username: string, id: number}, 
    chat_id: number, 
    ifLightMode: boolean
}
export type SendMessageInputProp = {
    currentUser: {username: string, id: number}, 
    chat_id: number, 
    ifLightMode: boolean
}
export type PromptGeminiInput = {
    prompt: string, 
    chat_id: number, 
    user_id: number, 
    username: string
}