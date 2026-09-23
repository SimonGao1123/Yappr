import { useCallback, useState } from 'react';

/* Friend and chat lists live in App state and arrive as props, so a child can't
   mutate them directly. Instead it marks a row as pending-removal, which hides
   it immediately; if the request fails the mark is lifted and the row returns.
   The server's change push then refreshes the real list. */

export function usePendingRemovals() {
    const [pending, setPending] = useState<ReadonlySet<number>>(() => new Set());

    const markRemoved = useCallback((id: number) => {
        setPending((prev) => new Set(prev).add(id));
    }, []);

    const restore = useCallback((id: number) => {
        setPending((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const isRemoved = useCallback((id: number) => pending.has(id), [pending]);

    return { markRemoved, restore, isRemoved };
}
