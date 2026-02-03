import type { standardResponse } from "../../definitions/globalType.js";
import type { GetMessagesResponse, SelectMessagesFromChat } from "../../definitions/messagingTypes.js";
import type { chatData, GetQueueStatus } from "../../definitions/randomChatTypes.js";

export function promptAI (setMessage:(value: string)=> void, setIfAskAI:(value: boolean)=> void, prompt: string, chat_id: number, user_id: number, username: string, setMessageData: (value: SelectMessagesFromChat[]) => void) {
    fetch("/api/gemini/prompt", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt, chat_id, user_id, username})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
    setMessage("");
    setIfAskAI(false);

    readMessages(chat_id, user_id)
    // update messages so it updates immediately
    getPastMessages(user_id, setMessageData, chat_id);
}
export function promptAIRANDOM (setMessage:(value: string)=> void, setIfAskAI:(value: boolean)=> void, prompt: string, chat_id: number, user_id: number, username: string) {
    fetch("/api/gemini/prompt", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt, chat_id, user_id, username})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
    setMessage("");
    setIfAskAI(false);

}
export function getPastMessages (user_id: number, setMessageData: (value: SelectMessagesFromChat[])=>void, chat_id: number) {
    fetch(`/api/message/getMessages/${user_id}`, {
        method: "GET"
    }).then(async response => {
        const parsed: GetMessagesResponse = await response.json();
        if (!parsed.success || !parsed.msgData) {
            setMessageData([]);
            return;
        }
        
        const chat = parsed.msgData.find(
            c => c.chat_id === chat_id
        ) // each element in msgData is {chat_id, messageData}, so need to find object where chat_id is the one focused on to portray correct msgs
        setMessageData(chat ? chat.messageData : []);
        
    }).catch(err => {
        console.log(err);
        setMessageData([]);
    });
}
export function sendMessage (chat_id: number, message: string, user_id: number, setMessage: (value: string) => void, setMessageData: (value: SelectMessagesFromChat[]) => void) {
    fetch("/api/message/sendMessage", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({chat_id, message, user_id})
    }).then(async response => {
        const parsed:standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
    setMessage("");

    readMessages(chat_id, user_id)
    getPastMessages(user_id, setMessageData, chat_id);
}
export function deleteMessage (message_id: number, user_id: number, sender_id: number, chat_id: number) {
    fetch("/api/message/deleteMessage", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message_id, user_id, sender_id, chat_id})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}
// is called automatically when a message is sent in the chat
export function readMessages (chat_id: number, user_id: number) {
    fetch("/api/message/readMessages", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({chat_id, user_id})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}
export function sendRandomMessage (chat_id: number, message: string, user_id: number, setMessage: (value: string) => void, setMessageData: (value: SelectMessagesFromChat[] | null) => void, setCurrChatData: (value: chatData | null) => void, setStatus: (value: number) => void, setQueueSize: (value: number | null)=>void) {
    fetch("/api/randomChats/sendMsgRandom", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({chat_id, message, user_id})
    }).then(async response => {
        const parsed:standardResponse = await response.json();
        
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
    setMessage("");
    getQueueStatus(user_id, setStatus, setCurrChatData, setMessageData, setQueueSize);

}
function getQueueStatus (id: number, setStatus: (value: number) => void, setCurrChatData: (value: chatData | null) => void, setMessageData: (value: SelectMessagesFromChat[] | null) => void, setQueueSize: (value: number | null)=>void) {
    fetch(`/api/randomChats/getRandomChat/${id}`)
    .then(async res => {
        const parsed: GetQueueStatus = await res.json();
        // set chat if in chat
        if (!parsed.success) {
            console.log(parsed.message); // error
            return;
        }
        if (parsed.waiting == false && parsed.inChat == false) {
            setStatus(0);
            setCurrChatData(null);
            setMessageData(null); // currently not in queue or in a chat
        } else if (parsed.waiting == true && parsed.inChat == false) {
            // waiting in queue
            setStatus(1);
            setCurrChatData(null);
            setMessageData(null);
            setQueueSize(parsed.queueSize ?? null); // get queue size if you are waiting
        } else if (parsed.inChat == true) {
            // in chat
            setStatus(2);
            setCurrChatData(parsed.chatData ?? null);
            setMessageData(parsed.messages ?? null);
        }
    }).catch(err => {
        console.log(err);
    });
}