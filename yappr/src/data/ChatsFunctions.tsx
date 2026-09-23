import type { CurrOutIncFriendsQuery } from "../../definitions/friendsTypes.js";
import type { standardResponse } from "../../definitions/globalType.js";
import { postJson } from "./http.js";
import { runOptimistic } from "./optimistic.js";
import { showToast } from "../ui/Toast.js";

/* apply/revert let the caller drop a chat out of the list immediately. The
   server also pushes `chats:changed` to every member, so callers that pass
   nothing still converge. */

interface Hooks {
    apply?: () => void;
    revert?: () => void;
}

function run(url: string, payload: unknown, { apply, revert }: Hooks = {}) {
    return runOptimistic<standardResponse>({
        apply,
        revert,
        request: () => postJson<standardResponse>(url, payload),
        onSuccess: (parsed) => {
            if (!parsed.success) {
                revert?.();
                showToast(parsed.message ?? 'Action failed');
            }
        },
    });
}

export async function addMembers(
    username: string,
    user_id: number,
    addedFriends: CurrOutIncFriendsQuery[],
    chat_id: number,
    setAddMembersDisplay: (value: boolean) => void,
    hooks: Hooks = {},
) {
    setAddMembersDisplay(false);
    if (addedFriends.length === 0) {
        showToast("Select at least one friend to add", 'info');
        return null;
    }
    return run("/api/chats/addToChat", { username, user_id, addedFriends, chat_id }, hooks);
}

export async function kickUser(
    creator_id: number,
    user_id: number,
    user_username: string,
    kicked_id: number,
    kicked_username: string,
    chat_id: number,
    hooks: Hooks = {},
) {
    return run("/api/chats/kick", { creator_id, user_id, user_username, kicked_id, kicked_username, chat_id }, hooks);
}

export async function readMessages(chat_id: number, user_id: number) {
    try {
        await postJson<standardResponse>("/api/message/readMessages", { chat_id, user_id });
    } catch {
        // read receipts are not worth interrupting the user over
    }
}

export async function deleteChat(user_id: number, chat_id: number, creator_id: number, hooks: Hooks = {}) {
    return run("/api/chats/deleteChat", { user_id, chat_id, creator_id }, hooks);
}

export async function leaveChat(user_id: number, username: string, chat_id: number, creator_id: number, hooks: Hooks = {}) {
    return run("/api/chats/leaveChat", { user_id, username, chat_id, creator_id }, hooks);
}
