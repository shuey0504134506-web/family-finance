import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Field } from '../../components/Field';
import { describeError } from '../../services/authErrors';
import { requestPasswordReset } from '../../services/authService';
import { isValidEmail } from './validation';

export function ForgotPasswordScreen() {
  const location = useLocation();
  const initialEmail =
    (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!isValidEmail(email)) {
      setError('יש להזין כתובת מייל תקינה');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      const code = (caught as { code?: string }).code;
      // לא מגלים אם קיים חשבון עם הכתובת הזאת (מונע ניחוש כתובות).
      if (code === 'auth/user-not-found') setSent(true);
      else setError(describeError(caught));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-column">
        <header className="auth-header">
          <h1>שחזור סיסמה</h1>
          <p className="muted">נשלח אליך מייל עם קישור לבחירת סיסמה חדשה.</p>
        </header>

        {sent ? (
          <div className="card success-card">
            <div className="success-icon" aria-hidden="true">
              ✉️
            </div>
            <p>
              אם קיים חשבון עם הכתובת <bdi dir="ltr">{email}</bdi>, נשלח אליה מייל לשחזור הסיסמה.
              כדאי לבדוק גם בתיקיית הספאם.
            </p>
            <Link className="btn btn-primary" to="/login">
              חזרה לכניסה
            </Link>
          </div>
        ) : (
          <form className="card form-card" onSubmit={onSubmit} noValidate>
            <Field
              label="כתובת מייל"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'שולח…' : 'שליחת קישור לשחזור'}
            </button>
          </form>
        )}

        {!sent && (
          <p className="auth-footer-link">
            <Link to="/login">חזרה לכניסה</Link>
          </p>
        )}
      </div>
    </main>
  );
}
