import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { SpaceLabel } from '../../components/SpaceLabel';
import type { Space } from '../../domain/spaces';
import { useSpaces } from '../spaces/SpacesContext';

/** מעבר בין העסקים למשק הבית בתוך מסך רשימה. מוצג רק כשיש יותר ממרחב אחד במכשיר. */
export function ScopeSwitch({ space, page }: { space: Space; page: 'tasks' | 'shopping' }) {
  const navigate = useNavigate();
  const { spaces, nameOf } = useSpaces();
  if (spaces.length < 2) return null;
  return (
    <div className="segmented segmented-spaces" role="group" aria-label="מרחב">
      {spaces.map((s) => (
        <button
          key={s.key}
          type="button"
          className={space.key === s.key ? 'is-active' : ''}
          aria-pressed={space.key === s.key}
          onClick={() => space.key !== s.key && navigate(`/${s.key}/${page}`, { replace: true })}
        >
          <Icon name={s.scope} /> <SpaceLabel name={nameOf(s)} />
        </button>
      ))}
    </div>
  );
}
