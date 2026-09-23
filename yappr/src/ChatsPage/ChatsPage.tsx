import { useState } from 'react'
import { useEffect } from 'react';
import './ChatsPage.css';
import MessagingSection from './MessagingSection/MessagingSection.js';

import leaveChatIcon from '../images/leaveChatIcon.png';
import editChatNameIcon from '../images/edit-chat-name-icon.png';
import updateChatNameIcon from '../images/update-chat-name-icon.png';
import type { AddMembersPopupProps, ChatLayoutProps, ChatsPageProps, CreateChatsPopupProps, CurrChat, DisplayChatsProps, DisplayUserDetailsProps, GetChatsResponse, UsersLayoutProps } from '../../definitions/chatsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import type { CurrOutIncFriendsQuery } from '../../definitions/friendsTypes.js';
import { acceptRequest, cancelRequest, rejectRequest, sendRequest } from '../data/FriendsFunctions.js';
import { addMembers, deleteChat, kickUser, leaveChat, readMessages } from '../data/ChatsFunctions.js';
import { errorMessage, postJson } from '../data/http.js';
import { Modal } from '../ui/Modal.js';

function ChatsPage ({currentUser, currentFriends, ifLightMode, allChats, setAllChats}: ChatsPageProps) {
    // currentFriends holds array of {user_id, username, friend_id}
    const [createChatsDisplay, setCreateChatsDisplay] = useState(false);
    const [addMembersDisplay, setAddMembersDisplay] = useState(false);
    // Mobile view state: 'chats' | 'messages' | 'users'
    const [mobileView, setMobileView] = useState('chats');

    // Function to refresh chats from the server
    const refreshChats = async () => {
        try {
            const response = await fetch(`/api/chats/displayChats/${currentUser.id}`);
            const parsed: GetChatsResponse = await response.json();
            if (parsed.success && parsed.chat_data) {
                setAllChats(parsed.chat_data);
            }
        } catch (err) {
            console.log("Error refreshing chats:", err);
        }
    };
    
    return (
        <>
            {createChatsDisplay ? <CreateChatsPopUp currentFriends={currentFriends} currentUser={currentUser} setCreateChatsDisplay={setCreateChatsDisplay} ifLightMode={ifLightMode} refreshChats={refreshChats}/> : <></>}

            <DisplayChats 
                setCreateChatsDisplay={setCreateChatsDisplay}
                addMembersDisplay={addMembersDisplay}
                setAddMembersDisplay={setAddMembersDisplay}
                currentUser={currentUser}
                allChats={allChats}
                currentFriends={currentFriends}
                ifLightMode={ifLightMode}
                mobileView={mobileView}
                setMobileView={setMobileView}
                refreshChats={refreshChats}
            />
        </>
    )
}

function DisplayChats ({setCreateChatsDisplay, addMembersDisplay, setAddMembersDisplay, currentUser, allChats, currentFriends, ifLightMode, mobileView, setMobileView, refreshChats}: DisplayChatsProps & {refreshChats: () => Promise<void>}) {
    const [selectedChat, setSelectedChat] = useState<CurrChat | null>(null); // holds {chat object}
    const [filterChats, setFilterChats] = useState("");

    const selectedChatId = selectedChat?.chat_id ?? null;
    const selectedChatUnread = selectedChat?.unread;

    useEffect(() => {
        if (selectedChatId === null) return;

        const updatedChat = allChats.find(chat => chat.chat_id === selectedChatId);

        if (!updatedChat) {
            // chat no longer exists, clear selection
            setSelectedChat(null);
            setMobileView('chats');
            return;
        }

        // Only swap in a new object when the contents actually differ. Every
        // refresh produces fresh object identities, and blindly re-setting them
        // retriggered the read-receipt effect below on every single refresh.
        setSelectedChat(prev =>
            prev && JSON.stringify(prev) === JSON.stringify(updatedChat) ? prev : updatedChat
        );
    }, [allChats, selectedChatId, setMobileView]);

    useEffect(() => {
        // mark as read on open
        if (selectedChatId === null || !selectedChatUnread) return;
        readMessages(selectedChatId, currentUser.id);
    }, [selectedChatId, selectedChatUnread, currentUser.id]);

    // Handle chat selection - switch to messages view on mobile
    const handleChatSelect = (chat: CurrChat) => {
        setSelectedChat(chat);
        setMobileView('messages');
    };
    
    const chat_list = [];

    for (const chat of allChats.filter(chat => chat.chat_name.toLowerCase().includes(filterChats.toLowerCase())) || []) {
        // each chat is object {unread, creator_id, creator_username, chat_name, userList: [{username, user_id, status, friend_id (null if no friend_id)}], chat_id}
        const {chat_name} = chat;
        chat_list.push(
            <li key={chat.chat_id}
            onClick={() => handleChatSelect(chat)}
            className={`chat ${selectedChat?.chat_id===chat.chat_id?"selected-chat":""}`}
            >
                <p className='chat-name-sec'>{chat_name} {chat.unread?"🔴 unread messages":""}</p>
                
                <div className="chat-button-container">
                    {chat.creator_id===currentUser.id ? 
                    <button id="delete-chat-btn" onClick={async (e) => {
                        e.stopPropagation();
                        await deleteChat(currentUser.id, chat.chat_id, chat.creator_id);
                        await refreshChats();
                        if (chat.chat_id===selectedChat?.chat_id) {
                            setSelectedChat(null);
                            setMobileView('chats');
                        }
                        setAddMembersDisplay(false);
                    }}>Delete</button> 
                    : <></>}
                    <button id="leave-btn" onClick={async (e) => {
                        e.stopPropagation();
                        await leaveChat(currentUser.id, currentUser.username, chat.chat_id, chat.creator_id);
                        await refreshChats();
                        console.log(chat.chat_id + ", " + selectedChat?.chat_id);
                        if (chat.chat_id===selectedChat?.chat_id) {
                            setSelectedChat(null);
                            setMobileView('chats');
                        }
                        setAddMembersDisplay(false);
                    }}><img alt="Leave" className="leave-chat-icon" src={leaveChatIcon}/></button>

                </div>
            </li>
        );
    }

    return (
        <>
        <main id="main-chat-page" className={`mobile-view-${mobileView}`}>

            {/* Mobile Navigation Arrows - only visible when chat selected */}
            {selectedChat && (
                <div className="mobile-nav-arrows">
                    {mobileView==="messages"?
                    <>
                        <button 
                            className="mobile-nav-arrow left"
                            onClick={() => setMobileView('chats')}
                            title="Back to Chats"
                        >
                            ← Chats
                        </button>
                        <span className="mobile-chat-title">{selectedChat.chat_name}</span>
                        <button 
                            className="mobile-nav-arrow right"
                            onClick={() => setMobileView('users')}
                            title="View Users"
                        >
                            Users →
                        </button>
                    </>
                    : mobileView==='users' ? 
                    <>
                        <button 
                            className="mobile-nav-arrow left"
                            onClick={() => setMobileView('messages')}
                            title="Back to Messages"
                        >
                            ← Messages
                        </button>
                        <span className="mobile-chat-title">{selectedChat.chat_name}</span>
                        
                    </>
                    
                    : <></>}
                </div>
            )}

            {/* Left column: chat list */}
            <div id="chat-list-container">
                <button id="show-create-chat-popup" onClick={() => setCreateChatsDisplay(true)}>Create Chat</button>
                <label className="sr-only" htmlFor="search-chats-bar">Search chats</label>
                <input type="text" id="search-chats-bar" placeholder="Search chats..." value={filterChats} onChange={(e) => {
                    setFilterChats(e.target.value);
                }}/>

                {chat_list.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state__title">
                            {filterChats ? "No matching chats" : "No chats yet"}
                        </span>
                        <span>
                            {filterChats
                                ? "Try a different search."
                                : "Create a chat to start talking with your friends."}
                        </span>
                    </div>
                ) : (
                    <ul id="chat-list">
                        {chat_list}
                    </ul>
                )}
            </div>

            {/* Middle and right columns, only exist if a chat is selected*/}
            {selectedChat ? 
                <>
                <ChatLayout
                    chat_name={selectedChat.chat_name}
                    chat_id={selectedChat.chat_id}   
                    currentUser={currentUser}
                    ifLightMode={ifLightMode}
                    selectedChat={selectedChat}
                    refreshChats={refreshChats}
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
                    refreshChats={refreshChats}
                />
                </>
                
                : <></>}
        </main>
        </>
    );

}
function ChatLayout ({chat_name, chat_id, currentUser, ifLightMode, selectedChat, refreshChats}: ChatLayoutProps & {refreshChats: () => Promise<void>}) {
    // middle column

    const [editingChatName, setEditingChatName] = useState(false);
    const [newChatName, setNewChatName] = useState(chat_name);
    return (
        
        <div id="chat-layout">
            <p id="chat-name">
                {editingChatName ? <input placeholder="New chat name" id="new-chat-name-input" type='text' maxLength={30} value={newChatName} onChange={(e) => setNewChatName(e.target.value)}/> : chat_name}    
                {selectedChat.creator_id===currentUser.id ? 
                editingChatName?
                <button id="update-chat-name-btn" onClick={async () => {
                    await editChatName(setEditingChatName, newChatName, chat_id, currentUser.id, selectedChat.creator_id, currentUser.username);
                    await refreshChats();
                }}>
                    <img src={updateChatNameIcon} id="update-chat-icon" alt="update"/>
                </button>
                :
                <button id="edit-chat-name-btn" onClick={() => setEditingChatName(!editingChatName)}>
                    <img src={editChatNameIcon} id="edit-chat-icon" alt="edit"/>
                </button>
                
                :<></>}</p>
            <MessagingSection
            currentUser={currentUser}
            chat_id={chat_id}
            ifLightMode={ifLightMode}
            />
        </div>
        
    );
}

async function editChatName (setEditingChatName: (value: boolean) => void, newChatName: string, chat_id: number, user_id: number, creator_id: number, username: string) {
    setEditingChatName(false);
    try {
        const response = await fetch("/api/chats/editChatName", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({newChatName, chat_id, user_id, creator_id, username})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    } catch (err) {
        console.log(err);
    }
}

function UsersLayout ({addMembersDisplay, setAddMembersDisplay, chat_id, userList, creator_id, currentUser, currentFriends, ifLightMode, refreshChats}: UsersLayoutProps & {refreshChats: () => Promise<void>}) {
    // userList contains array of {friend_id (could be null), user_id, status, username}
    const userDisplay = [];
    const [userDetailsOpened, setUserDetailsOpen] = useState<number | null>(null); // holds user_id

    for (const user of userList) {
        if (!user) continue;
        const {friend_id, user_id, status, username, joined_at, account_created, description, updated_at} = user;
        let friendBtns: any;

        let descFriends: string = "";
        
        if (user_id !== currentUser.id) {    
            
            if (status==="friends") {
                friendBtns = " 👥";
                descFriends = `Friends`
            } else if (status === "outgoing") {
                friendBtns = (
                    <button className="cancel-req-btn" onClick={() =>
                        cancelRequest(friend_id ?? 0, user_id, username ?? "")
                    }> Cancel </button>
                );
                descFriends = " Outgoing Request";
            } else if (status === "incoming") {
                friendBtns = (
                    <div className="chat-incoming-req-btns">
                    <button className="reject-req-btn" onClick={() =>
                            rejectRequest(friend_id ?? 0, username ?? "", user_id)
                        }> Reject </button>
                    <button className="accept-req-btn" onClick={() =>
                            acceptRequest(friend_id ?? 0, username ?? "", user_id)
                        }> Accept </button>
                    </div>
                );
                descFriends = " Incoming Request";
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
            <li key={`${chat_id}-${user.username}`} className="chat-user-list" onClick={() => setUserDetailsOpen(user_id)}>
                {userDetailsOpened === user_id ? 
                <DisplayUserDetails
                    user_id={user_id}
                    username={username ?? ""}
                    description={description ?? ""}
                    account_created={formatDateTimeSmart(account_created ?? "")}
                    joined_at={formatDateTimeSmart(joined_at)}
                    friendsBtns={friendBtns}
                    updated_at={formatDateTimeSmart(updated_at ?? "")}
                    descFriends={descFriends}
                    setUserDetailsOpen={setUserDetailsOpen}
                    currentUser={currentUser}
                    ifLightMode={ifLightMode}
                /> 
                
                :
                <></>}

                {`${creator_id===user_id?"👑":""}`}{username}{currentUser.id===user_id?"(You)":""}
                <p className="desc-friends">{descFriends}</p>
                {creator_id===currentUser.id && currentUser.id !== user_id?
                <button className="kick-btn" onClick={async ()=>{
                    await kickUser(creator_id, currentUser.id, currentUser.username, user_id, username ?? "", chat_id);
                    await refreshChats();
                }}>Kick</button>:<></>}
            </li>
        );
    }
    return (
        <ul id="chat-users-container">
            <div id="chat-users-header">Users in Chat:</div>
            {userDisplay}
            <button id="add-members-btn" onClick={() => setAddMembersDisplay(true)}>Add members</button>
            {addMembersDisplay?<AddMembersPopup setAddMembersDisplay={setAddMembersDisplay} userList={userList} currentFriends={currentFriends} chat_id={chat_id} currentUser={currentUser} ifLightMode={ifLightMode} refreshChats={refreshChats}/>:<></>}
        </ul>
    );
}


function DisplayUserDetails ({user_id, username, description, account_created, joined_at, friendsBtns, updated_at, descFriends, setUserDetailsOpen, currentUser, ifLightMode}: DisplayUserDetailsProps) {
    return (
        <div id='display-user-details'>
            <button id="close-user-details" onClick={(e) => {
                e.stopPropagation();
                setUserDetailsOpen(null)
                }}>X</button>
            <h3 id="display-user-username"><b>{username}</b> ID: {user_id} {friendsBtns}</h3>
            <p id="creation-date">Account created at: {account_created}</p>
            <p id="joined-date">Joined chat: {joined_at}</p>
            {currentUser.id !== user_id ? <p id="friends-since">{descFriends} {updated_at ? `Since ${updated_at}` : ""}</p> : <></>}
            
            <p id="display-user-description">Description: {description ? description : "None added"}</p>
        </div>
    );
}

function AddMembersPopup({setAddMembersDisplay, userList, currentFriends, chat_id, currentUser, ifLightMode, refreshChats }: AddMembersPopupProps & {refreshChats: () => Promise<void>}) {
    const [addedFriends, setAddedFriends] = useState<CurrOutIncFriendsQuery[]>([]);
    const [adding, setAdding] = useState(false);

    // Only show friends who are NOT already in the chat
    const selectableFriends = currentFriends.filter(
        friend => !userList.some(user => user.user_id === friend.user_id)
    );

    return (
        <Modal title="Add Members" onClose={() => setAddMembersDisplay(false)} labelledById="add-members-title">
            {selectableFriends.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state__title">Nobody left to add</span>
                    <span>All of your friends are already in this chat.</span>
                </div>
            ) : (
            <ul id="add-members-friend-list">
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
            )}

            <div className="modal__actions">
                <button className="btn btn--ghost" type="button" onClick={() => setAddMembersDisplay(false)}>Cancel</button>
                <button
                    className="btn btn--primary"
                    id="add-members-btn"
                    type="button"
                    disabled={addedFriends.length === 0 || adding}
                    onClick={async () => {
                        setAdding(true);
                        try {
                            await addMembers(currentUser.username, currentUser.id, addedFriends, chat_id, setAddMembersDisplay);
                            await refreshChats();
                        } finally {
                            setAdding(false);
                        }
                    }}
                >
                    {adding ? "Adding…" : "Add"}
                </button>
            </div>
        </Modal>
    );
}
function formatDateTimeSmart(isoString: string) {
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

  // Same day → just date + time (no weekday)
  return date.toLocaleString("en-US", options);
}

function CreateChatsPopUp ({currentFriends, currentUser, setCreateChatsDisplay, ifLightMode, refreshChats}: CreateChatsPopupProps & {refreshChats: () => Promise<void>}) {
    const [selectedFriends, setSelectedFriends] = useState<CurrOutIncFriendsQuery[]>([]);
    const [chatName, setChatName] = useState("");
    const [displayMsg, setDisplayMsg] = useState("");
    const [creating, setCreating] = useState(false);
    const friendsDisplay = []; // only curr friends can be chosen to be in the chat

    for (const friend of currentFriends) {
        const ifFriendSelected = selectedFriends.some((selFriend) => selFriend.friend_id === friend.friend_id);
        // check if selectedFrineds contains friend
        friendsDisplay.push(
            <li key={`create-chats-popup-${friend.friend_id}`} 
            className={`create-chat-friends ${ifFriendSelected ? "selected" : ""}`}
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
    const canSubmit = selectedFriends.length > 0 && chatName.trim().length > 0 && !creating;

    return (
        <Modal title="Create Chat" onClose={() => setCreateChatsDisplay(false)} labelledById="create-chat-title">
            {currentFriends.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state__title">No friends to add</span>
                    <span>Add a friend before creating a chat.</span>
                </div>
            ) : (
                <ul id="create-chat-friend-list">
                    {friendsDisplay}
                </ul>
            )}
            <label className="sr-only" htmlFor="get-chat-name">Chat name</label>
            <input placeholder="Chat Name" id="get-chat-name" value={chatName} type="text" maxLength={30} onChange={(e) => setChatName(e.target.value)}/>
            <p id="popup-display-msg" role="status" aria-live="polite">{displayMsg}</p>
            <div className="modal__actions">
                <button className="btn btn--ghost" type="button" onClick={() => setCreateChatsDisplay(false)}>Cancel</button>
                <button className="btn btn--primary" id="create-chat-btn" type="button" disabled={!canSubmit} onClick={async () => {
                    setCreating(true);
                    try {
                        await createChat(currentUser.username, currentUser.id, selectedFriends, chatName, setChatName, setSelectedFriends, setCreateChatsDisplay, setDisplayMsg);
                        await refreshChats();
                    } finally {
                        setCreating(false);
                    }
                }}>
                    {creating ? "Creating…" : "Create Chat"}
                </button>
            </div>
        </Modal>
    )
}
async function createChat (creator_username: string, creator_id: number, addedFriends: CurrOutIncFriendsQuery[], chat_name: string, setChatName: (value: string) => void, setSelectedFriends: (value: CurrOutIncFriendsQuery[]) => void, setCreateChatsDisplay: (value: boolean) => void, setDisplayMsg: (value: string) => void) {
    try {
        const parsed = await postJson<standardResponse>("/api/chats/createChat", {creator_username, creator_id, addedFriends, chat_name});
        if (!parsed.success) {
            // keep the name and selections so the user can correct and retry
            setDisplayMsg(parsed.message);
            return;
        }
        setChatName("");
        setSelectedFriends([]);
        setCreateChatsDisplay(false);
    } catch (err) {
        setDisplayMsg(errorMessage(err));
    }
}

export default ChatsPage;