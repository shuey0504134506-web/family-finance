import { useCallback, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft } from '../../components/icons';

const PARAM = 's';

/** המסך הפתוח כרגע בתוך רשימת מסכים (הגדרות, ניהול), מתוך הכתובת. null = הרשימה עצמה. */
export function useOpenSection(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const open = params.get(PARAM);
  const setOpen = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set(PARAM, id);
          else next.delete(PARAM);
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );
  return [open, setOpen];
}

/**
 * אפשרות ברשימה: ברשימה היא שורה עם חץ, ובלחיצה נפתח מסך משלה (עם כפתור חזרה של המערכת).
 * רק המסך שנבחר מוצג, בלי גלילה ובלי פתיחה בתוך הרשימה.
 */
export function SectionItem({
  id,
  title,
  danger = false,
  children,
}: {
  id: string;
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useOpenSection();
  useEffect(() => {
    if (open === id) window.scrollTo(0, 0);
  }, [open, id]);
  if (open === null) {
    return (
      <div className={`acc-item${danger ? ' is-danger' : ''}`}>
        <h2 className="acc-heading">
          <button type="button" className="acc-trigger" onClick={() => setOpen(id)}>
            <span>{title}</span>
            <span className="acc-chevron" aria-hidden="true">
              <ChevronLeft />
            </span>
          </button>
        </h2>
      </div>
    );
  }
  if (open !== id) return null;
  return (
    <section className={`section-page${danger ? ' is-danger' : ''}`} aria-labelledby={`sp-${id}`}>
      <h2 className="section-page-title" id={`sp-${id}`}>{title}</h2>
      <div className="acc-body">{children}</div>
    </section>
  );
}
