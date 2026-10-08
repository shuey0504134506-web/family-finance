import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatMonthYear } from '../domain/dates';
import { useMonth } from '../features/month/MonthContext';
import { scopesForMode, type Scope } from '../domain/types';
import { useReadyAuth } from '../features/auth/AuthContext';
import { Modal } from './Modal';
import { ChevronLeft, ChevronRight, GearIcon, MenuIcon, SearchIcon } from './icons';

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
  const params = useParams();
  const { profile } = useReadyAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const scopes = scopesForMode(profile.accountMode);
  // המשימות והקניות שייכות לתחום שבו נמצאים. במסך בלי תחום (סיכומים) משתמשים בברירת המחדל.
  const scope: Scope = scopes.includes(params.scope as Scope) ? (params.scope as Scope) : scopes[0];
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
            aria-label="תפריט"
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
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
      {menuOpen && (
        <Modal title="תפריט" onClose={() => setMenuOpen(false)}>
          <nav className="menu-list" aria-label="תפריט">
            {(
              [
                ['/summary', 'סיכומים'],
                [`/${scope}/tasks`, 'רשימת משימות'],
                [`/${scope}/shopping`, 'רשימת קניות'],
              ] as const
            ).map(([to, label]) => (
              <button
                key={to}
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(to);
                }}
              >
                <span>{label}</span>
                <ChevronLeft />
              </button>
            ))}
          </nav>
        </Modal>
      )}
    </header>
  );
}
