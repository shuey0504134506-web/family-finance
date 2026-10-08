import type { ReactNode } from 'react';
import { ChevronLeft } from '../../components/icons';

/** שורת הגדרה מתקפלת: כותרת בלבד כשסגורה, ופרטים בלחיצה. */
export function AccordionItem({
  id,
  title,
  open,
  onToggle,
  danger = false,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`acc-item${open ? ' is-open' : ''}${danger ? ' is-danger' : ''}`}>
      <h2 className="acc-heading">
        <button
          type="button"
          className="acc-trigger"
          aria-expanded={open}
          aria-controls={`acc-${id}`}
          id={`acc-btn-${id}`}
          onClick={() => onToggle(id)}
        >
          <span>{title}</span>
          <span className="acc-chevron" aria-hidden="true">
            <ChevronLeft />
          </span>
        </button>
      </h2>
      {open && (
        <div className="acc-body" id={`acc-${id}`} role="region" aria-labelledby={`acc-btn-${id}`}>
          {children}
        </div>
      )}
    </div>
  );
}
