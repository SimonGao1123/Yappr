import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react'

import geminiLogo from '../../images/gemini-logo.png';
import './MessagingSection.css';
import type { MessagingSectionProp, PastMessagesDataProp, SendMessageInput, SendMessageInputProp, SelectMessagesFromChat, GetMessagesResponse } from '../../../definitions/messagingTypes.js';
import type { standardResponse } from '../../../definitions/globalType.js';
import { deleteMessage, getPastMessages, promptAI, sendMessage } from '../../data/MessageFunctions.js';

function MessagingSection ({currentUser, chat_id, ifLightMode}: MessagingSectionProp) {
    const [pastMessageData, setMessageData] = useState<SelectMessagesFromChat[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
            if (!currentUser?.id) return;
    
            // initial fetch
            getPastMessages(currentUser.id, setMessageData, chat_id);

            
            const intervalId = setInterval(() => {
                getPastMessages(currentUser.id, setMessageData, chat_id);
            }, 2000);
    
            return () => clearInterval(intervalId);
        }, [currentUser?.id, chat_id]); // Remove pastMessageData to prevent infinite re-renders

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [pastMessageData]);
        
    return (
        <>
            <PastMessagesData pastMessageData={pastMessageData} currentUser={currentUser} chat_id={chat_id} ifLightMode={ifLightMode} messagesEndRef={messagesEndRef}/>
            <SendMessageInput
            currentUser={currentUser}
            chat_id={chat_id}
            ifLightMode={ifLightMode}
            setMessageData={setMessageData}
            />
        </>
    );
}

// cache past messages to prevent re-renders when parent updates
const PastMessagesData = memo(function PastMessagesData ({pastMessageData, currentUser, chat_id, ifLightMode, messagesEndRef}: PastMessagesDataProp & { messagesEndRef: React.RefObject<HTMLDivElement | null> }) {
    // display for past messages - memoized to prevent re-renders when parent updates

    const messageDisplay = useMemo(() => {
    const messages = [];
    for (const messageData of pastMessageData) {
        // each message is {message_id, sender_id, message, username, sent_at}
        const {message_id, sender_id, message, username, sent_at, askGemini} = messageData;

        if (sender_id !== -1 && askGemini === 1) {
            // prompt
            messages.push(
                <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""} ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                    <p className={`msg-username-date ${!ifLightMode?"dark-mode":""}`}>{username} {formatDateTimeSmart(sent_at)}</p>
                    <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>
                    <div className={`gemini-text ${!ifLightMode?"dark-mode":""}`}>
                        <span>Ask Gemini</span>
                        <img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/>
                    </div>
                    {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id)} className={`delete-msg-btn ${!ifLightMode?"dark-mode":""}`}>Delete</button>:<></>}
                </li>
            );
        } else if (sender_id === -1 && askGemini === 1) {
            // gemini response
            messages.push(
                <li className={`ai-response-container ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                    <img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/>
                    <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>
                    <p className={`msg-time ${!ifLightMode?"dark-mode":""}`}>{formatDateTimeSmart(sent_at)}</p>
                </li>
            );
        } else if (sender_id === -1) {
            // server message different format
            messages.push(
            <li className='server-msg-container' key={message_id}>
                <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message} {formatDateTimeSmart(sent_at)}</p>
            </li>
            );
        } else {
            messages.push(
                <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""} ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                    <p className={`msg-username-date ${!ifLightMode?"dark-mode":""}`}>{username} {formatDateTimeSmart(sent_at)}</p>
                    <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>

                    {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id)} className={`delete-msg-btn ${!ifLightMode?"dark-mode":""}`}>Delete</button>:<></>}
                </li>
            );
        }
    }

    return messages;
    }, [pastMessageData, currentUser.id, chat_id, ifLightMode]);

    return (
        <ul id="msg-display" className={!ifLightMode?"dark-mode":""}>
            {messageDisplay}
            <div ref={messagesEndRef} />
        </ul>
    );
});

function SendMessageInput ({currentUser, chat_id, ifLightMode, setMessageData}: SendMessageInputProp) {
    const [message, setMessage] = useState("");
    const [ifAskAI, setIfAskAI] = useState(false);

    const handleSend = () => {
        if (!message.trim()) return;
        if (!ifAskAI) {
            sendMessage(chat_id, message, currentUser.id, setMessage, setMessageData);
        } else {
            promptAI(setMessage, setIfAskAI, message, chat_id, currentUser.id, currentUser.username, setMessageData);
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


export default MessagingSection;