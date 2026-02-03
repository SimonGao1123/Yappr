import type { standardResponse } from "../../definitions/globalType.js";

export function unfriendFunction (friend_id: number, other_user_username: string) {
    fetch("/api/friends/unfriend", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({friend_id, other_user_username})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    })
}

export function cancelRequest (friend_id: number, receiver_id: string | number, receiver_username: string) {
    fetch("/api/friends/cancel", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({friend_id, receiver_id, receiver_username})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}

export function rejectRequest (friend_id: number, sender_username: string, sender_id: number) {
    fetch("/api/friends/reject", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({friend_id, sender_id, sender_username})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}
export function acceptRequest (friend_id: number, sender_username: string, sender_id: number) {
    fetch("/api/friends/accept", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({friend_id, sender_id, sender_username})
    }).then(async response => {
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
    }).catch(err => {
        console.log(err);
    });
}
export function sendRequest (sender_id: number, receiver_id: number) {
    fetch("/api/friends/sendFriendRequest", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({sender_id, receiver_id})
        }).then(async response => {
            const parsed: standardResponse = await response.json();
            console.log(parsed);
        }).catch(err => {
            console.log(err);
        });
}