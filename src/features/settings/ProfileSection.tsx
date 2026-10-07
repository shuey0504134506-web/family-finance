import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { ACCOUNT_MODE_LABELS, type AccountMode } from '../../domain/types';
import { saveProfile } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';

/** פרטים אישיים, שם העסק וייעוד האפליקציה. שינוי ייעוד רק מסתיר או מציג מסכים, ואינו מוחק נתונים. */
export function ProfileSection() {
  const { user, profile } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [accountMode, setAccountMode] = useState<AccountMode>(profile.accountMode);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const needsBusinessName = accountMode !== 'household';

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    if (!firstName.trim() || !lastName.trim()) return setError('יש להזין שם פרטי ושם משפחה.');
    if (needsBusinessName && !businessName.trim()) return setError('יש להזין שם עסק.');
    if (firstName.length > 60 || lastName.length > 60 || businessName.length > 120) {
      return setError('אחד השדות ארוך מדי.');
    }
    setError('');
    saveProfile(user.uid, { firstName, lastName, businessName, accountMode }).catch(() =>
      reportFailure('לא הצלחנו לסנכרן את פרטי החשבון. יש לנסות שוב.'),
    );
    setSaved(true);
  };

  return (
    <section className="card" aria-labelledby="profile-title">
      <h2 id="profile-title" className="card-title">
        פרטים ושימוש
      </h2>
      <form className="settings-form" onSubmit={onSubmit} noValidate>
        <Field label="שם פרטי" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
        <Field label="שם משפחה" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        <Field label="שם העסק" value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoComplete="organization" />
        <div className="field">
          <label htmlFor="account-mode">ייעוד האפליקציה</label>
          <select
            id="account-mode"
            className="input"
            value={accountMode}
            onChange={(e) => setAccountMode(e.target.value as AccountMode)}
          >
            {(Object.keys(ACCOUNT_MODE_LABELS) as AccountMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {ACCOUNT_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
          <div className="field-hint">שינוי הייעוד רק מסתיר או מציג מסכים. שום נתון לא נמחק.</div>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {saved && !error && (
          <div className="form-success" role="status">
            נשמר.
          </div>
        )}
        <button type="submit" className="btn btn-primary">
          שמירה
        </button>
      </form>
    </section>
  );
}
