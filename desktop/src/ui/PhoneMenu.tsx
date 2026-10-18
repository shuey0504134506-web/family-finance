import { Link } from 'react-router-dom';
import { ChevronLeft } from '../../../src/components/icons';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { useSpaces } from '../../../src/features/spaces/SpacesContext';
import { useSpace } from '../../../src/features/spaces/SpaceRoute';
import { useController } from './useController';

/** תפריט ראשי של חשבון לא מקוון בטלפון: כמו תפריט האפליקציה, ועוד שחזור סיסמה ויציאה מהחשבון. */
export function PhoneMenu() {
  const space = useSpace();
  const { nameOf } = useSpaces();
  const controller = useController();
  const key = space.key;

  const rows: { to: string; label: string; state?: { spaceKey: string } }[] = [
    { to: `/${key}/list/income`, label: 'הכנסות' },
    { to: `/${key}/list/expense`, label: 'הוצאות' },
    { to: `/${key}/budget`, label: 'תקציב' },
    { to: '/summary', label: 'סיכומים והשוואות', state: { spaceKey: key } },
    { to: `/${key}/debts`, label: 'חובות' },
    { to: `/${key}/standing`, label: 'הוראות הקבע שלי' },
    { to: `/${key}/import`, label: 'ייבוא נתונים' },
    ...(space.scope === 'household' ? [{ to: '/tithes', label: 'מעשרות' }] : []),
    { to: `/${key}/tasks`, label: 'רשימת משימות' },
    { to: `/${key}/shopping`, label: 'רשימת קניות' },
    { to: '/recovery', label: 'שחזור סיסמה' },
    { to: '/help', label: 'עזרה' },
  ];

  return (
    <div className="app-shell">
      <ScreenHeader title={`תפריט · ${nameOf(space)}`} />
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
        <p className="auth-footer-link">
          <button type="button" className="link-btn" onClick={() => void controller.logout()}>
            יציאה מהחשבון
          </button>
        </p>
      </main>
    </div>
  );
}
