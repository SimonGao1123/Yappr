import { useEffect, useRef } from 'react';

/* The popups were plain divs: no Escape, no focus trap, and focus was left
   wherever it happened to be when they closed. */

interface ModalProps {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    labelledById?: string;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, labelledById = 'modal-title' }: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const node = dialogRef.current;
        const first = node?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? node)?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== 'Tab' || !node) return;

            const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (items.length === 0) return;
            const firstItem = items[0]!;
            const lastItem = items[items.length - 1]!;

            if (event.shiftKey && document.activeElement === firstItem) {
                event.preventDefault();
                lastItem.focus();
            } else if (!event.shiftKey && document.activeElement === lastItem) {
                event.preventDefault();
                firstItem.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            previouslyFocused.current?.focus();
        };
    }, [onClose]);

    return (
        <div
            className="modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="modal"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledById}
                tabIndex={-1}
            >
                <h2 className="modal__title" id={labelledById}>{title}</h2>
                {children}
            </div>
        </div>
    );
}
