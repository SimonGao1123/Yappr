import type { CurrOutIncFriendsQuery } from "../../definitions/friendsTypes.js";
import type { standardResponse } from "../../definitions/globalType.js";

export async function addMembers (username: string, user_id: number, addedFriends: CurrOutIncFriendsQuery[], chat_id: number, setAddMembersDisplay: (value: boolean)=> void) {
    setAddMembersDisplay(false);
    if (addedFriends.length === 0) {
        console.log("No friends selected");
        return;
    }
    try {
        const response = await fetch("/api/chats/addToChat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username, user_id, addedFriends, chat_id})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    } catch (err) {
        console.log(err);
    }
}
export async function kickUser (creator_id: number, user_id: number, user_username: string, kicked_id: number, kicked_username: string, chat_id: number) {
    try {
        const response = await fetch("/api/chats/kick", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({creator_id, user_id, user_username, kicked_id, kicked_username, chat_id})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    } catch (err) {
        console.log(err);
    }
}
export function readMessages (chat_id: number, user_id: number) {
    fetch("/api/message/readMessages", {
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

export async function deleteChat (user_id: number, chat_id: number, creator_id: number) {
    try {
        const response = await fetch("/api/chats/deleteChat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({user_id, chat_id, creator_id})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    } catch (err) {
        console.log(err);
    }
}
export async function leaveChat (user_id: number, username: string, chat_id: number, creator_id: number) {
    try {
        const response = await fetch("/api/chats/leaveChat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({user_id, username, chat_id, creator_id})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    } catch (err) {
        console.log(err);
    }
}
