import { Link } from 'react-router-dom';
import { ChevronLeft } from '../../components/icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSpaces } from '../spaces/SpacesContext';
import { useSpace } from '../spaces/SpaceRoute';

/** תפריט ראשי: מסך מלא עם אותה כותרת וחזרה כמו בהגדרות ובחיפוש. */
export function MenuScreen() {
  const space = useSpace();
  const { nameOf } = useSpaces();
  const key = space.key;

  const rows: { to: string; label: string; state?: { spaceKey: string } }[] = [
    { to: `/${key}/list/income`, label: 'הכנסות' },
    { to: `/${key}/list/expense`, label: 'הוצאות' },
    { to: `/${key}/budget`, label: 'תקציב' },
    { to: '/summary', label: 'סיכומים והשוואות', state: { spaceKey: key } },
    { to: `/${key}/debts`, label: 'חובות' },
    { to: `/${key}/import`, label: 'ייבוא נתונים' },
    ...(space.scope === 'household' ? [{ to: '/tithes', label: 'מעשרות' }] : []),
    { to: `/${key}/tasks`, label: 'רשימת משימות' },
    { to: `/${key}/shopping`, label: 'רשימת קניות' },
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
      </main>
    </div>
  );
}
