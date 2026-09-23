import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react'

import geminiLogo from '../../images/gemini-logo.png';
import './MessagingSection.css';
import type { MessagingSectionProp, PastMessagesDataProp, SendMessageInput, SendMessageInputProp, SelectMessagesFromChat, GetMessagesResponse } from '../../../definitions/messagingTypes.js';
import type { standardResponse } from '../../../definitions/globalType.js';
import { deleteMessage, getPastMessages, promptAI, sendMessage } from '../../data/MessageFunctions.js';
import { socket } from '../../socket.js';

function MessagingSection ({currentUser, chat_id, ifLightMode}: MessagingSectionProp) {
    const [pastMessageData, setMessageData] = useState<SelectMessagesFromChat[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
            if (!currentUser?.id) return;

            // Join the room and attach the listener BEFORE fetching history so a
            // message landing mid-request isn't lost. getPastMessages merges into
            // existing state rather than replacing it, for the same reason.
            socket.emit('join-chat', chat_id);

            const handleNewMessage = (msg: SelectMessagesFromChat) => {
                setMessageData(prev =>
                    prev.some(m => m.message_id === msg.message_id) ? prev : [...prev, msg]
                );
            };
            socket.on('new-message', handleNewMessage);

            setMessageData([]);
            getPastMessages(currentUser.id, setMessageData, chat_id);

            return () => {
                socket.emit('leave-chat', chat_id);
                socket.off('new-message', handleNewMessage);
            };
        }, [currentUser?.id, chat_id]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [pastMessageData]);
        
    return (
        <>
            <PastMessagesData pastMessageData={pastMessageData} currentUser={currentUser} chat_id={chat_id} ifLightMode={ifLightMode} messagesEndRef={messagesEndRef} setMessageData={setMessageData}/>
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
const PastMessagesData = memo(function PastMessagesData ({pastMessageData, currentUser, chat_id, ifLightMode, messagesEndRef, setMessageData}: PastMessagesDataProp & { messagesEndRef: React.RefObject<HTMLDivElement | null>, setMessageData: React.Dispatch<React.SetStateAction<SelectMessagesFromChat[]>> }) {
    // display for past messages - memoized to prevent re-renders when parent updates

    const messageDisplay = useMemo(() => {
    const messages = [];
    for (const messageData of pastMessageData) {
        // each message is {message_id, sender_id, message, username, sent_at}
        const {message_id, sender_id, message, username, sent_at, askGemini} = messageData;

        if (sender_id !== -1 && askGemini === 1) {
            // prompt
            messages.push(
                <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""}`} key={message_id}>
                    <p className="msg-username-date">{username} {formatDateTimeSmart(sent_at)}</p>
                    <p className="msg-text">{message}</p>
                    <div className="gemini-text">
                        <span>Ask Gemini</span>
                        <img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/>
                    </div>
                    {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id, setMessageData)} className="delete-msg-btn">Delete</button>:<></>}
                </li>
            );
        } else if (sender_id === -1 && askGemini === 1) {
            // gemini response
            messages.push(
                <li className="ai-response-container" key={message_id}>
                    <img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/>
                    <p className="msg-text">{message}</p>
                    <p className="msg-time">{formatDateTimeSmart(sent_at)}</p>
                </li>
            );
        } else if (sender_id === -1) {
            // server message different format
            messages.push(
            <li className='server-msg-container' key={message_id}>
                <p className="msg-text">{message} {formatDateTimeSmart(sent_at)}</p>
            </li>
            );
        } else {
            messages.push(
                <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""}`} key={message_id}>
                    <p className="msg-username-date">{username} {formatDateTimeSmart(sent_at)}</p>
                    <p className="msg-text">{message}</p>

                    {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id, setMessageData)} className="delete-msg-btn">Delete</button>:<></>}
                </li>
            );
        }
    }

    return messages;
    }, [pastMessageData, currentUser.id, chat_id, ifLightMode, setMessageData]);

    return (
        <ul id="msg-display">
            {pastMessageData.length === 0 ? (
                <li className="empty-state">
                    <span className="empty-state__title">No messages yet</span>
                    <span>Say something to get the conversation started.</span>
                </li>
            ) : null}
            {messageDisplay}
            <div ref={messagesEndRef} />
        </ul>
    );
});

function SendMessageInput ({currentUser, chat_id, ifLightMode, setMessageData}: SendMessageInputProp) {
    const [message, setMessage] = useState("");
    const [ifAskAI, setIfAskAI] = useState(false);

    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        try {
            if (!ifAskAI) {
                await sendMessage(chat_id, message, currentUser.id, setMessage, setMessageData, currentUser.username);
            } else {
                await promptAI(setMessage, setIfAskAI, message, chat_id, currentUser.id, currentUser.username);
            }
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div id="send-msg-input">
            <label className="sr-only" htmlFor="message-send-bar">Message</label>
            <input id="message-send-bar" placeholder='Send Message' type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown}/>
            <button id="send-msg-btn" onClick={handleSend} disabled={sending || !message.trim()}>
                {sending ? <span className="spinner" aria-hidden="true" /> : "Send"}
            </button>
            <div className="gemini-checkbox-wrapper">
                <label htmlFor='if-ask-gemini'><img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/> Ask Gemini</label>
                <input id="if-ask-gemini" checked={ifAskAI} onChange={() =>setIfAskAI(!ifAskAI)} type="checkbox"/>
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