import { useNavigate } from 'react-router-dom';
import { useSpaces } from '../features/spaces/SpacesContext';
import type { Space } from '../domain/spaces';
import { Icon } from './Icon';

/**
 * כפתורי מעבר בין המרחבים המוצגים (עסקים ומשק הבית), בתחתית המסך (אזור האגודל).
 * מעבר בין לשוניות מחליף את ההיסטוריה (replace), כך שכפתור Back של
 * אנדרואיד לא "מטייל" בין העסקים למשק הבית.
 * כשיש הרבה מרחבים, השורה ניתנת לגלילה לצדדים.
 */
export function ScopeTabs({ active }: { active: Space }) {
  const navigate = useNavigate();
  const { spaces, nameOf } = useSpaces();
  const go = (space: Space) => {
    if (space.key !== active.key) navigate(`/${space.key}`, { replace: true });
  };

  return (
    <nav className="scope-tabs" aria-label="מעבר בין העסקים למשק הבית">
      {spaces.map((space) => (
        <button
          key={space.key}
          type="button"
          className={`scope-tab scope-tab-${space.scope}${space.key === active.key ? ' is-active' : ''}`}
          aria-current={space.key === active.key ? 'page' : undefined}
          onClick={() => go(space)}
        >
          <Icon name={space.scope} /> <span className="scope-tab-name">{nameOf(space)}</span>
        </button>
      ))}
    </nav>
  );
}
