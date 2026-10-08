import { useState } from 'react';
import { Field } from '../../components/Field';
import { ACCOUNT_MODE_LABELS, type AccountMode } from '../../domain/types';
import { saveProfile } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';

/**
 * פרטים אישיים, שם העסק וייעוד האפליקציה. אין כפתור שמירה:
 * שדות טקסט נשמרים ביציאה מהשדה, ובחירה נשמרת מיד. ערך לא תקין אינו נשמר.
 * שינוי ייעוד רק מסתיר או מציג מסכים, ואינו מוחק נתונים.
 */
export function ProfileSection() {
  const { user, profile } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [accountMode, setAccountMode] = useState<AccountMode>(profile.accountMode);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const save = (next: { firstName: string; lastName: string; businessName: string; accountMode: AccountMode }) => {
    setSaved(false);
    if (!next.firstName.trim() || !next.lastName.trim()) return setError('יש להזין שם פרטי ושם משפחה.');
    if (next.accountMode !== 'household' && !next.businessName.trim()) return setError('יש להזין שם עסק.');
    if (next.firstName.length > 60 || next.lastName.length > 60 || next.businessName.length > 120) {
      return setError('אחד השדות ארוך מדי.');
    }
    setError('');
    const unchanged =
      next.firstName === profile.firstName &&
      next.lastName === profile.lastName &&
      next.businessName === profile.businessName &&
      next.accountMode === profile.accountMode;
    if (unchanged) return;
    saveProfile(user.uid, next).catch(() =>
      reportFailure('לא הצלחנו לסנכרן את פרטי החשבון. יש לנסות שוב.'),
    );
    setSaved(true);
  };

  const current = { firstName, lastName, businessName, accountMode };

  return (
    <form className="settings-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <Field label="שם פרטי" value={firstName} onChange={(e) => setFirstName(e.target.value)} onBlur={() => save(current)} autoComplete="given-name" />
      <Field label="שם משפחה" value={lastName} onChange={(e) => setLastName(e.target.value)} onBlur={() => save(current)} autoComplete="family-name" />
      <Field label="שם העסק" value={businessName} onChange={(e) => setBusinessName(e.target.value)} onBlur={() => save(current)} autoComplete="organization" />
      <div className="field">
        <label htmlFor="account-mode">ייעוד האפליקציה</label>
        <select
          id="account-mode"
          className="input"
          value={accountMode}
          onChange={(e) => {
            const mode = e.target.value as AccountMode;
            setAccountMode(mode);
            save({ ...current, accountMode: mode });
          }}
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
          {error} השינוי לא נשמר.
        </div>
      )}
      {saved && !error && (
        <div className="form-success" role="status">
          נשמר אוטומטית.
        </div>
      )}
    </form>
  );
}
