import type { standardResponse } from "../../definitions/globalType.js";
import { postJson } from "./http.js";
import { runOptimistic } from "./optimistic.js";

/* Each action takes optional apply/revert callbacks so the caller can move the
   row between lists straight away. onComplete still runs after a successful
   request; the server also pushes `friends:changed`, so a caller that passes
   nothing still ends up consistent. */

interface Hooks {
    onComplete?: () => void;
    apply?: () => void;
    revert?: () => void;
}

function run(url: string, payload: unknown, { onComplete, apply, revert }: Hooks) {
    return runOptimistic<standardResponse>({
        apply,
        revert,
        request: () => postJson<standardResponse>(url, payload),
        onSuccess: (parsed) => {
            if (!parsed.success) {
                revert?.();
                return;
            }
            onComplete?.();
        },
    });
}

export async function unfriendFunction(
    friend_id: number,
    other_user_username: string,
    onComplete?: () => void,
    hooks: Omit<Hooks, 'onComplete'> = {},
) {
    return run("/api/friends/unfriend", { friend_id, other_user_username }, { onComplete, ...hooks });
}

export async function cancelRequest(
    friend_id: number,
    receiver_id: string | number,
    receiver_username: string,
    onComplete?: () => void,
    hooks: Omit<Hooks, 'onComplete'> = {},
) {
    return run("/api/friends/cancel", { friend_id, receiver_id, receiver_username }, { onComplete, ...hooks });
}

export async function rejectRequest(
    friend_id: number,
    sender_username: string,
    sender_id: number,
    onComplete?: () => void,
    hooks: Omit<Hooks, 'onComplete'> = {},
) {
    return run("/api/friends/reject", { friend_id, sender_id, sender_username }, { onComplete, ...hooks });
}

export async function acceptRequest(
    friend_id: number,
    sender_username: string,
    sender_id: number,
    onComplete?: () => void,
    hooks: Omit<Hooks, 'onComplete'> = {},
) {
    return run("/api/friends/accept", { friend_id, sender_id, sender_username }, { onComplete, ...hooks });
}

export async function sendRequest(
    sender_id: number,
    receiver_id: number,
    onComplete?: () => void,
    hooks: Omit<Hooks, 'onComplete'> = {},
) {
    return run("/api/friends/sendFriendRequest", { sender_id, receiver_id }, { onComplete, ...hooks });
}
