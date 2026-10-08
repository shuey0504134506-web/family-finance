import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { deleteAccountAndData } from '../../services/accountService';
import { describeError } from '../../services/authErrors';
import { useReadyAuth } from '../auth/AuthContext';

/** מחיקת חשבון: מוחקת לצמיתות את כל הנתונים ואת ההתחברות. דורשת סיסמה ואישור מפורש. */
export function DeleteAccountSection() {
  const { user } = useReadyAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!confirmed) return setError('יש לאשר שהבנת שהמחיקה סופית.');
    setBusy(true);
    setError('');
    try {
      await deleteAccountAndData(user, password);
      // אחרי המחיקה המשתמש מנותק אוטומטית וחוזר למסך הפתיחה.
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  };

  return (
    <>
      {!open ? (
        <>
          <p className="muted small">מוחקת לצמיתות את כל ההכנסות, ההוצאות, הקטגוריות וההגדרות, ואת ההתחברות עצמה.</p>
          <button type="button" className="btn btn-danger-outline" onClick={() => setOpen(true)}>
            מחיקת החשבון והנתונים
          </button>
        </>
      ) : (
        <form className="settings-form" onSubmit={onSubmit} noValidate>
          <p>
            <strong>אי אפשר לשחזר.</strong> מומלץ להוריד קודם גיבוי מלא.
          </p>
          <Field label="סיסמה" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="check-row">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>הבנתי שכל הנתונים יימחקו לצמיתות</span>
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? 'מוחק…' : 'מחיקה סופית'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
            ביטול
          </button>
        </form>
      )}
    </>
  );
}
