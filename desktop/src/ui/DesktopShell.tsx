import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../src/components/Icon';
import { SpaceLabel } from '../../../src/components/SpaceLabel';
import { isAdminEmail } from '../../../src/config/admin';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { parseSpaceKey } from '../../../src/domain/spaces';
import { useSpaces } from '../../../src/features/spaces/SpacesContext';
import { SyncChip } from './SyncChip';
import { useController, useUi } from './useController';

/**
 * מעטפת התוכנה: תפריט צד קבוע (בימין, כמקובל בעברית) ותוכן רחב משמאלו.
 * המסכים עצמם הם מסכי האפליקציה, ללא שינוי; כאן רק הניווט והפריסה מותאמים למסך מחשב.
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const { spaces, nameOf, defaultSpace } = useSpaces();
  const { state } = useAuth();
  const ui = useUi();
  const c = useController();
  const loc = useLocation();
  const navigate = useNavigate();
  const first = loc.pathname.split('/')[1] ?? '';
  const current = parseSpaceKey(first) ?? defaultSpace;
  const key = current.key;
  // כפתור "חזרה" בכותרת של מסכים פנימיים מחזיר תמיד למסך הראשי של המרחב הנוכחי, ולא למסך הקודם.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest('.screen-header-row > .icon-btn:first-child');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      navigate(`/${key}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate, key]);

  // כרטיס "פעולות אחרונות" נמתח לגובה הכרטיס שלידו ומציג כמה פעולות שנכנסות בו.
  useEffect(() => {
    const fit = () => {
      const list = document.querySelector<HTMLElement>('.desktop-content .recent-card .recent-list');
      if (!list) return;
      const rows = [...list.children] as HTMLElement[];
      rows.forEach((r) => { r.style.display = ''; });
      for (let i = rows.length - 1; i > 0 && list.scrollHeight > list.clientHeight + 1; i--) rows[i]!.style.display = 'none';
    };
    const mo = new MutationObserver(() => requestAnimationFrame(fit));
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', fit);
    fit();
    return () => { mo.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  const admin = state.status === 'ready' && isAdminEmail(state.user.email);

  const rows: { to: string; label: string; icon?: string; end?: boolean }[] = [
    { to: `/${key}`, label: 'סקירה', end: true },
    { to: `/${key}/list/income`, label: 'הכנסות' },
    { to: `/${key}/list/expense`, label: 'הוצאות' },
    { to: `/${key}/budget`, label: 'תקציב' },
    { to: '/summary', label: 'סיכומים והשוואות' },
    { to: `/${key}/debts`, label: 'חובות' },
    { to: `/${key}/standing`, label: 'הוראות הקבע שלי' },
    { to: `/${key}/import`, label: 'ייבוא נתונים' },
    ...(current.scope === 'household' ? [{ to: '/tithes', label: 'מעשרות' }] : []),
    { to: `/${key}/tasks`, label: 'רשימת משימות' },
    { to: `/${key}/shopping`, label: 'רשימת קניות' },
    { to: '/search', label: 'חיפוש' },
  ];
  const footer = [
    { to: '/settings', label: 'הגדרות' },
    { to: '/recovery', label: 'שחזור סיסמה' },
    { to: '/help', label: 'עזרה' },
    ...(admin ? [{ to: '/admin', label: 'ניהול' }] : []),
  ];

  return (
    <div className={`desktop-shell scope-${current.scope}`}>
      <aside className="side" aria-label="תפריט ראשי">
        <div className="side-brand">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={36} height={36} draggable={false} />
          <span>ניהול כספים</span>
        </div>

        <div className="side-spaces" role="tablist" aria-label="מעבר בין העסקים למשק הבית">
          {spaces.map((s) => (
            <NavLink key={s.key} role="tab" to={`/${s.key}`} className={`side-space scope-tab-${s.scope}${s.key === key ? ' is-active' : ''}`} aria-selected={s.key === key}>
              <Icon name={s.scope} /> <SpaceLabel name={nameOf(s)} className="scope-tab-name" />
            </NavLink>
          ))}
        </div>

        <nav className="side-nav" aria-label="מסכים">
          {rows.map((r) => (
            <NavLink key={r.to} to={r.to} end={r.end} className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}>{r.label}</NavLink>
          ))}
        </nav>

        <div className="side-bottom">
          <nav className="side-nav side-nav-minor" aria-label="כללי">
            {footer.map((r) => (
              <NavLink key={r.to} to={r.to} className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}>{r.label}</NavLink>
            ))}
          </nav>
          <SyncChip />
          <div className="side-user">
            <span className="side-user-name">{ui.me?.displayName || ui.me?.email}</span>
            <button type="button" className="link-btn" onClick={() => void c.logout()}>נעילה / החלפת חשבון</button>
          </div>
        </div>
      </aside>
      <div className="desktop-content">{children}</div>
    </div>
  );
}
