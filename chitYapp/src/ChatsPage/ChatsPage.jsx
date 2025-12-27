import { useState } from 'react'
import { useEffect } from 'react';
import './ChatsPage.css';

function ChatsPage ({currentUser, currentFriends}) {
    // currentFriends holds array of {user_id, username, friend_id}
    const [createChatsDisplay, setCreateChatsDisplay] = useState(false);
    const [allChats, setAllChats] = useState([]);
    return (
        <>
            <button id="show-create-chat-popup" onClick={() => setCreateChatsDisplay(true)}>Create Chat</button>
            {createChatsDisplay ? <CreateChatsPopUp currentFriends={currentFriends} currentUser={currentUser} setCreateChatsDisplay={setCreateChatsDisplay}/> : <></>}

            <DisplayChats currentUser={currentUser} allChats={allChats} setAllChats={setAllChats}/>
        </>
    )
}

function DisplayChats ({currentUser, allChats, setAllChats}) {
    const [selectedChat, setSelectedChat] = useState(null); // holds {chat object}
    useEffect(() => {
        if (!currentUser?.id) return;

        // initial fetch
        getChatData(currentUser.id, setAllChats);

        const intervalId = setInterval(() => {
            getChatData(currentUser.id, setAllChats);
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id]);

    const chat_list = [];

    for (const chat of allChats || []) {
        // each chat is object {creator_id, creator_username, chat_name, userList: [{username, user_id, status, friend_id (null if no friend_id)}], chat_id}
        const {chat_name} = chat;
        chat_list.push(
            <li key={chat.chat_id}
            onClick={() => setSelectedChat(chat)}
            className={`chat ${selectedChat?.chat_id===chat.chat_id?"selected-chat":""}`}
            >
                <p>{chat_name}</p>
            </li>
        );
    }

    return (
        <>
        <main id="main-chat-page">
            <ul id="chat-list">
                {chat_list}
            </ul>
            {selectedChat ? 
                <ChatLayout
                    creator_id={selectedChat.creator_id}
                    creator_username={selectedChat.creator_username}
                    chat_name={selectedChat.chat_name}
                    userList={selectedChat.userList}
                    chat_id={selectedChat.chat_id}   
                    currentUser={currentUser}
                /> 
                
                : <></>}
        </main>
        </>
    );

}

// TODO:
function ChatLayout ({creator_id, creator_username, chat_name, userList, chat_id, currentUser}) {
    
    return (
        <div id="chat-layout">
            <UsersLayout
                chat_id={chat_id}
                userList={userList}
                creator_id={creator_id}
                creator_username={creator_username}
                currentUser={currentUser}
            />
        </div>
        
    );
}
function UsersLayout ({chat_id, userList, creator_id, creator_username, currentUser}) {
    // userList contains array of {friend_id (could be null), user_id, status, username}
    const userDisplay = [];

    for (const user of userList) {
        const {friend_id, user_id, status, username} = user;
        let friendBtns;

        if (user_id !== currentUser.id) {    
            console.log(username + status);
            
            if (status==="friends") {
                friendBtns = "Friends";
            } else if (status === "outgoing") {
                friendBtns = (
                    <button className="cancel-req-btn" onClick={() =>
                        cancelRequest(friend_id, user_id, username)
                    }> Cancel </button>
                );
            } else if (status === "incoming") {
                friendBtns = (
                    <div id="chat-incoming-req-btns">
                    <button className="reject-req-btn" onClick={() =>
                            rejectRequest(friend_id, username, user_id)
                        }> Reject </button>
                    <button className="accept-req-btn" onClick={() =>
                            acceptRequest(friend_id, username, user_id)
                        }> Accept </button>
                    </div>
                );
            } else {
                friendBtns = (
                    <button id="send-friend-req-btn" onClick={() => 
                        sendRequest(currentUser.id,user_id)
                    }>
                        Send Request
                    </button>
                )
            }
        }
        
        userDisplay.push(
            <li key={`${chat_id}-${user.username}`} className='chat-user-list'>
                {`${creator_id===user_id?"👑":""}`}{username}
                {friendBtns}
            </li>
        );
    }
    return (
        <ul>
            {userDisplay}
        </ul>
    );
}
function sendRequest (sender_id, receiver_id) {
    fetch("http://localhost:3000/friends/sendFriendRequest", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({sender_id, receiver_id})
        }).then(async response => {
            const parsed = await response.json();
            console.log(parsed);
        }).catch(err => {
            console.log(err);
        });
}
function cancelRequest (friend_id, receiver_id, receiver_username) {
        fetch("http://localhost:3000/friends/cancel", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, receiver_id, receiver_username})
        }).then(async response => {
            const parsed = await response.json();
            console.log(parsed.message);
        }).catch(err => {
            console.log(err);
        });
}
function rejectRequest (friend_id, sender_username, sender_id) {
        fetch("http://localhost:3000/friends/reject", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, sender_id, sender_username})
        }).then(async response => {
            const parsed = await response.json();
            console.log(parsed.message);
        }).catch(err => {
            console.log(err);
        });
    }
    function acceptRequest (friend_id, sender_username, sender_id) {
        fetch("http://localhost:3000/friends/accept", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, sender_id, sender_username})
        }).then(async response => {
            const parsed = await response.json();
            console.log(parsed.message);
        }).catch(err => {
            console.log(err);
        });
    }

function getChatData (user_id, setAllChats) {
    fetch(`http://localhost:3000/chats/displayChats/${user_id}`, {
        method: "GET"
    }).then(async response => {
        const data = await response.json();

        if (!data.success) {
            console.log(data.message);
            return;
        }
        setAllChats(data.chat_data || []);
    }).catch(err => {
        console.log(err);
    });
}

function CreateChatsPopUp ({currentFriends, currentUser, setCreateChatsDisplay}) {
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [chatName, setChatName] = useState("");
    const [displayMsg, setDisplayMsg] = useState("");
    const friendsDisplay = []; // only curr friends can be chosen to be in the chat

    console.log(selectedFriends); // TESTING
    for (const friend of currentFriends) {
        const ifFriendSelected = selectedFriends.some((selFriend) => selFriend.friend_id === friend.friend_id);
        // check if selectedFrineds contains friend
        friendsDisplay.push(
            <li key={`create-chats-popup-${friend.friend_id}`} 
            className={`create-chat-friends 
                ${ifFriendSelected ? "selected" : ""}`}
            onClick={() => {
                if (ifFriendSelected) {
                    // if already selected
                    const newSelectedFriends = selectedFriends.filter(selFriend => selFriend.friend_id !== friend.friend_id);
                    // remove friend from selected array
                    setSelectedFriends(newSelectedFriends);
                } else {
                    setSelectedFriends([...selectedFriends, friend]);
                }
            }}>
                {friend.username}
            </li>
        );
    }
    return (
        <div id="create-chats-popup">
            <button id="close-create-chats-popup" onClick={() => setCreateChatsDisplay(false)}>X</button>
            <ul>
                {friendsDisplay}
            </ul>
            <input id="get-chat-name" value={chatName} type="text" maxLength={30} onChange={(e) => setChatName(e.target.value)}/>
            <button id="create-chat-btn" onClick={() => createChat(currentUser.id, selectedFriends, chatName, setChatName, setSelectedFriends, setCreateChatsDisplay, setDisplayMsg)}>Create Chat</button>
            <p id="popup-display-msg">{displayMsg}</p>
        </div>
    )
}
function createChat (creator_id, addedFriends, chat_name, setChatName, setSelectedFriends, setCreateChatsDisplay, setDisplayMsg) {
    fetch("http://localhost:3000/chats/createChat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({creator_id, addedFriends, chat_name})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
        if (!parsed.success) {
            setDisplayMsg(parsed.message);
        } else {
            setCreateChatsDisplay(false);
        }
    }).catch(err => {
        console.log(err);
    });
    setChatName("");
    setSelectedFriends([]); // reset inputs
}

export default ChatsPage;