import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
        { replace: false, state: id ? { fromList: true } : undefined },
      );
    },
    [setParams],
  );
  return [open, setOpen];
}

/** כותרת המסך הפתוח כרגע (נרשמת מ-SectionItem), כדי שכותרת העמוד תציג את שם ההגדרה. */
let currentTitle: string | null = null;
const titleListeners = new Set<() => void>();
function setCurrentTitle(next: string | null): void {
  if (currentTitle === next) return;
  currentTitle = next;
  titleListeners.forEach((l) => l());
}
const subscribeTitle = (l: () => void) => {
  titleListeners.add(l);
  return () => titleListeners.delete(l);
};

/**
 * כותרת וחזרה למסך עם רשימת הגדרות: בתוך הגדרה הכותרת היא שמה, והחזרה פותחת את הרשימה (ולא את מסך הבית).
 * ברשימה עצמה: הכותרת הרגילה והחזרה הרגילה.
 */
export function useSectionHeader(listTitle: string): { title: string; onBack?: () => void } {
  const [open, setOpen] = useOpenSection();
  const title = useSyncExternalStore(subscribeTitle, () => currentTitle, () => null);
  const navigate = useNavigate();
  const location = useLocation();
  if (open === null) return { title: listTitle };
  return {
    title: title ?? listTitle,
    onBack: () => {
      // נפתח מהרשימה: צעד אחורה. נפתח מקישור ישיר: מחליפים את הכתובת ברשימה.
      if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
      else {
        setOpen(null);
      }
    },
  };
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
    if (open !== id) return;
    window.scrollTo(0, 0);
    setCurrentTitle(title);
    return () => setCurrentTitle(null);
  }, [open, id, title]);
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
