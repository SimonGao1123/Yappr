import { useEffect, useState } from 'react';

/* Errors previously went to console.log only, so a failed action looked like
   nothing happened. showToast() is callable from plain modules (the src/data
   helpers) as well as components, so the store lives outside React. */

export type ToastVariant = 'error' | 'success' | 'info';

export interface Toast {
    id: number;
    message: string;
    variant: ToastVariant;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) listener(toasts);
}

export function dismissToast(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
}

export function showToast(message: string, variant: ToastVariant = 'error') {
    const id = nextId++;
    toasts = [...toasts, { id, message, variant }];
    emit();
    setTimeout(() => dismissToast(id), 5000);
    return id;
}

export function ToastRegion() {
    const [items, setItems] = useState<Toast[]>(toasts);

    useEffect(() => {
        listeners.add(setItems);
        return () => {
            listeners.delete(setItems);
        };
    }, []);

    if (items.length === 0) return null;

    return (
        <div className="toast-region" role="region" aria-label="Notifications">
            {items.map((toast) => (
                <div
                    key={toast.id}
                    className={`toast toast--${toast.variant}`}
                    role={toast.variant === 'error' ? 'alert' : 'status'}
                >
                    <span>{toast.message}</span>
                    <button
                        type="button"
                        className="toast__close"
                        onClick={() => dismissToast(toast.id)}
                        aria-label="Dismiss notification"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
