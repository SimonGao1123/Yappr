import type { standardResponse } from "../../definitions/globalType.js";
import type { GetMessagesResponse, SelectMessagesFromChat } from "../../definitions/messagingTypes.js";
import type { chatData } from "../../definitions/randomChatTypes.js";
import { errorMessage, fetchJson, postJson } from "./http.js";
import { showToast } from "../ui/Toast.js";

/* Optimistic ids are negative and counted down, so they can never collide with
   a real auto-increment message_id. -1 is skipped because sender_id -1 is the
   seeded "server" account and reusing the sentinel invites confusion. */
let nextTempId = -1000;
export function tempMessageId() {
    return nextTempId--;
}
export function isTempMessage(message_id: number) {
    return message_id <= -1000;
}

export async function promptAI(
    setMessage: (value: string) => void,
    setIfAskAI: (value: boolean) => void,
    prompt: string,
    chat_id: number,
    user_id: number,
    username: string,
) {
    setMessage("");
    setIfAskAI(false);
    try {
        await postJson<standardResponse>("/api/gemini/prompt", { prompt, chat_id, user_id, username });
        readMessages(chat_id, user_id);
    } catch (err) {
        showToast(errorMessage(err));
    }
    // Messages (prompt + AI response) arrive over the 'new-message' socket event
}

export async function promptAIRANDOM(
    setMessage: (value: string) => void,
    setIfAskAI: (value: boolean) => void,
    prompt: string,
    chat_id: number,
    user_id: number,
    username: string,
) {
    setMessage("");
    setIfAskAI(false);
    try {
        await postJson<standardResponse>("/api/gemini/prompt", { prompt, chat_id, user_id, username });
    } catch (err) {
        showToast(errorMessage(err));
    }
}

export async function getPastMessages(
    user_id: number,
    setMessageData: React.Dispatch<React.SetStateAction<SelectMessagesFromChat[]>>,
    chat_id: number,
) {
    try {
        const parsed = await fetchJson<GetMessagesResponse>(`/api/message/getMessages/${user_id}`);
        if (!parsed.success || !parsed.msgData) {
            setMessageData([]);
            return;
        }
        // msgData is [{chat_id, messageData}], so pick the focused chat
        const chat = parsed.msgData.find((c) => c.chat_id === chat_id);
        const history = chat ? chat.messageData : [];

        // Merge rather than replace: a socket message can land while this request
        // is still in flight, and replacing would silently drop it.
        setMessageData((prev) => {
            const seen = new Set(history.map((m) => m.message_id));
            const stragglers = prev.filter((m) => !seen.has(m.message_id) && !isTempMessage(m.message_id));
            return [...history, ...stragglers];
        });
    } catch (err) {
        showToast(errorMessage(err));
        setMessageData([]);
    }
}

export async function sendMessage(
    chat_id: number,
    message: string,
    user_id: number,
    setMessage: (value: string) => void,
    setMessageData: React.Dispatch<React.SetStateAction<SelectMessagesFromChat[]>>,
    username = "",
) {
    const optimistic: SelectMessagesFromChat = {
        message_id: tempMessageId(),
        sender_id: user_id,
        message,
        username,
        sent_at: new Date().toISOString(),
        askGemini: 0,
    } as SelectMessagesFromChat;

    setMessage("");
    setMessageData((prev) => [...prev, optimistic]);

    try {
        await postJson<standardResponse>("/api/message/sendMessage", { chat_id, message, user_id });
        readMessages(chat_id, user_id);
        // the real row arrives over the socket; drop the placeholder
        setMessageData((prev) => prev.filter((m) => m.message_id !== optimistic.message_id));
    } catch (err) {
        setMessageData((prev) => prev.filter((m) => m.message_id !== optimistic.message_id));
        setMessage(message); // hand the text back so it isn't lost
        showToast(errorMessage(err));
    }
}

export async function deleteMessage(
    message_id: number,
    user_id: number,
    sender_id: number,
    chat_id: number,
    setMessageData?: React.Dispatch<React.SetStateAction<SelectMessagesFromChat[]>>,
) {
    let removed: SelectMessagesFromChat[] = [];
    if (setMessageData) {
        setMessageData((prev) => {
            removed = prev;
            return prev.filter((m) => m.message_id !== message_id);
        });
    }

    try {
        await postJson<standardResponse>("/api/message/deleteMessage", { message_id, user_id, sender_id, chat_id });
    } catch (err) {
        if (setMessageData && removed.length) setMessageData(removed); // put it back
        showToast(errorMessage(err));
    }
}

// called automatically when a message is sent in the chat
export async function readMessages(chat_id: number, user_id: number) {
    try {
        await postJson<standardResponse>("/api/message/readMessages", { chat_id, user_id });
    } catch {
        // read receipts are not worth interrupting the user over
    }
}

export async function sendRandomMessage(
    chat_id: number,
    message: string,
    user_id: number,
    setMessage: (value: string) => void,
    setMessageData: React.Dispatch<React.SetStateAction<SelectMessagesFromChat[] | null>>,
    _setCurrChatData?: (value: chatData | null) => void,
    _setStatus?: (value: number) => void,
    _setQueueSize?: (value: number | null) => void,
    username = "",
) {
    const optimistic: SelectMessagesFromChat = {
        message_id: tempMessageId(),
        sender_id: user_id,
        message,
        username,
        sent_at: new Date().toISOString(),
        askGemini: 0,
    } as SelectMessagesFromChat;

    setMessage("");
    setMessageData((prev) => (prev ? [...prev, optimistic] : [optimistic]));

    try {
        await postJson<standardResponse>("/api/randomChats/sendMsgRandom", { chat_id, message, user_id });
        setMessageData((prev) => (prev ? prev.filter((m) => m.message_id !== optimistic.message_id) : prev));
    } catch (err) {
        setMessageData((prev) => (prev ? prev.filter((m) => m.message_id !== optimistic.message_id) : prev));
        setMessage(message);
        showToast(errorMessage(err));
    }
}
