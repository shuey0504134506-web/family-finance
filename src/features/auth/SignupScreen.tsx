import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../../components/Field';
import { describeError } from '../../services/authErrors';
import { useAuth } from './AuthContext';
import { validateSignup, type SignupValues } from './validation';
import { Icon } from '../../components/Icon';

export function SignupScreen() {
  const navigate = useNavigate();
  const { register, justRegistered, dismissWelcome } = useAuth();
  const [values, setValues] = useState<SignupValues>({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupValues, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  // מונע שליחה כפולה גם אם נלחץ פעמיים לפני שהמסך הספיק להתעדכן.
  const submitting = useRef(false);

  const update = (field: keyof SignupValues) => (event: { target: { value: string } }) =>
    setValues((previous) => ({ ...previous, [field]: event.target.value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;

    const found = validateSignup(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;

    submitting.current = true;
    setBusy(true);
    try {
      await register(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          businessName: values.businessName,
          email: values.email,
          accountMode: 'both',
        },
        values.password,
      );
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (justRegistered) {
    return (
      <main className="auth-screen">
        <div className="auth-column">
          <div className="card success-card">
            <div className="success-icon" aria-hidden="true">
              <Icon name="check" size="2em" />
            </div>
            <h1>החשבון נוצר בהצלחה</h1>
            <p className="muted">
              אפשר להתחיל לנהל את הכספים. ברירת המחדל היא עסק + משק בית, ואפשר לשנות זאת בהגדרות.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dismissWelcome();
                navigate('/', { replace: true });
              }}
            >
              מעבר ליומן שלי
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <div className="auth-column">
        <header className="auth-header">
          <h1>יצירת חשבון</h1>
          <p className="muted">כמה פרטים קצרים ומתחילים.</p>
        </header>

        <form className="card form-card" onSubmit={onSubmit} noValidate>
          <Field
            label="שם פרטי"
            autoComplete="given-name"
            value={values.firstName}
            onChange={update('firstName')}
            error={errors.firstName}
          />
          <Field
            label="שם משפחה"
            autoComplete="family-name"
            value={values.lastName}
            onChange={update('lastName')}
            error={errors.lastName}
          />
          <Field
            label="שם העסק"
            autoComplete="organization"
            value={values.businessName}
            onChange={update('businessName')}
            error={errors.businessName}
          />
          <Field
            label="כתובת מייל"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            value={values.email}
            onChange={update('email')}
            error={errors.email}
            hint="משמשת להתחברות ולשחזור סיסמה"
          />
          <Field
            label="סיסמה"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={values.password}
            onChange={update('password')}
            error={errors.password}
            hint="לפחות 8 תווים"
          />
          <Field
            label="אימות סיסמה"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={values.confirmPassword}
            onChange={update('confirmPassword')}
            error={errors.confirmPassword}
          />

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'יוצר חשבון…' : 'יצירת חשבון'}
          </button>
        </form>

        <p className="auth-footer-link">
          כבר יש לך חשבון? <Link to="/login">כניסה</Link>
        </p>
        <p className="auth-footer-link">
          <Link to="/welcome">חזרה</Link> · <Link to="/privacy">מדיניות פרטיות</Link>
        </p>
      </div>
    </main>
  );
}
