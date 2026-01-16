import type { RowDataPacket } from 'mysql2';
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
