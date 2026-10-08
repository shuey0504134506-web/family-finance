import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '../../components/Field';
import { describeError } from '../../services/authErrors';
import { forgetDeviceUser, readDeviceUser } from '../../services/deviceUser';
import { useAuth } from './AuthContext';
import { isValidEmail } from './validation';

/**
 * כניסה. במכשיר שכבר השתמש בחשבון מוצג שם המשתמש ויש להקליד רק סיסמה.
 * (ההתחברות מבוססת מייל, וזהו "שם המשתמש" שהמכשיר זוכר.)
 */
export function LoginScreen() {
  const { login } = useAuth();
  const [remembered, setRemembered] = useState(() => readDeviceUser());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const effectiveEmail = remembered ? remembered.email : email;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;

    if (!isValidEmail(effectiveEmail)) {
      setError('יש להזין כתובת מייל תקינה');
      return;
    }
    if (!password) {
      setError('יש להזין סיסמה');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await login(effectiveEmail, password);
      // לאחר הצלחה, AuthContext מזהה את המשתמש והמסך מתחלף אוטומטית.
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function switchUser() {
    forgetDeviceUser();
    setRemembered(null);
    setPassword('');
    setError('');
  }

  return (
    <main className="auth-screen login-screen">
      <div className="auth-column">
        <header className="auth-header">
          <h1>{remembered ? `שלום ${remembered.firstName}` : 'כניסה לחשבון'}</h1>
          {remembered ? (
            <p className="muted" dir="ltr">
              {remembered.email}
            </p>
          ) : (
            <p className="muted">יש להזין את כתובת המייל והסיסמה.</p>
          )}
        </header>

        <form className="card form-card" onSubmit={onSubmit} noValidate>
          {!remembered && (
            <Field
              label="כתובת מייל"
              type="email"
              inputMode="email"
              autoComplete="username"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
          <Field
            label="סיסמה"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus={Boolean(remembered)}
          />

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'נכנס…' : 'כניסה'}
          </button>
        </form>

        <p className="auth-footer-link auth-pill">
          <Link to="/forgot-password" state={{ email: effectiveEmail }}>
            שכחתי סיסמה
          </Link>
        </p>
        {remembered ? (
          <p className="auth-footer-link auth-pill">
            <button type="button" className="link-btn" onClick={switchUser}>
              כניסה עם משתמש אחר
            </button>
          </p>
        ) : null}
        <p className="auth-footer-link auth-pill">
          אין לך חשבון? <Link to="/signup">יצירת חשבון</Link>
        </p>
        <p className="auth-footer-link auth-plain">
          <Link to="/privacy">מדיניות פרטיות</Link>
        </p>
      </div>
    </main>
  );
}
