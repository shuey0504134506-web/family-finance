import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { rememberPasswordForLock } from '../../services/lockPassword';
import { changePassword } from '../../services/accountService';
import { describeError } from '../../services/authErrors';
import { useReadyAuth } from '../auth/AuthContext';
import { MIN_PASSWORD_LENGTH } from '../auth/validation';

/** שינוי סיסמה. דורש להקליד שוב את הסיסמה הנוכחית. */
export function PasswordForm() {
  const { user } = useReadyAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setDone(false);
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`הסיסמה החדשה חייבת להכיל ${MIN_PASSWORD_LENGTH} תווים לפחות.`);
    if (next !== again) return setError('הסיסמאות החדשות אינן זהות.');
    setBusy(true);
    setError('');
    try {
      await changePassword(user, current, next);
      rememberPasswordForLock(user.uid, next);
      setCurrent('');
      setNext('');
      setAgain('');
      setDone(true);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={onSubmit} noValidate>
      <h3 className="subhead">שינוי סיסמה</h3>
      <Field label="סיסמה נוכחית" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field label="סיסמה חדשה" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <Field label="סיסמה חדשה, שוב" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {done && (
        <div className="form-success" role="status">
          הסיסמה שונתה.
        </div>
      )}
      <button type="submit" className="btn btn-secondary" disabled={busy}>
        {busy ? 'משנה…' : 'שינוי סיסמה'}
      </button>
    </form>
  );
}
