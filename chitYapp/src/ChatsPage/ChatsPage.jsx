import { useState } from 'react'
import { useEffect } from 'react';
import './ChatsPage.css';
import MessagingSection from './MessagingSection/MessagingSection.jsx';

import leaveChatIcon from '../images/leaveChatIcon.png';

function ChatsPage ({currentUser, currentFriends, ifLightMode}) {
    // currentFriends holds array of {user_id, username, friend_id}
    const [createChatsDisplay, setCreateChatsDisplay] = useState(false);
    const [addMembersDisplay, setAddMembersDisplay] = useState(false);
    const [allChats, setAllChats] = useState([]);
    return (
        <>
            {createChatsDisplay ? <CreateChatsPopUp currentFriends={currentFriends} currentUser={currentUser} setCreateChatsDisplay={setCreateChatsDisplay} ifLightMode={ifLightMode}/> : <></>}

            <DisplayChats 
                setCreateChatsDisplay={setCreateChatsDisplay}
                addMembersDisplay={addMembersDisplay}
                setAddMembersDisplay={setAddMembersDisplay}
                currentUser={currentUser}
                allChats={allChats}
                setAllChats={setAllChats}
                currentFriends={currentFriends}
                ifLightMode={ifLightMode}/>
        </>
    )
}

function DisplayChats ({setCreateChatsDisplay, addMembersDisplay, setAddMembersDisplay, currentUser, allChats, setAllChats, currentFriends, ifLightMode}) {
    const [selectedChat, setSelectedChat] = useState(null); // holds {chat object}
    const [filterChats, setFilterChats] = useState("");

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
    );

    if (updatedChat) {
        setSelectedChat(updatedChat);
    } else {
        // chat no longer exists, clear selection
        setSelectedChat(null);
    }
}, [allChats]);

    useEffect(() => {
        // reads
        if (!selectedChat) return;
        if (!selectedChat.unread) return;
        readMessages(selectedChat.chat_id, currentUser.id);
        

    }, [selectedChat]);
    
    const chat_list = [];

    for (const chat of allChats.filter(chat => chat.chat_name.toLowerCase().includes(filterChats.toLowerCase())) || []) {
        // each chat is object {unread, creator_id, creator_username, chat_name, userList: [{username, user_id, status, friend_id (null if no friend_id)}], chat_id}
        const {chat_name} = chat;
        chat_list.push(
            <li key={chat.chat_id}
            onClick={() => setSelectedChat(chat)}
            className={`chat ${selectedChat?.chat_id===chat.chat_id?"selected-chat":""} ${!ifLightMode?"dark-mode":""}`}
            >
                <p className='chat-name-sec'>{chat_name} {chat.unread?"🔴 unread messages":""}</p>
                
                <div className="chat-button-container">
                    {chat.creator_id===currentUser.id ? 
                    <button id="delete-chat-btn" className={!ifLightMode?"dark-mode":""} onClick={() => {
                        deleteChat(currentUser.id, chat.chat_id, chat.creator_id)
                        if (chat.chat_id===selectedChat.chat_id) setSelectedChat(null);
                        setAddMembersDisplay(false);
                    }}>Delete</button> 
                    : <></>}
                    <button id="leave-btn" className={!ifLightMode?"dark-mode":""} onClick={() => {
                        leaveChat(currentUser.id, currentUser.username, chat.chat_id, chat.creator_id)
                        console.log(chat.chat_id + ", " + selectedChat.chat_id);
                        if (chat.chat_id===selectedChat.chat_id) setSelectedChat(null);
                        setAddMembersDisplay(false);
                    }}><img alt="Leave" className="leave-chat-icon" src={leaveChatIcon}/></button>

                </div>
            </li>
        );
    }

    return (
        <>
        <main id="main-chat-page" className={!ifLightMode?"dark-mode":""}>

            {/* Left column: chat list */}
            <div id="chat-list-container" className={!ifLightMode?"dark-mode":""}>
                <button id="show-create-chat-popup" className={!ifLightMode?"dark-mode":""} onClick={() => setCreateChatsDisplay(true)}>Create Chat</button>
                <input type="text" id="search-chats-bar" className={!ifLightMode?"dark-mode":""} placeholder="Search chats..." value={filterChats} onChange={(e) => {
                    setFilterChats(e.target.value);
                }}/>

                <ul id="chat-list">
                    {chat_list}
                </ul>
            </div>

            {/* Middle and right columns, only exist if a chat is selected*/}
            {selectedChat ? 
                <>
                <ChatLayout
                    chat_name={selectedChat.chat_name}
                    chat_id={selectedChat.chat_id}   
                    currentUser={currentUser}
                    ifLightMode={ifLightMode}
                /> 
                <UsersLayout
                    addMembersDisplay={addMembersDisplay}
                    setAddMembersDisplay={setAddMembersDisplay}
                    chat_id={selectedChat.chat_id}
                    userList={selectedChat.userList}
                    creator_id={selectedChat.creator_id}
                    currentUser={currentUser}
                    currentFriends={currentFriends}
                    ifLightMode={ifLightMode}
                />
                </>
                
                : <></>}
        </main>
        </>
    );

}
function ChatLayout ({chat_name, chat_id, currentUser, ifLightMode}) {
    // middle column
    return (
        
        <div id="chat-layout" className={!ifLightMode?"dark-mode":""}>
            <p id="chat-name" className={!ifLightMode?"dark-mode":""}>{chat_name}</p>
            <MessagingSection
            currentUser={currentUser}
            chat_id={chat_id}
            ifLightMode={ifLightMode}
            />
        </div>
        
    );
}
function UsersLayout ({addMembersDisplay, setAddMembersDisplay, chat_id, userList, creator_id, currentUser, currentFriends, ifLightMode}) {
    // userList contains array of {friend_id (could be null), user_id, status, username}
    const userDisplay = [];
    const [userDetailsOpened, setUserDetailsOpen] = useState(null); // holds user_id

    for (const user of userList) {
        const {friend_id, user_id, status, username, joined_at, account_created, description, updated_at} = user;
        let friendBtns;

        let descFriends;

        if (user_id !== currentUser.id) {    
            
            if (status==="friends") {
                friendBtns = " 👥";
                descFriends = `Friends`
            } else if (status === "outgoing") {
                friendBtns = (
                    <button className={`cancel-req-btn ${!ifLightMode?"dark-mode":""}`} onClick={() =>
                        cancelRequest(friend_id, user_id, username)
                    }> Cancel </button>
                );
                descFriends = " Outgoing Request";
            } else if (status === "incoming") {
                friendBtns = (
                    <div className="chat-incoming-req-btns">
                    <button className={`reject-req-btn ${!ifLightMode?"dark-mode":""}`} onClick={() =>
                            rejectRequest(friend_id, username, user_id)
                        }> Reject </button>
                    <button className={`accept-req-btn ${!ifLightMode?"dark-mode":""}`} onClick={() =>
                            acceptRequest(friend_id, username, user_id)
                        }> Accept </button>
                    </div>
                );
                descFriends = " Incoming Request";
            } else {
                friendBtns = (
                    <button className={`send-friend-req-btn ${!ifLightMode?"dark-mode":""}`} onClick={() => 
                        sendRequest(currentUser.id,user_id)
                    }>
                        Send Request
                    </button>
                )
            }
        }

        userDisplay.push(
            <li key={`${chat_id}-${user.username}`} className={`chat-user-list ${!ifLightMode?"dark-mode":""}`} onClick={() => setUserDetailsOpen(user_id)}>
                {userDetailsOpened === user_id ? 
                <DisplayUserDetails
                    user_id={user_id}
                    username={username}
                    description={description}
                    account_created={formatDateTimeSmart(account_created)}
                    joined_at={formatDateTimeSmart(joined_at)}
                    friendsBtns={friendBtns}
                    updated_at={formatDateTimeSmart(updated_at)}
                    descFriends={descFriends}
                    setUserDetailsOpen={setUserDetailsOpen}
                    currentUser={currentUser}
                    ifLightMode={ifLightMode}
                /> 
                
                :
                <></>}

                {`${creator_id===user_id?"👑":""}`}{username}{currentUser.id===user_id?"(You)":""}
                <p className={`desc-friends ${!ifLightMode?"dark-mode":""}`}>{descFriends}</p>
                {creator_id===currentUser.id && currentUser.id !== user_id?
                <button className={`kick-btn ${!ifLightMode?"dark-mode":""}`} onClick={()=>kickUser(creator_id, currentUser.id, currentUser.username, user_id, username, chat_id)}>Kick</button>:<></>}
            </li>
        );
    }
    return (
        <ul id="chat-users-container" className={!ifLightMode?"dark-mode":""}>
            <div id="chat-users-header" className={!ifLightMode?"dark-mode":""}>Users in Chat:</div>
            {userDisplay}
            <button id="add-members-btn" className={!ifLightMode?"dark-mode":""} onClick={() => setAddMembersDisplay(true)}>Add members</button>
            {addMembersDisplay?<AddMembersPopup setAddMembersDisplay={setAddMembersDisplay} userList={userList} currentFriends={currentFriends} chat_id={chat_id} currentUser={currentUser} ifLightMode={ifLightMode}/>:<></>}
        </ul>
    );
}
function DisplayUserDetails ({user_id, username, description, account_created, joined_at, friendsBtns, updated_at, descFriends, setUserDetailsOpen, currentUser, ifLightMode}) {
    return (
        <div id='display-user-details' className={!ifLightMode?"dark-mode":""}>
            <button id="close-user-details" className={!ifLightMode?"dark-mode":""} onClick={(e) => {
                e.stopPropagation();
                setUserDetailsOpen(null)
                }}>X</button>
            <h3 id="display-user-username" className={!ifLightMode?"dark-mode":""}><b>{username}</b> ID: {user_id} {friendsBtns}</h3>
            <p id="creation-date" className={!ifLightMode?"dark-mode":""}>Account created at: {account_created}</p>
            <p id="joined-date" className={!ifLightMode?"dark-mode":""}>Joined chat: {joined_at}</p>
            {currentUser.id !== user_id ? <p id="friends-since" className={!ifLightMode?"dark-mode":""}>{descFriends} {updated_at ? `Since ${updated_at}` : ""}</p> : <></>}
            
            <p id="display-user-description" className={!ifLightMode?"dark-mode":""}>Description: {description ? description : "None added"}</p>
        </div>
    );
}

function AddMembersPopup({setAddMembersDisplay, userList, currentFriends, chat_id, currentUser, ifLightMode }) {
    const [addedFriends, setAddedFriends] = useState([]);

    // Only show friends who are NOT already in the chat
    const selectableFriends = currentFriends.filter(
        friend => !userList.some(user => user.user_id === friend.user_id)
    );

    return (
        <div id="add-friends-container" className={!ifLightMode?"dark-mode":""}>
            <button id="close-add-members-popup" className={!ifLightMode?"dark-mode":""} onClick={() => setAddMembersDisplay(false)}>X</button>
            <h2 className={!ifLightMode?"dark-mode":""}>Add Members</h2>
            <ul>
                {selectableFriends.map(friend => {
                    const isSelected = addedFriends.some(f => f.friend_id === friend.friend_id);

                    return (
                        <li
                            key={`add-members-${friend.friend_id}`}
                            className={`add-members ${isSelected ? "selected" : ""} ${!ifLightMode?"dark-mode":""}`}
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
                className={!ifLightMode?"dark-mode":""}
                onClick={() => addMembers(currentUser.username, currentUser.id, addedFriends, chat_id)}
            >
                Add
            </button>

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

function CreateChatsPopUp ({currentFriends, currentUser, setCreateChatsDisplay, ifLightMode}) {
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
                ${ifFriendSelected ? "selected" : ""} ${!ifLightMode?"dark-mode":""}`}
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
        <div id="create-chats-popup" className={!ifLightMode?"dark-mode":""}>
            <button id="close-create-chats-popup" className={!ifLightMode?"dark-mode":""} onClick={() => setCreateChatsDisplay(false)}>X</button>
            <h2 className={!ifLightMode?"dark-mode":""}>Create Chat</h2>
            <ul>
                {friendsDisplay}
            </ul>
            <input placeholder="Chat Name" id="get-chat-name" className={!ifLightMode?"dark-mode":""} value={chatName} type="text" maxLength={30} onChange={(e) => setChatName(e.target.value)}/>
            <button id="create-chat-btn" className={!ifLightMode?"dark-mode":""} onClick={() => createChat(currentUser.id, selectedFriends, chatName, setChatName, setSelectedFriends, setCreateChatsDisplay, setDisplayMsg)}>Create Chat</button>
            <p id="popup-display-msg" className={!ifLightMode?"dark-mode":""}>{displayMsg}</p>
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