import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { scopesForMode, type Scope } from '../../domain/types';
import { useReadyAuth } from '../auth/AuthContext';

/** מעבר בין עסק למשק בית בתוך מסך רשימה. מוצג רק לחשבון שמשתמש בשניהם. */
export function ScopeSwitch({ scope, page }: { scope: Scope; page: 'tasks' | 'shopping' }) {
  const navigate = useNavigate();
  const { profile } = useReadyAuth();
  const scopes = scopesForMode(profile.accountMode);
  if (scopes.length < 2) return null;
  return (
    <div className="segmented" role="group" aria-label="תחום">
      {scopes.map((s) => (
        <button
          key={s}
          type="button"
          className={scope === s ? 'is-active' : ''}
          aria-pressed={scope === s}
          onClick={() => scope !== s && navigate(`/${s}/${page}`, { replace: true })}
        >
          <Icon name={s} /> {s === 'business' ? 'עסק' : 'משק בית'}
        </button>
      ))}
    </div>
  );
}
