import { useState } from 'react'
import { useEffect } from 'react';
import './FriendsPage.css';
import type { DisplayCurrentFriendsProps, DisplayIncomingRequestsProps, DisplayOutgoingRequestsProps, FriendsPageProps, SearchUsersProps } from '../../definitions/friendsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import { acceptRequest, cancelRequest, rejectRequest, unfriendFunction } from '../data/FriendsFunctions.js';

function FriendsPage (
    {currentFriends, 
    outgoingFriendReq, 
    incomingFriendReq, 
    currentUser, 
    ifLightMode}: FriendsPageProps) {

    const [searchBarInput, setSearchBarInput] = useState("");
    
    return (
        <>
            <main id="friends-main" className={!ifLightMode?"dark-mode":""}>
                <SearchUsers searchBarInput={searchBarInput} setSearchBarInput={setSearchBarInput} currentUser={currentUser} ifLightMode={ifLightMode}/>
                
                <DisplayCurrentFriends currentFriends={currentFriends} ifLightMode={ifLightMode}/>
                
                <div id="friends-right-column">
                    <DisplayOutgoingRequests outgoingFriendReq={outgoingFriendReq} ifLightMode={ifLightMode}/>
                    <DisplayIncomingRequests incomingFriendReq={incomingFriendReq} ifLightMode={ifLightMode}/>
                </div>
            </main>
        </>
    );
}

function SearchUsers ({searchBarInput, setSearchBarInput, currentUser, ifLightMode}: SearchUsersProps) {
    const [displayMsg, setDisplayMsg] = useState("");

    function addFriendFunction (e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        fetch("/api/friends/sendFriendRequest", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({sender_id: currentUser.id, receiver_id: searchBarInput})
        }).then(async response => {
            const parsed: standardResponse = await response.json();
            setDisplayMsg(parsed.message);
        }).catch(err => {
            console.log(err);
        });
        setSearchBarInput("");
    }
    return (
        <>
            <form id="add-friend-form" className={!ifLightMode?"dark-mode":""} onSubmit={addFriendFunction}>
                <div id="friend-search-container">
                    <input id="user-search-bar" className={!ifLightMode?"dark-mode":""} maxLength={30} type="text" placeholder="Search Username/ID" value={searchBarInput} onChange={(e) => setSearchBarInput(e.target.value)}/>
                    <button type="submit" id="send-req-btn" className={!ifLightMode?"dark-mode":""}>Send Friend Request</button>
                </div>
                <p id="display-msg" className={!ifLightMode?"dark-mode":""}>{displayMsg}</p>
            </form>
            
        </>

    );
}

function DisplayCurrentFriends ({currentFriends, ifLightMode}: DisplayCurrentFriendsProps) {
    const friendsList = [];

    for (let i = 0; i < currentFriends.length; i++) {
        const friend = currentFriends[i];
        if (!friend) continue;
        // each friend is an object {username, user_id, friend_id}
        friendsList.push(
            <li className={`friends-li ${!ifLightMode?"dark-mode":""}`} key={friend.friend_id}>{friend.username} ID: {friend.user_id}
                <button className={`unfriend-btn ${!ifLightMode?"dark-mode":""}`} onClick={() =>
                    unfriendFunction(friend.friend_id, friend.username)
                }> Unfriend </button>
            </li>
        );
    }
    return (
        <div id="current-friends-list" className={!ifLightMode?"dark-mode":""}>
            <h1 className={`friends-header ${!ifLightMode?"dark-mode":""}`}>Current Friends:</h1>
            <ul>
                {friendsList}
            </ul>
        </div>);
}

function DisplayOutgoingRequests ({outgoingFriendReq, ifLightMode}: DisplayOutgoingRequestsProps) {

    const outgoingReq = [];
    for (let i = 0; i < outgoingFriendReq.length; i++) {
        const request = outgoingFriendReq[i];
        if (!request) continue;
        // each request is an object {username, user_id, friend_id}
        outgoingReq.push(
            <li className={`friends-li ${!ifLightMode?"dark-mode":""}`} key={request.friend_id}>{request.username} ID: {request.user_id}
                <button className={`cancel-req-btn ${!ifLightMode?"dark-mode":""}`} onClick={() =>
                    cancelRequest(request.friend_id, request.user_id, request.username)
                }> Cancel </button>
            </li>
        );
    }

    return (
        <div id="outgoing-req-list" className={!ifLightMode?"dark-mode":""}> 
            <h1 className={`friends-header ${!ifLightMode?"dark-mode":""}`}>Outgoing Requests:</h1>
            <ul>
                {outgoingReq}
            </ul>
        </div>);
}

function DisplayIncomingRequests ({incomingFriendReq, ifLightMode}: DisplayIncomingRequestsProps) {

    const incomingReq = [];
    for (let i = 0; i < incomingFriendReq.length; i++) {
        const request = incomingFriendReq[i];
        if (!request) continue;
        incomingReq.push(
            <li className={`friends-li ${!ifLightMode?"dark-mode":""}`}  key={request.friend_id}>{request.username} ID: {request.user_id}
                <div className='incoming-friends-btn-container'>
                    <button className={`reject-req-btn ${!ifLightMode?"dark-mode":""}`} onClick={() =>
                        rejectRequest(request.friend_id, request.username, request.user_id)
                    }> Reject </button>
                    <button className={`accept-req-btn ${!ifLightMode?"dark-mode":""}`} onClick={() =>
                        acceptRequest(request.friend_id, request.username, request.user_id)
                    }> Accept </button>
                </div>
            </li>
        );
    }

    return (<div id="incoming-req-list" className={!ifLightMode?"dark-mode":""}>
            <h1 className={`friends-header ${!ifLightMode?"dark-mode":""}`}>Incoming Requests:</h1>
            <ul>
                {incomingReq}
            </ul>
    </div>);

}

export default FriendsPage;