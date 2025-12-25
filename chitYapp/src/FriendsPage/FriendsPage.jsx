import { useState } from 'react'
import { useEffect } from 'react';
import './FriendsPage.css';

function FriendsPage (
    {currentFriends, setCurrentFriends, 
    outgoingFriendReq, setOutFriendReq, 
    incomingFriendReq, setInFriendReq, currentUser}) {

    const [searchBarInput, setSearchBarInput] = useState("");
    
    return (
        <>
            <SearchUsers searchBarInput={searchBarInput} setSearchBarInput={setSearchBarInput} currentUser={currentUser}/>
            
            <DisplayCurrentFriends currentFriends={currentFriends} setCurrentFriends={setCurrentFriends} currentUser={currentUser}/>
            <DisplayOutgoingRequests outgoingFriendReq={outgoingFriendReq} setOutFriendReq={setOutFriendReq} currentUser={currentUser}/>
            <DisplayIncomingRequests incomingFriendReq={incomingFriendReq} setInFriendReq={setInFriendReq} currentUser={currentUser}/>
        </>
    );
}

function SearchUsers ({searchBarInput, setSearchBarInput, currentUser}) {
    const [displayMsg, setDisplayMsg] = useState("");

    function addFriendFunction (e) {
        e.preventDefault();
        fetch("http://localhost:3000/friends/sendFriendRequest", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({sender_id: currentUser.id, receiver_id: searchBarInput})
        }).then(async response => {
            const parsed = await response.json();
            setDisplayMsg(parsed.message);
        }).catch(err => {
            console.log(err);
        });
        setSearchBarInput("");
    }
    return (
        <>
            <form id="add-friend-form" onSubmit={addFriendFunction}>
                <input id="user-search-bar" maxLength={30} type="text" placeholder="Search Username/ID" value={searchBarInput} onChange={(e) => setSearchBarInput(e.target.value)}/>
                <button type="submit" id="send-req-btn">Send Friend Request</button>
            </form>
            <p id="display-msg">{displayMsg}</p>
        </>

    );
}

function DisplayCurrentFriends ({currentFriends, setCurrentFriends, currentUser}) {
    function getCurrentFriends () {
        fetch(`http://localhost:3000/friends/currFriends/${currentUser.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setCurrentFriends(data.currFriends);
                    }
                })
                .catch(err => console.log(err));
    }
    useEffect(() => {
        if (!currentUser?.id) return;

        const intervalId = setInterval(() => {
            getCurrentFriends();
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id, currentFriends]);

    const friendsList = [];

    function unfriendFunction (friend_id, other_user_username, other_user_id) {
        fetch("http://localhost:3000/friends/unfriend", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, other_user_username, other_user_id})
        }).then(async response => {
            const parsed = await response.json();
            console.log(parsed.message);
        }).catch(err => {
            console.log(err);
        })
    }
    for (let i = 0; i < currentFriends.length; i++) {
        const friend = currentFriends[i];
        // each friend is an object {username, user_id, friend_id}
        friendsList.push(
            <li key={friend.friend_id}>{friend.username} ID: {friend.user_id}
                <button className="unfriend-btn" onClick={() =>
                    unfriendFunction(friend.friend_id, friend.username, friend.user_id)
                }> Unfriend </button>
            </li>
        );
    }
    return (
        <div id="current-friends-list"> 
            <h1>Current Friends:</h1>
            <ul>
                {friendsList}
            </ul>
        </div>);
}

function DisplayOutgoingRequests ({outgoingFriendReq, setOutFriendReq, currentUser}) {
    function getOutgoingRequests () {
        fetch(`http://localhost:3000/friends/outgoingRequests/${currentUser.id}`, {
            method: "GET"
        }).then(async response => {
            const data = await response.json();
            if (data.success) {
                setOutFriendReq(data.outgoingRequests);
            }
            
        }).catch(err => {
            console.log(err);
        });
    }
    useEffect(() => {
        if (!currentUser?.id) return;

        const intervalId = setInterval(() => {
            getOutgoingRequests();
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id, outgoingFriendReq]);


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

    const outgoingReq = [];
    for (let i = 0; i < outgoingFriendReq.length; i++) {
        const request = outgoingFriendReq[i];
        outgoingReq.push(
            <li key={request.friend_id}>{request.username} ID: {request.user_id}
                <button className="cancel-req-btn" onClick={() =>
                    cancelRequest(request.friend_id, request.user_id, request.username)
                }> Cancel </button>
            </li>
        );
    }

    return (
        <div id="outgoing-req-list"> 
            <h1>Outgoing Friend Requests:</h1>
            <ul>
                {outgoingReq}
            </ul>
        </div>);
}

function DisplayIncomingRequests ({incomingFriendReq, setInFriendReq, currentUser}) {
    function getIncomingReq () {
        fetch(`http://localhost:3000/friends/incomingRequests/${currentUser.id}`, {
            method: "GET"
        }).then(async response => {
            const parsed = await response.json();
            if (parsed.success) {
                setInFriendReq(parsed.incomingRequests);
            }
        }).catch(err => {
            console.log(err);
        })
    }

    useEffect(() => {
        if (!currentUser?.id) return;

        const intervalId = setInterval(() => {
            getIncomingReq();
        }, 2000);

        return () => clearInterval(intervalId);
    }, [currentUser?.id, incomingFriendReq]);

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

    const incomingReq = [];
    for (let i = 0; i < incomingFriendReq.length; i++) {
        const request = incomingFriendReq[i];

        incomingReq.push(
            <li key={request.friend_id}>{request.username} ID: {request.user_id}
                <button className="reject-req-btn" onClick={() =>
                    rejectRequest(request.friend_id, request.username, request.user_id)
                }> Reject </button>
                <button className="accept-req-btn" onClick={() =>
                    acceptRequest(request.friend_id, request.username, request.user_id)
                }> Accept </button>
            </li>
        );
    }

    return (<div id="incoming-req-list"> 
            <h1>Incoming Friend Requests:</h1>
            <ul>
                {incomingReq}
            </ul>
    </div>);

}

export default FriendsPage;