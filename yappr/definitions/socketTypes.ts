// Socket.IO event types for type safety

export interface ServerToClientEvents {
  newMessage: (data: { chat_id: number }) => void;
  friendUpdate: (data: { type: 'newRequest' | 'sentRequest' | 'requestRejected' | 'requestAccepted' | 'newFriend' | 'unfriended' }) => void;
  chatUpdate: (data: { type: 'newChat' | 'leftChat' | 'kicked' | 'chatDeleted' | 'nameChanged', chat_id?: number }) => void;
}

export interface ClientToServerEvents {
  join: (userId: number) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: number;
}
