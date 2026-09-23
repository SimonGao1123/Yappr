import { useState } from 'react'
import './FriendsPage.css';
import type { DisplayCurrentFriendsProps, DisplayIncomingRequestsProps, DisplayOutgoingRequestsProps, FriendsPageProps, SearchUsersProps } from '../../definitions/friendsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';
import { acceptRequest, cancelRequest, rejectRequest, unfriendFunction } from '../data/FriendsFunctions.js';
import { errorMessage, postJson } from '../data/http.js';
import { usePendingRemovals } from '../ui/usePendingRemovals.js';

function FriendsPage (
    {currentFriends,
    outgoingFriendReq,
    incomingFriendReq,
    currentUser,
    ifLightMode}: FriendsPageProps) {

    const [searchBarInput, setSearchBarInput] = useState("");

    return (
        <>
            <main id="friends-main">
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

function SearchUsers ({searchBarInput, setSearchBarInput, currentUser}: SearchUsersProps) {
    const [displayMsg, setDisplayMsg] = useState("");
    const [sending, setSending] = useState(false);

    async function addFriendFunction (e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (sending || !searchBarInput.trim()) return;

        setSending(true);
        setDisplayMsg("");
        try {
            const parsed = await postJson<standardResponse>("/api/friends/sendFriendRequest", {
                sender_id: currentUser.id,
                receiver_id: searchBarInput,
            });
            setDisplayMsg(parsed.message);
            if (parsed.success) setSearchBarInput("");
        } catch (err) {
            setDisplayMsg(errorMessage(err));
        } finally {
            setSending(false);
        }
    }

    return (
        <form id="add-friend-form" onSubmit={addFriendFunction}>
            <div id="friend-search-container">
                <label className="sr-only" htmlFor="user-search-bar">Search by username or ID</label>
                <input id="user-search-bar" maxLength={30} type="text" placeholder="Search Username/ID" value={searchBarInput} onChange={(e) => setSearchBarInput(e.target.value)}/>
                <button type="submit" id="send-req-btn" disabled={sending || !searchBarInput.trim()}>
                    {sending ? "Sending…" : "Send Friend Request"}
                </button>
            </div>
            <p id="display-msg" role="status" aria-live="polite">{displayMsg}</p>
        </form>
    );
}

function DisplayCurrentFriends ({currentFriends}: DisplayCurrentFriendsProps) {
    const {markRemoved, restore, isRemoved} = usePendingRemovals();
    const visible = currentFriends.filter(f => f && !isRemoved(f.friend_id));

    return (
        <div id="current-friends-list">
            <h1 className="friends-header">Current Friends:</h1>
            {visible.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state__title">No friends yet</span>
                    <span>Search for someone above to send your first request.</span>
                </div>
            ) : (
                <ul>
                    {visible.map(friend => (
                        <li className="friends-li" key={friend.friend_id}>{friend.username} ID: {friend.user_id}
                            <button className="unfriend-btn" onClick={() =>
                                unfriendFunction(friend.friend_id, friend.username, undefined, {
                                    apply: () => markRemoved(friend.friend_id),
                                    revert: () => restore(friend.friend_id),
                                })
                            }> Unfriend </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>);
}

function DisplayOutgoingRequests ({outgoingFriendReq}: DisplayOutgoingRequestsProps) {
    const {markRemoved, restore, isRemoved} = usePendingRemovals();
    const visible = outgoingFriendReq.filter(r => r && !isRemoved(r.friend_id));

    return (
        <div id="outgoing-req-list">
            <h1 className="friends-header">Outgoing Requests:</h1>
            {visible.length === 0 ? (
                <div className="empty-state">
                    <span>No pending requests sent.</span>
                </div>
            ) : (
                <ul>
                    {visible.map(request => (
                        <li className="friends-li" key={request.friend_id}>{request.username} ID: {request.user_id}
                            <button className="cancel-req-btn" onClick={() =>
                                cancelRequest(request.friend_id, request.user_id, request.username, undefined, {
                                    apply: () => markRemoved(request.friend_id),
                                    revert: () => restore(request.friend_id),
                                })
                            }> Cancel </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>);
}

function DisplayIncomingRequests ({incomingFriendReq}: DisplayIncomingRequestsProps) {
    const {markRemoved, restore, isRemoved} = usePendingRemovals();
    const visible = incomingFriendReq.filter(r => r && !isRemoved(r.friend_id));

    return (<div id="incoming-req-list">
            <h1 className="friends-header">Incoming Requests:</h1>
            {visible.length === 0 ? (
                <div className="empty-state">
                    <span>No incoming requests.</span>
                </div>
            ) : (
                <ul>
                    {visible.map(request => (
                        <li className="friends-li" key={request.friend_id}>{request.username} ID: {request.user_id}
                            <div className='incoming-friends-btn-container'>
                                <button className="reject-req-btn" onClick={() =>
                                    rejectRequest(request.friend_id, request.username, request.user_id, undefined, {
                                        apply: () => markRemoved(request.friend_id),
                                        revert: () => restore(request.friend_id),
                                    })
                                }> Reject </button>
                                <button className="accept-req-btn" onClick={() =>
                                    acceptRequest(request.friend_id, request.username, request.user_id, undefined, {
                                        apply: () => markRemoved(request.friend_id),
                                        revert: () => restore(request.friend_id),
                                    })
                                }> Accept </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
    </div>);
}

export default FriendsPage;
