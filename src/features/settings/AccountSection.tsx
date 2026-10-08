import { useState } from 'react';
import { describeError } from '../../services/authErrors';
import { useAuth, useReadyAuth } from '../auth/AuthContext';
import { ProfileSection } from './ProfileSection';
import { EmailForm } from './SecuritySection';

/** פרטי חשבון: מייל (ושינויו), פרטים אישיים ושם העסק, ויציאה מהחשבון. */
export function AccountSection() {
  const { user } = useReadyAuth();
  const { signOutUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSignOut = async () => {
    setBusy(true);
    setError('');
    try {
      await signOutUser();
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <ProfileSection />
      <hr className="divider" />
      <EmailForm />
      <hr className="divider" />
      <p className="muted small">
        מחובר בתור <bdi dir="ltr">{user.email}</bdi>
      </p>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void onSignOut()}>
        {busy ? 'יוצא…' : 'יציאה מהחשבון'}
      </button>
    </div>
  );
}
