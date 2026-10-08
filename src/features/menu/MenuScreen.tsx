import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft } from '../../components/icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { scopesForMode, type Scope } from '../../domain/types';
import { useReadyAuth } from '../auth/AuthContext';

/** תפריט ראשי: מסך מלא עם אותה כותרת וחזרה כמו בהגדרות ובחיפוש. */
export function MenuScreen() {
  const params = useParams();
  const { profile } = useReadyAuth();
  const scope = params.scope as Scope;
  if ((scope !== 'business' && scope !== 'household') || !scopesForMode(profile.accountMode).includes(scope)) {
    return <Navigate to="/" replace />;
  }

  const rows = [
    { to: '/summary', label: 'סיכומים', state: { scope } },
    { to: `/${scope}/tasks`, label: 'רשימת משימות' },
    { to: `/${scope}/shopping`, label: 'רשימת קניות' },
  ];

  return (
    <div className="app-shell">
      <ScreenHeader title="תפריט" />
      <main className="content">
        <nav className="acc-list" aria-label="תפריט">
          {rows.map((row) => (
            <Link key={row.to} className="acc-trigger acc-link" to={row.to} state={row.state}>
              <span>{row.label}</span>
              <span className="acc-chevron" aria-hidden="true">
                <ChevronLeft />
              </span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
