import { useEffect, useState, lazy, Suspense } from 'react'
import './RandomChatsPage.css';
import type { GetQueueSize, GetQueueStatus, chatData, RandomChatsPage, SendMessageInputRandom, JoinQueueScreenProps, WaitingScreenProps, ChatsDisplayProps, userDataType, UserDisplayRandomProps, DisplayUserDetailsRandomProps, RandomMessageDisplayProps } from '../../definitions/randomChatTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import type {SelectMessagesFromChat, SendMessageInputProp} from '../../definitions/messagingTypes.js'
import { acceptRequest, cancelRequest, rejectRequest, sendRequest } from '../data/FriendsFunctions.js';
import type { DisplayUserDetailsProps } from '../../definitions/chatsTypes.js';
import geminiLogo from '../images/gemini-logo.png';
import { deleteMessage, promptAI, promptAIRANDOM, sendRandomMessage } from '../data/MessageFunctions.js';

export default function RandomChatsPage ({currentUser, ifLightMode}: RandomChatsPage) {

    const[status, setStatus] = useState(0);
    // status:
    // 0 = not in queue 
    // 1 = in queue waiting
    // 2 = in chat

    
    const[chatData, setCurrChatData] = useState<chatData | null>(null);
    const[messageData, setMessageData] = useState<SelectMessagesFromChat[] | null>(null);
    const[queueSize, setQueueSize] = useState<number | null>(null);
    
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
        setStatus={setStatus}
        ifLightMode={ifLightMode}
        /> 
        : status == 1 ? 
        <WaitingScreen
        currentUser={currentUser}
        queueSize={queueSize}
        setStatus={setStatus}
        setCurrChatData={setCurrChatData}
        setMessageData={setMessageData}
        ifLightMode={ifLightMode}
        />
        : status == 2 ?
        <ChatDisplay
        currentUser={currentUser}
        chatData={chatData}
        messageData={messageData}
        setStatus={setStatus}
        setCurrChatData={setCurrChatData}
        setMessageData={setMessageData}
        ifLightMode={ifLightMode}
        setQueueSize={setQueueSize}
        />
        :
        <p>INVALID STATUS ERROR</p>
        }
        </>
    )
}

function JoinQueueScreen ({currentUser, setStatus, ifLightMode}: JoinQueueScreenProps) {
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

function ChatDisplay({ currentUser, chatData, messageData, setStatus, setCurrChatData, setMessageData, ifLightMode, setQueueSize }: ChatsDisplayProps) {
    // shown if status == 2
    let other_user_id: number | undefined = 0;
    if (chatData) {
        const { userData } = chatData;
        other_user_id = userData[0]?.user_id == currentUser.id ? userData[1]?.user_id : userData[0]?.user_id;
    }
    return (
        <div className={`rcp-random-chat-layout${!ifLightMode ? ' dark-mode' : ''}`}> {/* Main 3-column layout, unique class */}
            {/* Center column: messages and controls */}
            <div className="rcp-random-chat-center-col">
                <div className="rcp-random-chat-controls">
                    <button className="rcp-next-chat-btn" onClick={() => {
                        if (chatData) leaveRandomChat(chatData.chat_id, other_user_id ?? 0, currentUser.id, setStatus, setCurrChatData, setMessageData)
                    }}>Next</button>
                    <button className="rcp-leave-chat-btn" onClick={() => chatData && leaveQueue(currentUser.id, setStatus, setCurrChatData, setMessageData)}>Leave RandomYapp</button>
                </div>
                {chatData && (
                    <RandomMessageDisplay
                        currentUser={currentUser}
                        chat_id={chatData.chat_id}
                        ifLightMode={ifLightMode}
                        messageData={messageData}
                        setMessageData={setMessageData}
                        setCurrChatData={setCurrChatData}
                        setStatus={setStatus}
                        setQueueSize={setQueueSize}
                    />
                )}
            </div>
            {/* Right column: user list */}
            <div className="rcp-random-chat-users-col">
                {chatData && (
                    <UsersDisplayRandom
                        userData={chatData.userData}
                        currentUser={currentUser}
                        ifLightMode={ifLightMode}
                    />
                )}
            </div>
        </div>
    );
}
function SendMessageInputRandom ({currentUser, chat_id, ifLightMode, setMessageData, setCurrChatData, setStatus, setQueueSize}: SendMessageInputRandom) {
    const [message, setMessage] = useState("");
    const [ifAskAI, setIfAskAI] = useState(false);
    return (
        <div id="send-msg-input" className={!ifLightMode?"dark-mode":""}>
            <input id="message-send-bar" className={!ifLightMode?"dark-mode":""} placeholder='Send Message' type="text" value={message} onChange={(e) => setMessage(e.target.value)}/>
            <button id="send-msg-btn" className={!ifLightMode?"dark-mode":""} onClick={() => {
                !ifAskAI?
                sendRandomMessage(
                    chat_id, message, currentUser.id, setMessage, setMessageData, setCurrChatData, setStatus, setQueueSize)
                :
                promptAIRANDOM(setMessage, setIfAskAI, message, chat_id, currentUser.id, currentUser.username);
                }}>Send</button>
            <div className="gemini-checkbox-wrapper">
                <label htmlFor='if-ask-gemini'><img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/> Ask Gemini</label>
                <input id="if-ask-gemini" className={!ifLightMode?"dark-mode":""} checked={ifAskAI} onChange={() =>setIfAskAI(!ifAskAI)} type="checkbox"/>
            </div>
        </div>
    );
}
function RandomMessageDisplay ({currentUser, chat_id, ifLightMode, messageData, setMessageData, setCurrChatData, setStatus, setQueueSize}: RandomMessageDisplayProps) {
    // message data:
    /*
        askGemini: number,
        message_id: number,
        sender_id: number,
        message: string,
        username: string, 
        sent_at: string
    */

    const messageElements = [];
    console.log(messageData);
    if (messageData !== null) {
        for (const msgData of messageData) {
            const {message_id, sender_id, message, username, sent_at, askGemini} = msgData;

            if (sender_id !== -1 && askGemini === 1) {
                // prompt ai

                messageElements.push(
                    <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""} ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                        <p className={`msg-username-date ${!ifLightMode?"dark-mode":""}`}>{username} {formatDateTimeSmart(sent_at)}</p>
                        <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>
                        <div className={`gemini-text ${!ifLightMode?"dark-mode":""}`}>
                            <span>Ask Gemini</span>
                            <img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/>
                        </div>
                        {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id)} className={`delete-msg-btn ${!ifLightMode?"dark-mode":""}`}>Delete</button>:<></>}
                    </li>
                )
                
            } else if (sender_id === -1 && askGemini === 1) {
                // gemini response
                messageElements.push(
                    <li className={`ai-response-container ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                        <img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/>
                        <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>
                        <p className={`msg-time ${!ifLightMode?"dark-mode":""}`}>{formatDateTimeSmart(sent_at)}</p>
                    </li>
                );
            } else if (sender_id === -1) {
                messageElements.push(
                <li className='server-msg-container' key={message_id}>
                    <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message} {formatDateTimeSmart(sent_at)}</p>
                </li>);
            } else {
                messageElements.push(
                    <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""} ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                        <p className={`msg-username-date ${!ifLightMode?"dark-mode":""}`}>{username} {formatDateTimeSmart(sent_at)}</p>
                        <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>
    
                        {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id)} className={`delete-msg-btn ${!ifLightMode?"dark-mode":""}`}>Delete</button>:<></>}
                    </li>
                );
            }
        }

        
    }
    return (
        <>
            <ul id="msg-display" className={!ifLightMode?"dark-mode":""}>
                {messageElements}
            </ul>
            <SendMessageInputRandom
            currentUser={currentUser}
            chat_id={chat_id}
            ifLightMode={ifLightMode}
            setMessageData={setMessageData}
            setCurrChatData={setCurrChatData}
            setStatus={setStatus}
            setQueueSize={setQueueSize}
            />
        </>
    );
}

function UsersDisplayRandom({ userData, currentUser, ifLightMode }: UserDisplayRandomProps) {
    // each user has data:
    /*
    user_id: number,
    friend_id: number | undefined,
    updated_at: string | undefined,
    status: string,
    username: string,
    account_created: string,
    description: string | undefined
    */

    const userDisplay = [];
    const [userDetailsOpened, setUserDetailsOpen] = useState<number | null>(null);
    let popupUser: React.ReactNode = null;

    for (const user of userData) {
        const { friend_id, user_id, status, username, account_created, description, updated_at } = user;
        let friendBtns: any;
        let descFriends: string = "";

        if (user_id !== currentUser.id) {
            if (status === "friends") {
                friendBtns = " 👥";
                descFriends = `Friends`;
            } else if (status === "outgoing") {
                friendBtns = (
                    <button className={`cancel-req-btn ${!ifLightMode ? "dark-mode" : ""}`} onClick={() =>
                        cancelRequest(friend_id ?? 0, user_id, username ?? "")
                    }> Cancel </button>
                );
                descFriends = " Outgoing Request";
            } else if (status === "incoming") {
                friendBtns = (
                    <div className="chat-incoming-req-btns">
                        <button className={`reject-req-btn ${!ifLightMode ? "dark-mode" : ""}`} onClick={() =>
                            rejectRequest(friend_id ?? 0, username ?? "", user_id)
                        }> Reject </button>
                        <button className={`accept-req-btn ${!ifLightMode ? "dark-mode" : ""}`} onClick={() =>
                            acceptRequest(friend_id ?? 0, username ?? "", user_id)
                        }> Accept </button>
                    </div>
                );
                descFriends = " Incoming Request";
            } else {
                friendBtns = (
                    <button className={`send-friend-req-btn ${!ifLightMode ? "dark-mode" : ""}`} onClick={() =>
                        sendRequest(currentUser.id, user_id)
                    }>
                        Send Request
                    </button>
                );
            }
        }

        if (userDetailsOpened === user_id) {
            popupUser = (
                <DisplayUserDetailsRandom
                    key={`popup-${user_id}`}
                    user={user}
                    setUserDetailsOpen={setUserDetailsOpen}
                    currentUser={currentUser}
                    ifLightMode={ifLightMode}
                    friendBtns={friendBtns}
                    descFriends={descFriends}
                />
            );
        }

        userDisplay.push(
            <li key={`random-${user_id}`} className="chat-user-list" onClick={() => {
                setUserDetailsOpen(user_id);
            }}>
                {username}{currentUser.id === user_id ? "(You)" : ""}
                <p className={`desc-friends ${!ifLightMode ? "dark-mode" : ""}`}>{descFriends}</p>
            </li>
        );
    }

    return (
        <div style={{ position: "relative" }}>
            <ul>
                {userDisplay}
            </ul>
            {popupUser}
        </div>
    );
}
function DisplayUserDetailsRandom ({user, setUserDetailsOpen, currentUser, ifLightMode, friendBtns, descFriends}: DisplayUserDetailsRandomProps) {
    const {friend_id, user_id, status, username, account_created, description, updated_at} = user;
    return (
        <>
                <div
                id="display-user-details"
                className={!ifLightMode ? "dark-mode" : ""}
                onClick={(e) => e.stopPropagation()}
                >
                    <button id="close-user-details" className={!ifLightMode?"dark-mode":""} onClick={(e) => {
                    setUserDetailsOpen(null)
                    }}>X</button>
                <h3 id="display-user-username" className={!ifLightMode?"dark-mode":""}><b>{username}</b> ID: {user_id} {friendBtns}</h3>
                <p id="creation-date" className={!ifLightMode?"dark-mode":""}>Account created at: {account_created}</p>
                {currentUser.id !== user_id ? <p id="friends-since" className={!ifLightMode?"dark-mode":""}>{descFriends} {updated_at ? `Since ${updated_at}` : ""}</p> : <></>}
                
                <p id="display-user-description" className={!ifLightMode?"dark-mode":""}>Description: {description ? description : "None added"}</p>
            </div>
        
        </>
    )
}

function leaveRandomChat(chat_id: number, other_user_id: number, user_id: number, setStatus: (value: number)=> void, setCurrChatData: (value: chatData | null) => void, setMessageData: (value: SelectMessagesFromChat[] | null) => void) {
    fetch('/api/randomChats/leaveRandomChat', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({chat_id, user_id, other_user_id})
    }).then(async res => {
        const parsed: standardResponse = await res.json();
        if (parsed.success) {
            setStatus(1);
            setCurrChatData(null);
            setMessageData(null);
        }
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
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
    }).catch(err => {
        console.log(err);
    });
}
function formatDateTimeSmart(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const options: Intl.DateTimeFormatOptions = {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  };

  if (isSameDay) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } else {
    return date.toLocaleString("en-US", options);
  }
}