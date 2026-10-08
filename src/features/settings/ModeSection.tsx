import { useState } from 'react';
import { ACCOUNT_MODE_LABELS, type AccountMode } from '../../domain/types';
import { saveProfile } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';

/** ייעוד האפליקציה: עסק, משק בית או שניהם. נשמר מיד. שינוי רק מסתיר או מציג מסכים ואינו מוחק נתונים. */
export function ModeSection() {
  const { user, profile } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const choose = (mode: AccountMode) => {
    setSaved(false);
    if (mode !== 'household' && !profile.businessName.trim()) {
      return setError('כדי להשתמש בעסק יש להזין קודם שם עסק בסעיף "פרטי חשבון".');
    }
    setError('');
    if (mode === profile.accountMode) return;
    saveProfile(user.uid, {
      firstName: profile.firstName,
      lastName: profile.lastName,
      businessName: profile.businessName,
      accountMode: mode,
    }).catch(() => reportFailure('לא הצלחנו לסנכרן את הייעוד. יש לנסות שוב.'));
    setSaved(true);
  };

  return (
    <div className="settings-form">
      <fieldset className="radio-group">
        <legend>האפליקציה משמשת לניהול</legend>
        {(Object.keys(ACCOUNT_MODE_LABELS) as AccountMode[]).map((mode) => (
          <label key={mode} className="check-row">
            <input type="radio" name="account-mode" checked={profile.accountMode === mode} onChange={() => choose(mode)} />
            <span>{ACCOUNT_MODE_LABELS[mode]}</span>
          </label>
        ))}
      </fieldset>
      <div className="field-hint">שינוי הייעוד רק מסתיר או מציג מסכים. שום נתון לא נמחק.</div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="form-success" role="status">
          נשמר אוטומטית.
        </div>
      )}
    </div>
  );
}
