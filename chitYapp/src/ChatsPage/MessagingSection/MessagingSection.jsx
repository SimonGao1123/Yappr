import { useState } from 'react'
import { useEffect } from 'react';

function MessagingSection ({currentUser, chat_id}) {
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
            <PastMessagesData pastMessageData={pastMessageData} currentUser={currentUser} chat_id={chat_id}/>
            <SendMessageInput
            currentUser={currentUser}
            chat_id={chat_id}
            />
        </>
    );
}
function PastMessagesData ({pastMessageData, currentUser, chat_id}) {
    // display for past messages

    const messageDisplay = [];
    for (const messageData of pastMessageData) {
        // each message is {message_id, sender_id, message, username, sent_at}
        const {message_id, sender_id, message, username, sent_at} = messageData;

        messageDisplay.push(
            <li className={`msg-container ${sender_id===currentUser.id?"your-msg":""}`} key={message_id}>
                <p className='msg-username-date'>{username} {formatDateTimeSmart(sent_at)}</p>
                <p className="msg-text">{message}</p>

                {sender_id===currentUser.id?<button onClick={()=>deleteMessage(message_id, currentUser.id, sender_id, chat_id)} className='delete-msg-btn'>Delete</button>:<></>}
            </li>
        );
    }

    return (
        <ul id="msg-display">
            {messageDisplay}
        </ul>
    );



}

function SendMessageInput ({currentUser, chat_id}) {
    const [message, setMessage] = useState("");

    return (
        <div id="send-msg-input">
            <input id="message-send-bar" placeholder='Send Message' type="text" value={message} onChange={(e) => setMessage(e.target.value)}/>
            <button id="send-msg-btn" onClick={() => sendMessage(chat_id, message, currentUser.id, setMessage)}>Send</button>
        </div>
    );
}
function formatDateTimeSmart(isoString) {
  const date = new Date(isoString);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const options = {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  };

  // Same day → just date + time (no weekday)
  return date.toLocaleString("en-US", options);
}
function getPastMessages (user_id, setMessageData, chat_id) {
    fetch(`http://localhost:3000/message/getMessages/${user_id}`, {
        method: "GET"
    }).then(async response => {
        const parsed = await response.json();
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
function sendMessage (chat_id, message, user_id, setMessage) {
    fetch("http://localhost:3000/message/sendMessage", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({chat_id, message, user_id})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
    setMessage("");

    readMessages(chat_id, user_id)
}
function deleteMessage (message_id, user_id, sender_id, chat_id) {
    fetch("http://localhost:3000/message/deleteMessage", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message_id, user_id, sender_id, chat_id})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}
// is called automatically when a message is sent in the chat
function readMessages (chat_id, user_id) {
    fetch("http://localhost:3000/message/readMessages", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({chat_id, user_id})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}

export default MessagingSection;