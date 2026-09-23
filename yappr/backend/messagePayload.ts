import type { SelectMessagesFromChat } from '../definitions/messagingTypes.js';

// Key order below mirrors the SELECT lists the raw SQL used, so emitted socket
// payloads and JSON responses keep byte-identical field ordering.
export const messageSelect = {
    askGemini: true,
    message_id: true,
    sender_id: true,
    message: true,
    sent_at: true,
    user: {select: {username: true}},
} as const;

type MessageRow = {
    askGemini: number | null;
    message_id: number;
    sender_id: number;
    message: string;
    sent_at: Date;
    user: {username: string} | null;
};

export function toMessagePayload(row: MessageRow): SelectMessagesFromChat {
    return {
        askGemini: row.askGemini ?? 0,
        message_id: row.message_id,
        sender_id: row.sender_id,
        message: row.message,
        username: row.user?.username ?? 'Gemini',
        // JSON.stringify(Date) already produces this exact string; calling it
        // explicitly just makes the declared type honest.
        sent_at: row.sent_at.toISOString(),
    };
}

// The emitted socket payload historically ordered username before sent_at.
export function toSocketPayload(row: MessageRow) {
    return {
        message_id: row.message_id,
        sender_id: row.sender_id,
        message: row.message,
        username: row.user?.username ?? 'Gemini',
        sent_at: row.sent_at.toISOString(),
        askGemini: row.askGemini ?? 0,
    };
}
