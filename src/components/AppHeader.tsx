import { useNavigate } from 'react-router-dom';
import { formatMonthYear } from '../domain/dates';
import { useMonth } from '../features/month/MonthContext';
import { ChartIcon, ChevronLeft, ChevronRight, GearIcon, SearchIcon } from './icons';

/**
 * שורת כותרת קבועה (sticky): הגדרות בצד שמאל, חודש במרכז.
 * השורה מוגדרת LTR בכוונה כדי שהמיקום הפיזי של הכפתורים יהיה קבוע ויתאים
 * לאפיון (הגדרות משמאל), והטקסט שבתוכה ממשיך להיות RTL.
 *
 * חץ "חודש קודם" מימין ו"חודש הבא" משמאל, כמו ציר זמן בעברית.
 * הכותרת מכבדת את אזור ה-Status Bar של אנדרואיד (safe-area).
 */
export function AppHeader() {
  const navigate = useNavigate();
  const { selected, status, goPrevious, goNext, backToCurrent } = useMonth();

  return (
    <header className="app-header">
      <div className="header-row">
        <div className="header-side header-side-start">
          <button
            type="button"
            className="icon-btn"
            aria-label="הגדרות"
            onClick={() => navigate('/settings')}
          >
            <GearIcon />
          </button>
        </div>

        <div className="month-nav">
          <button type="button" className="icon-btn" aria-label="לחודש הבא" onClick={goNext}>
            <ChevronLeft />
          </button>
          <div className="month-label" aria-live="polite">
            {formatMonthYear(selected)}
          </div>
          <button type="button" className="icon-btn" aria-label="לחודש הקודם" onClick={goPrevious}>
            <ChevronRight />
          </button>
        </div>

        <div className="header-side header-side-end">
          <button
            type="button"
            className="icon-btn"
            aria-label="סיכומים"
            onClick={() => navigate('/summary')}
          >
            <ChartIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="חיפוש"
            onClick={() => navigate('/search')}
          >
            <SearchIcon />
          </button>
        </div>
      </div>

      {status !== 'current' && (
        <div className="back-to-current">
          <button type="button" className="chip-btn" onClick={backToCurrent}>
            חזרה לחודש הנוכחי
          </button>
        </div>
      )}
    </header>
  );
}
