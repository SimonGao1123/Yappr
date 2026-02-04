import type { standardResponse } from "../../definitions/globalType.js";

export async function unfriendFunction (friend_id: number, other_user_username: string, onComplete?: () => void) {
    try {
        const response = await fetch("/api/friends/unfriend", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, other_user_username})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
        if (onComplete) onComplete();
    } catch (err) {
        console.log(err);
    }
}

export async function cancelRequest (friend_id: number, receiver_id: string | number, receiver_username: string, onComplete?: () => void) {
    try {
        const response = await fetch("/api/friends/cancel", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, receiver_id, receiver_username})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
        if (onComplete) onComplete();
    } catch (err) {
        console.log(err);
    }
}

export async function rejectRequest (friend_id: number, sender_username: string, sender_id: number, onComplete?: () => void) {
    try {
        const response = await fetch("/api/friends/reject", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, sender_id, sender_username})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
        if (onComplete) onComplete();
    } catch (err) {
        console.log(err);
    }
}
export async function acceptRequest (friend_id: number, sender_username: string, sender_id: number, onComplete?: () => void) {
    try {
        const response = await fetch("/api/friends/accept", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({friend_id, sender_id, sender_username})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed.message);
        if (onComplete) onComplete();
    } catch (err) {
        console.log(err);
    }
}
export async function sendRequest (sender_id: number, receiver_id: number, onComplete?: () => void) {
    try {
        const response = await fetch("/api/friends/sendFriendRequest", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({sender_id, receiver_id})
        });
        const parsed: standardResponse = await response.json();
        console.log(parsed);
        if (onComplete) onComplete();
    } catch (err) {
        console.log(err);
    }
}