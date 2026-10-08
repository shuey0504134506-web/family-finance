import { useEffect, useRef, type ReactNode } from 'react';

/** חלון קופץ פשוט. נסגר ב-Escape ובלחיצה על הרקע, וממקד את החלון בפתיחה. */
export function Modal({
  title,
  onClose,
  placement = 'bottom',
  children,
}: {
  title: string;
  onClose: () => void;
  /** top: נפתח מלמעלה (תפריט). bottom: נפתח מלמטה. */
  placement?: 'top' | 'bottom';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={`modal-backdrop${placement === 'top' ? ' is-top' : ''}`} onClick={onClose}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="card-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
