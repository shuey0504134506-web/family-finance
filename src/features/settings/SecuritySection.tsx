import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { rememberPasswordForLock } from '../../services/lockPassword';
import { changePassword, requestEmailChange } from '../../services/accountService';
import { describeError } from '../../services/authErrors';
import { useReadyAuth } from '../auth/AuthContext';
import { MIN_PASSWORD_LENGTH, isValidEmail } from '../auth/validation';

/** שינוי סיסמה ושינוי מייל. שניהם דורשים להקליד שוב את הסיסמה הנוכחית. */
export function SecuritySection() {
  return (
    <>
      <PasswordForm />
      <hr className="divider" />
      <EmailForm />
    </>
  );
}

function PasswordForm() {
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

function EmailForm() {
  const { user } = useReadyAuth();
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setSentTo('');
    if (!isValidEmail(email)) return setError('יש להזין כתובת מייל תקינה.');
    if (email.trim().toLowerCase() === (user.email ?? '').toLowerCase()) return setError('זו כבר הכתובת הנוכחית.');
    setBusy(true);
    setError('');
    try {
      await requestEmailChange(user, password, email);
      setSentTo(email.trim());
      setPassword('');
      setEmail('');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={onSubmit} noValidate>
      <h3 className="subhead">שינוי כתובת מייל</h3>
      <p className="muted small">כתובת נוכחית: <bdi dir="ltr">{user.email}</bdi></p>
      <Field label="כתובת מייל חדשה" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="סיסמה נוכחית" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {sentTo && (
        <div className="form-success" role="status">
          שלחנו קישור אימות אל {sentTo}. הכתובת תתחלף רק אחרי שתלחץ עליו. עד אז ממשיכים להיכנס עם הכתובת הישנה.
        </div>
      )}
      <button type="submit" className="btn btn-secondary" disabled={busy}>
        {busy ? 'שולח…' : 'שליחת קישור אימות'}
      </button>
    </form>
  );
}
