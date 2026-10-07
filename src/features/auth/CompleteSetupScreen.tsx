import { useRef, useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { describeError } from '../../services/authErrors';
import { useAuth } from './AuthContext';

/**
 * מסך התאוששות: המשתמש נוצר ב-Firebase Authentication, אך יצירת רשומות
 * החשבון נקטעה (למשל נפל האינטרנט). ההשלמה בטוחה לשליחה חוזרת.
 */
export function CompleteSetupScreen() {
  const { completeSetup, signOutUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!firstName.trim() || !lastName.trim() || !businessName.trim()) {
      setError('יש למלא את כל השדות');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await completeSetup({ firstName, lastName, businessName, accountMode: 'both' });
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-column">
        <header className="auth-header">
          <h1>השלמת הגדרת החשבון</h1>
          <p className="muted">
            יצירת החשבון לא הושלמה עד הסוף. כדי להמשיך יש למלא את הפרטים שוב.
          </p>
        </header>
        <form className="card form-card" onSubmit={onSubmit} noValidate>
          <Field
            label="שם פרטי"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <Field
            label="שם משפחה"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
          <Field
            label="שם העסק"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
          />
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'שומר…' : 'השלמת הגדרה'}
          </button>
        </form>
        <p className="auth-footer-link">
          <button type="button" className="link-btn" onClick={() => void signOutUser()}>
            יציאה
          </button>
        </p>
      </div>
    </main>
  );
}
