import { useState } from 'react'
import { useEffect } from 'react';

import geminiLogo from '../../images/gemini-logo.png';
import './MessagingSection.css';
import type { MessagingSectionProp, PastMessagesDataProp, SendMessageInput, SendMessageInputProp, SelectMessagesFromChat, GetMessagesResponse } from '../../../definitions/messagingType.js';
import type { standardResponse } from '../../../definitions/globalType.js';

function MessagingSection ({currentUser, chat_id, ifLightMode}: MessagingSectionProp) {
    const [pastMessageData, setMessageData] = useState([]); // only specific to certain messages
    useEffect(() => {
            if (!currentUser?.id) return;
    
            // initial fetch
            getPastMessages(currentUser.id, setMessageData, chat_id);

            
            const intervalId = setInterval(() => {
                getPastMessages(currentUser.id, setMessageData, chat_id);
            }, 2000);
    
            return () => clearInterval(intervalId);
        }, [currentUser?.id, chat_id, pastMessageData]);
        
    return (
        <>
            <PastMessagesData pastMessageData={pastMessageData} currentUser={currentUser} chat_id={chat_id} ifLightMode={ifLightMode}/>
            <SendMessageInput
            currentUser={currentUser}
            chat_id={chat_id}
            ifLightMode={ifLightMode}
            />
        </>
    );
}
function PastMessagesData ({pastMessageData, currentUser, chat_id, ifLightMode}: PastMessagesDataProp) {
    // display for past messages

    const messageDisplay = [];
    for (const messageData of pastMessageData) {
        // each message is {message_id, sender_id, message, username, sent_at}
        const {message_id, sender_id, message, username, sent_at, askGemini} = messageData;

        if (sender_id !== -1 && askGemini === 1) {
            // prompt
            messageDisplay.push(
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
            messageDisplay.push(
                <li className={`ai-response-container ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                    <img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/>
                    <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>
                    <p className={`msg-time ${!ifLightMode?"dark-mode":""}`}>{formatDateTimeSmart(sent_at)}</p>
                </li>
            );
        } else if (sender_id === -1) {
            // server message different format
            messageDisplay.push(
            <li className='server-msg-container'>
                <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message} {formatDateTimeSmart(sent_at)}</p>
            </li>
            );
        } else {
            messageDisplay.push(
                <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""} ${!ifLightMode?"dark-mode":""}`} key={message_id}>
                    <p className={`msg-username-date ${!ifLightMode?"dark-mode":""}`}>{username} {formatDateTimeSmart(sent_at)}</p>
                    <p className={`msg-text ${!ifLightMode?"dark-mode":""}`}>{message}</p>

                    {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id)} className={`delete-msg-btn ${!ifLightMode?"dark-mode":""}`}>Delete</button>:<></>}
                </li>
            );
        }
    }

    return (
        <ul id="msg-display" className={!ifLightMode?"dark-mode":""}>
            {messageDisplay}
        </ul>
    );



}

function SendMessageInput ({currentUser, chat_id, ifLightMode}: SendMessageInputProp) {
    const [message, setMessage] = useState("");
    const [ifAskAI, setIfAskAI] = useState(false);

    return (
        <div id="send-msg-input" className={!ifLightMode?"dark-mode":""}>
            <input id="message-send-bar" className={!ifLightMode?"dark-mode":""} placeholder='Send Message' type="text" value={message} onChange={(e) => setMessage(e.target.value)}/>
            <button id="send-msg-btn" className={!ifLightMode?"dark-mode":""} onClick={() => {
                !ifAskAI?
                sendMessage(chat_id, message, currentUser.id, setMessage)
                :
                promptAI(setMessage, setIfAskAI, message, chat_id, currentUser.id, currentUser.username);
                }}>Send</button>
            <div className="gemini-checkbox-wrapper">
                <label htmlFor='if-ask-gemini'><img src={geminiLogo} alt="gemini-logo" className='gemini-logo'/> Ask Gemini</label>
                <input id="if-ask-gemini" className={!ifLightMode?"dark-mode":""} checked={ifAskAI} onChange={() =>setIfAskAI(!ifAskAI)} type="checkbox"/>
            </div>
        </div>
    );
}
function promptAI (setMessage:(value: string)=> void, setIfAskAI:(value: boolean)=> void, prompt: string, chat_id: number, user_id: number, username: string) {
    fetch("/gemini/prompt", {
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

function getPastMessages (user_id: number, setMessageData: (value: SelectMessagesFromChat[])=>void, chat_id: number) {
    fetch(`/message/getMessages/${user_id}`, {
        method: "GET"
    }).then(async response => {
        const parsed: GetMessagesResponse = await response.json();
        if (!parsed.success) {
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
function sendMessage (chat_id: number, message: string, user_id: number, setMessage: (value: string) => void) {
    fetch("/message/sendMessage", {
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
}
function deleteMessage (message_id: number, user_id: number, sender_id: number, chat_id: number) {
    fetch("/message/deleteMessage", {
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
function readMessages (chat_id: number, user_id: number) {
    fetch("/message/readMessages", {
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

export default MessagingSection;