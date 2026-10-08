import { useState } from 'react';
import { Field } from '../../components/Field';
import { saveProfile } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';

/**
 * פרטים אישיים ושם העסק. אין כפתור שמירה: כל שדה נשמר ביציאה ממנו. ערך לא תקין אינו נשמר.
 * ייעוד האפליקציה נמצא בסעיף נפרד (ModeSection).
 */
export function ProfileSection() {
  const { user, profile } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const save = (next: { firstName: string; lastName: string; businessName: string }) => {
    setSaved(false);
    if (!next.firstName.trim() || !next.lastName.trim()) return setError('יש להזין שם פרטי ושם משפחה.');
    if (profile.accountMode !== 'household' && !next.businessName.trim()) return setError('יש להזין שם עסק.');
    if (next.firstName.length > 60 || next.lastName.length > 60 || next.businessName.length > 120) {
      return setError('אחד השדות ארוך מדי.');
    }
    setError('');
    const unchanged =
      next.firstName === profile.firstName &&
      next.lastName === profile.lastName &&
      next.businessName === profile.businessName;
    if (unchanged) return;
    saveProfile(user.uid, { ...next, accountMode: profile.accountMode }).catch(() =>
      reportFailure('לא הצלחנו לסנכרן את פרטי החשבון. יש לנסות שוב.'),
    );
    setSaved(true);
  };

  const current = { firstName, lastName, businessName };

  return (
    <form className="settings-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <Field label="שם פרטי" value={firstName} onChange={(e) => setFirstName(e.target.value)} onBlur={() => save(current)} autoComplete="given-name" />
      <Field label="שם משפחה" value={lastName} onChange={(e) => setLastName(e.target.value)} onBlur={() => save(current)} autoComplete="family-name" />
      <Field label="שם העסק" value={businessName} onChange={(e) => setBusinessName(e.target.value)} onBlur={() => save(current)} autoComplete="organization" />
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
