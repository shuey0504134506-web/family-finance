import { useNavigate } from 'react-router-dom';
import { ChevronRight } from './icons';

/**
 * כותרת למסכים פנימיים: חץ חזרה (בצד ימין, כמקובל ב-RTL) וכותרת.
 * חזרה = חזרה לאחור בהיסטוריה, כמו כפתור Back של אנדרואיד. אם אין לאן
 * לחזור (פתיחה ישירה של המסך), חוזרים למסך הבית.
 */
export function ScreenHeader({ title, backTo }: { title: string; backTo?: string }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (backTo) {
      navigate(backTo, { replace: true });
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <header className="app-header screen-header">
      <div className="screen-header-row">
        <button type="button" className="icon-btn" aria-label="חזרה" onClick={goBack}>
          <ChevronRight />
        </button>
        <h1 className="screen-title">{title}</h1>
        <span className="screen-header-spacer" aria-hidden="true" />
      </div>
    </header>
  );
}
