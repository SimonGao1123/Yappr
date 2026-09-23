import { errorMessage } from './http.js';
import { showToast } from '../ui/Toast.js';

/* Mutations used to fire, wait for the round trip, then refetch — so the UI sat
   still until the server answered. Apply the change locally first and undo it if
   the request fails. */

export interface OptimisticOptions<T> {
    /** Apply the change to local state immediately. */
    apply?: () => void;
    /** Undo `apply` when the request fails. */
    revert?: () => void;
    request: () => Promise<T>;
    onSuccess?: (result: T) => void;
    successToast?: string;
}

export async function runOptimistic<T>(options: OptimisticOptions<T>): Promise<T | null> {
    const { apply, revert, request, onSuccess, successToast } = options;

    apply?.();

    try {
        const result = await request();
        onSuccess?.(result);
        if (successToast) showToast(successToast, 'success');
        return result;
    } catch (err) {
        revert?.();
        showToast(errorMessage(err));
        return null;
    }
}
