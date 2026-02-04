import { useEffect, useState, useRef } from 'react'
import './RandomChatsPage.css';
import type { GetQueueSize, GetQueueStatus, chatData, RandomChatsPage, SendMessageInputRandom, JoinQueueScreenProps, WaitingScreenProps, ChatsDisplayProps, userDataType, UserDisplayRandomProps, DisplayUserDetailsRandomProps, RandomMessageDisplayProps } from '../../definitions/randomChatTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import type {SelectMessagesFromChat, SendMessageInputProp} from '../../definitions/messagingTypes.js'
import { acceptRequest, cancelRequest, rejectRequest, sendRequest } from '../data/FriendsFunctions.js';
import type { DisplayUserDetailsProps } from '../../definitions/chatsTypes.js';
import geminiLogo from '../images/gemini-logo.png';
import { deleteMessage, promptAI, promptAIRANDOM, sendRandomMessage } from '../data/MessageFunctions.js';

export default function RandomChatsPage ({currentUser, ifLightMode, currentFriends, outgoingFriendReq, incomingFriendReq}: RandomChatsPage) {

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

        return () => {
            clearInterval(intervalId);
            // Leave queue/chat on unmount or user change
            fetch('/api/randomChats/leaveQueue', {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({user_id: currentUser.id})
            }).catch(err => console.log(err));
        };
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
        currentFriends={currentFriends}
        outgoingFriendReq={outgoingFriendReq}
        incomingFriendReq={incomingFriendReq}
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
        <div className={`rcp-join-queue-screen${!ifLightMode ? ' dark-mode' : ''}`}>
            <div className={`rcp-queue-card${!ifLightMode ? ' dark-mode' : ''}`}>
                <div className="rcp-queue-icon">🎲</div>
                <h3 className={`rcp-queue-title${!ifLightMode ? ' dark-mode' : ''}`}>Random Yapp</h3>
                <p className={`rcp-queue-subtitle${!ifLightMode ? ' dark-mode' : ''}`}>
                    Meet new people! Join the queue to be matched with a random user for a chat.
                </p>
                <button 
                    className="rcp-join-queue-btn"
                    onClick={() => joinQueue(currentUser.id, setStatus)}
                >
                    Join Queue
                </button>
            </div>
        </div>
    ) 
}
function WaitingScreen ({currentUser, queueSize, setStatus, setCurrChatData, setMessageData, ifLightMode}: WaitingScreenProps) {
    // shown if status == 1

    return (
        <div className={`rcp-waiting-screen${!ifLightMode ? ' dark-mode' : ''}`}>
            <div className={`rcp-waiting-card${!ifLightMode ? ' dark-mode' : ''}`}>
                <div className={`rcp-waiting-spinner${!ifLightMode ? ' dark-mode' : ''}`}></div>
                <h3 className={`rcp-waiting-title${!ifLightMode ? ' dark-mode' : ''}`}>Looking for a Match...</h3>
                <p className={`rcp-waiting-subtitle${!ifLightMode ? ' dark-mode' : ''}`}>
                    Hang tight! We're finding someone to chat with.
                </p>
                <div className={`rcp-queue-count${!ifLightMode ? ' dark-mode' : ''}`}>
                    <span className="rcp-queue-count-icon">👥</span>
                    <p className={`rcp-queue-count-text${!ifLightMode ? ' dark-mode' : ''}`}>
                        {queueSize ? `${queueSize} people in queue` : "Loading..."}
                    </p>
                </div>
                <button 
                    className="rcp-leave-queue-btn"
                    onClick={() => leaveQueue(currentUser.id, setStatus, setCurrChatData, setMessageData)}
                >
                    Leave Queue
                </button>
                <p className={`rcp-waiting-tip${!ifLightMode ? ' dark-mode' : ''}`}>
                    💡 You'll be matched automatically when another user joins!
                </p>
            </div>
        </div>
    )

}

function ChatDisplay({ currentUser, chatData, messageData, setStatus, setCurrChatData, setMessageData, ifLightMode, setQueueSize, currentFriends, outgoingFriendReq, incomingFriendReq }: ChatsDisplayProps) {
    // shown if status == 2
    let other_user_id: number | undefined = 0;
    if (chatData) {
        const { userData } = chatData;
        other_user_id = userData[0]?.user_id == currentUser.id ? userData[1]?.user_id : userData[0]?.user_id;
    }
    return (
        <div className={`rcp-random-chat-layout${!ifLightMode ? ' dark-mode' : ''}`}> {/* Main 3-column layout, unique class */}
            {/* Center column: messages and controls */}
            <div className={`rcp-random-chat-center-col${!ifLightMode ? ' dark-mode' : ''}`}>
                <div className={`rcp-random-chat-controls${!ifLightMode ? ' dark-mode' : ''}`}>
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
            <div className={`rcp-random-chat-users-col${!ifLightMode ? ' dark-mode' : ''}`}>
                {chatData && (
                    <UsersDisplayRandom
                        userData={chatData.userData}
                        currentUser={currentUser}
                        ifLightMode={ifLightMode}
                        currentFriends={currentFriends}
                        outgoingFriendReq={outgoingFriendReq}
                        incomingFriendReq={incomingFriendReq}
                    />
                )}
            </div>
        </div>
    );
}
function SendMessageInputRandom ({currentUser, chat_id, ifLightMode, setMessageData, setCurrChatData, setStatus, setQueueSize}: SendMessageInputRandom) {
    const [message, setMessage] = useState("");
    const [ifAskAI, setIfAskAI] = useState(false);

    const handleSend = () => {
        if (!message.trim()) return;
        if (!ifAskAI) {
            sendRandomMessage(chat_id, message, currentUser.id, setMessage, setMessageData, setCurrChatData, setStatus, setQueueSize);
        } else {
            promptAIRANDOM(setMessage, setIfAskAI, message, chat_id, currentUser.id, currentUser.username);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div id="send-msg-input" className={!ifLightMode?"dark-mode":""}>
            <input id="message-send-bar" className={!ifLightMode?"dark-mode":""} placeholder='Send Message' type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown}/>
            <button id="send-msg-btn" className={!ifLightMode?"dark-mode":""} onClick={handleSend}>Send</button>
            <div className={`gemini-checkbox-wrapper${!ifLightMode ? ' dark-mode' : ''}`}>
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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messageData]);

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
                <li className={`server-msg-container ${!ifLightMode?"dark-mode":""}`} key={message_id}>
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
                <div ref={messagesEndRef} />
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

function UsersDisplayRandom({ userData, currentUser, ifLightMode, currentFriends, outgoingFriendReq, incomingFriendReq }: UserDisplayRandomProps) {
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
        const { user_id, username, account_created, description, updated_at } = user;
        let friendBtns: any;
        let descFriends: string = "";

        // Determine friend status from arrays (these are updated every 1s by App.tsx)
        const friendEntry = currentFriends.find(f => f.user_id === user_id);
        const outgoingEntry = outgoingFriendReq.find(f => f.user_id === user_id);
        const incomingEntry = incomingFriendReq.find(f => f.user_id === user_id);

        if (user_id !== currentUser.id) {
            if (friendEntry) {
                friendBtns = " 👥";
                descFriends = `Friends`;
            } else if (outgoingEntry) {
                friendBtns = (
                    <button className={`cancel-req-btn ${!ifLightMode ? "dark-mode" : ""}`} onClick={() =>
                        cancelRequest(outgoingEntry.friend_id, user_id, username ?? "")
                    }> Cancel </button>
                );
                descFriends = " Outgoing Request";
            } else if (incomingEntry) {
                friendBtns = (
                    <div className="chat-incoming-req-btns">
                        <button className={`reject-req-btn ${!ifLightMode ? "dark-mode" : ""}`} onClick={() =>
                            rejectRequest(incomingEntry.friend_id, username ?? "", user_id)
                        }> Reject </button>
                        <button className={`accept-req-btn ${!ifLightMode ? "dark-mode" : ""}`} onClick={() =>
                            acceptRequest(incomingEntry.friend_id, username ?? "", user_id)
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
            <li key={`random-${user_id}`} className={`chat-user-list ${!ifLightMode ? "dark-mode" : ""}`} onClick={() => {
                setUserDetailsOpen(user_id);
            }}>
                {username}{currentUser.id === user_id ? "(You)" : ""}
                <p className={`desc-friends ${!ifLightMode ? "dark-mode" : ""}`}>{descFriends}</p>
            </li>
        );
    }

    return (
        <div style={{ position: "relative", zIndex: 1000 }}>
            <h3 className={`rcp-users-header${!ifLightMode ? ' dark-mode' : ''}`}>Users in Chat</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
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

  // Get user's local timezone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const options: Intl.DateTimeFormatOptions = {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: userTimeZone
  };

  if (isSameDay) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: userTimeZone });
  } else {
    return date.toLocaleString("en-US", options);
  }
}