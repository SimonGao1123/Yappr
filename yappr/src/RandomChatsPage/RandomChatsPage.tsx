import { useEffect, useState, lazy, Suspense } from 'react'
import './RandomChatsPage.css';
import type { GetQueueSize, GetQueueStatus, chatData, RandomChatsPage, JoinQueueScreenProps, WaitingScreenProps, ChatsDisplayProps } from '../../definitions/randomChatTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import type {SelectMessagesFromChat} from '../../definitions/messagingTypes.js'
export default function RandomChatsPage ({currentUser}: RandomChatsPage) {

    const[status, setStatus] = useState(0);
    // status:
    // 0 = not in queue 
    // 1 = in queue waiting
    // 2 = in chat

    
    const[chatData, setCurrChatData] = useState<chatData | null>(null);
    const[messageData, setMessageData] = useState<SelectMessagesFromChat[] | null>(null);
    const[queueSize, setQueueSize] = useState<number | null>(null);
    
    console.log(status);

    useEffect(() => {
        if (!currentUser?.id) return;
          getQueueStatus(currentUser.id, setStatus, setCurrChatData, setMessageData, setQueueSize);
        const intervalId = setInterval(() => {
            getQueueStatus(currentUser.id, setStatus, setCurrChatData, setMessageData, setQueueSize);
        }, 1500);

        return () => clearInterval(intervalId);
    }, [currentUser?.id]);
    // constantly refresh random chat pool data
    
    return (
        <>
        {status == 0 ? 
        <JoinQueueScreen 
        currentUser={currentUser}
        setStatus={setStatus}/> 
        : status == 1 ? 
        <WaitingScreen
        currentUser={currentUser}
        queueSize={queueSize}
        setStatus={setStatus}
        setCurrChatData={setCurrChatData}
        setMessageData={setMessageData}
        />
        : status == 2 ?
        <ChatDisplay
        currentUser={currentUser}
        chatData={chatData}
        messageData={messageData}
        setStatus={setStatus}
        setCurrChatData={setCurrChatData}
        setMessageData={setMessageData}
        />
        :
        <p>INVALID STATUS ERROR</p>
        }
        </>
    )
}

function JoinQueueScreen ({currentUser, setStatus}: JoinQueueScreenProps) {
    // shown if status == 0

    return (
        <>
            <h3>Currently not in Queue</h3>
            <button onClick={() => joinQueue(currentUser.id, setStatus)}>Join Queue</button>
        </>
    ) 
}
function WaitingScreen ({currentUser, queueSize, setStatus, setCurrChatData, setMessageData}: WaitingScreenProps) {
    // shown if status == 1

    return (
        <>
            <h3>Currently waiting in Queue</h3>
            <p>There are: {queueSize ? queueSize : "Loading..."} people in queue</p>    
            <button onClick={() => leaveQueue(currentUser.id, setStatus, setCurrChatData, setMessageData)}>Leave Queue</button>
        </>
    )

}

// TODO: 
function ChatDisplay ({currentUser, chatData, messageData, setStatus, setCurrChatData, setMessageData}: ChatsDisplayProps) {
    // shown if status == 2
    return (
        <>
        </>
    )
}
function leaveQueue(user_id: number, setStatus: (value: number)=> void, setCurrChatData: (value: chatData | null) => void, setMessageData: (value: SelectMessagesFromChat[] | null) => void) {
    fetch('/api/randomChats/leaveQueue', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({user_id})
    }).then(async res => {
        const parsed: standardResponse = await res.json();
        if (parsed.success) {
            setStatus(0);
            setCurrChatData(null);
            setMessageData(null);
        }
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}
function joinQueue(user_id: number, setStatus: (value: number)=> void) {
    fetch('/api/randomChats/joinQueue', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({user_id})
    }).then(async res => {
        const parsed: standardResponse = await res.json();
        console.log(parsed.message);
        if (parsed.success) {
            setStatus(1); // set to waiting status immediately (if successful)
        }
    }).catch(err => {
        console.log(err);
    });
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
        console.log(parsed.message); 
    }).catch(err => {
        console.log(err);
    });
}
