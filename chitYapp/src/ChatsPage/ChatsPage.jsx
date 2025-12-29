import { useState } from 'react'
import { useEffect } from 'react';
import './ChatsPage.css';
import MessagingSection from './MessagingSection/MessagingSection.jsx';

function ChatsPage ({currentUser, currentFriends}) {
    // currentFriends holds array of {user_id, username, friend_id}
    const [createChatsDisplay, setCreateChatsDisplay] = useState(false);
    const [addMembersDisplay, setAddMembersDisplay] = useState(false);
    const [allChats, setAllChats] = useState([]);
    return (
        <>
            {createChatsDisplay ? <CreateChatsPopUp currentFriends={currentFriends} currentUser={currentUser} setCreateChatsDisplay={setCreateChatsDisplay}/> : <></>}

            <DisplayChats 
                addMembersDisplay={addMembersDisplay}
                setAddMembersDisplay={setAddMembersDisplay}
                currentUser={currentUser}
                allChats={allChats}
                setAllChats={setAllChats}
                currentFriends={currentFriends}/>
        </>
    )
}

function DisplayChats ({addMembersDisplay, setAddMembersDisplay, currentUser, allChats, setAllChats, currentFriends}) {
    const [selectedChat, setSelectedChat] = useState(null); // holds {chat object}
    useEffect(() => {
        if (!currentUser?.id) return;

        // initial fetch
        getChatData(currentUser.id, setAllChats);
        
        const intervalId = setInterval(() => {
            getChatData(currentUser.id, setAllChats);
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id, allChats]);

    useEffect(() => {
        if (!selectedChat) return;

        const updatedChat = allChats.find(
            chat => chat.chat_id === selectedChat.chat_id
        ); // once allChat updates then selectedChat must also update, so that buttons with users update live

        
        if (updatedChat) {
            setSelectedChat(updatedChat);
        }
    }, [allChats]);

    useEffect(() => {
        // reads
        if (!selectedChat) return;
        if (!selectedChat.unread) return;
        readMessages(selectedChat.chat_id, currentUser.id);
        

    }, [selectedChat]);
    
    const chat_list = [];

    for (const chat of allChats || []) {
        // each chat is object {unread, creator_id, creator_username, chat_name, userList: [{username, user_id, status, friend_id (null if no friend_id)}], chat_id}
        const {chat_name} = chat;
        chat_list.push(
            <li key={chat.chat_id}
            onClick={() => setSelectedChat(chat)}
            className={`chat ${selectedChat?.chat_id===chat.chat_id?"selected-chat":""}`}
            >
                <p>{chat_name} {chat.unread?"🔴 unread messages":""}</p>
                <button id="leave-btn" onClick={() => leaveChat(currentUser.id, currentUser.username, chat.chat_id, chat.creator_id)}>Leave</button>
                {chat.creator_id===currentUser.id ? 
                <button id="delete-chat-btn" onClick={() => deleteChat(currentUser.id, chat.chat_id, chat.creator_id)}>Delete Chat</button> 
                : <></>}
            </li>
        );
    }

    return (
        <>
        <main id="main-chat-page">
            <div id="chat-list-container">
                <button id="show-create-chat-popup" onClick={() => setCreateChatsDisplay(true)}>Create Chat</button>
                <ul id="chat-list">
                    {chat_list}
                </ul>
            </div>
            {selectedChat ? 
                <>
                <ChatLayout
                    creator_id={selectedChat.creator_id}
                    chat_name={selectedChat.chat_name}
                    chat_id={selectedChat.chat_id}   
                    currentUser={currentUser}
                /> 
                <UsersLayout
                    addMembersDisplay={addMembersDisplay}
                    setAddMembersDisplay={setAddMembersDisplay}
                    chat_id={selectedChat.chat_id}
                    userList={selectedChat.userList}
                    creator_id={selectedChat.creator_id}
                    currentUser={currentUser}
                    currentFriends={currentFriends}
                />
                </>
                
                : <></>}
        </main>
        </>
    );

}
function ChatLayout ({creator_id, chat_name, chat_id, currentUser}) {
    
    return (
        
        <div id="chat-layout">
            <p id="chat-name">{chat_name}</p>
            <MessagingSection
            currentUser={currentUser}
            chat_id={chat_id}
            />
        </div>
        
    );
}
function UsersLayout ({addMembersDisplay, setAddMembersDisplay, chat_id, userList, creator_id, currentUser, currentFriends}) {
    // userList contains array of {friend_id (could be null), user_id, status, username}
    const userDisplay = [];

    for (const user of userList) {
        const {friend_id, user_id, status, username} = user;
        let friendBtns;

        if (user_id !== currentUser.id) {    
            
            if (status==="friends") {
                friendBtns = " 👥";
            } else if (status === "outgoing") {
                friendBtns = (
                    <button className="cancel-req-btn" onClick={() =>
                        cancelRequest(friend_id, user_id, username)
                    }> Cancel </button>
                );
            } else if (status === "incoming") {
                friendBtns = (
                    <div className="chat-incoming-req-btns">
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
                    <button className="send-friend-req-btn" onClick={() => 
                        sendRequest(currentUser.id,user_id)
                    }>
                        Send Request
                    </button>
                )
            }
        }

        userDisplay.push(
            <li key={`${chat_id}-${user.username}`} className='chat-user-list'>
                {`${creator_id===user_id?"👑":""}`}{username}{currentUser.id===user_id?"(You)":""}
                {friendBtns}
                {creator_id===currentUser.id && currentUser.id !== user_id?
                <button className="kick-btn" onClick={()=>kickUser(creator_id, currentUser.id, currentUser.username, user_id, username, chat_id)}>Kick</button>:<></>}
            </li>
        );
    }
    return (
        <ul>
            {userDisplay}
            <button id="add-members-btn" onClick={() => setAddMembersDisplay(true)}>Add members</button>

            {addMembersDisplay?<AddMembersPopup setAddMembersDisplay={setAddMembersDisplay} userList={userList} currentFriends={currentFriends} chat_id={chat_id} currentUser={currentUser}/>:<></>}
        </ul>
    );
}

function AddMembersPopup({setAddMembersDisplay, userList, currentFriends, chat_id, currentUser }) {
    const [addedFriends, setAddedFriends] = useState([]);

    // Only show friends who are NOT already in the chat
    const selectableFriends = currentFriends.filter(
        friend => !userList.some(user => user.user_id === friend.user_id)
    );

    return (
        <div id="add-friends-container">
            <ul>
                {selectableFriends.map(friend => {
                    const isSelected = addedFriends.some(f => f.friend_id === friend.friend_id);

                    return (
                        <li
                            key={`add-members-${friend.friend_id}`}
                            className={`add-members ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                                if (isSelected) {
                                    setAddedFriends(
                                        addedFriends.filter(f => f.friend_id !== friend.friend_id)
                                    );
                                } else {
                                    setAddedFriends([...addedFriends, friend]);
                                }
                            }}
                        >
                            {friend.username}
                        </li>
                    );
                })}
            </ul>

            <button
                id="add-members-btn"
                onClick={() => addMembers(currentUser.username, currentUser.id, addedFriends, chat_id)}
            >
                Add
            </button>

            <button id="close-add-members-popup" onClick={() => setAddMembersDisplay(false)}>X</button>
        </div>
    );
}

function addMembers (username, user_id, addedFriends, chat_id) {
    fetch("http://localhost:3000/chats/addToChat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, user_id, addedFriends, chat_id})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    })   
}
function kickUser (creator_id, user_id, user_username, kicked_id, kicked_username, chat_id) {
    fetch("http://localhost:3000/chats/kick", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({creator_id, user_id, user_username, kicked_id, kicked_username, chat_id})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    })
}
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

function deleteChat (user_id, chat_id, creator_id) {
    fetch("http://localhost:3000/chats/deleteChat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({user_id, chat_id, creator_id})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    })
}
function leaveChat (user_id, username, chat_id, creator_id) {
    fetch("http://localhost:3000/chats/leaveChat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({user_id, username, chat_id, creator_id})
    }).then(async response => {
        const parsed = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    })
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