import { useNavigate } from 'react-router-dom';
import type { Scope } from '../domain/types';

/**
 * כפתור מעבר ברור בין עסק למשק בית, בתחתית המסך (אזור האגודל).
 * מעבר בין לשוניות מחליף את ההיסטוריה (replace), כך שכפתור Back של
 * אנדרואיד לא "מטייל" בין העסק למשק הבית.
 */
export function ScopeTabs({ active }: { active: Scope }) {
  const navigate = useNavigate();
  const go = (scope: Scope) => {
    if (scope !== active) navigate(`/${scope}`, { replace: true });
  };

  return (
    <nav className="scope-tabs" aria-label="מעבר בין עסק למשק בית">
      <button
        type="button"
        className={`scope-tab scope-tab-business${active === 'business' ? ' is-active' : ''}`}
        aria-current={active === 'business' ? 'page' : undefined}
        onClick={() => go('business')}
      >
        <span aria-hidden="true">💼</span> עסק
      </button>
      <button
        type="button"
        className={`scope-tab scope-tab-household${active === 'household' ? ' is-active' : ''}`}
        aria-current={active === 'household' ? 'page' : undefined}
        onClick={() => go('household')}
      >
        <span aria-hidden="true">🏠</span> משק בית
      </button>
    </nav>
  );
}
