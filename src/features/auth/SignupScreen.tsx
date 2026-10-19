import { AuthShell } from '../../components/AuthShell';
import { usePrivacyLabel } from '../privacy/privacyLabel';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../../components/Field';
import { describeErrorWithCode } from '../../services/authErrors';
import { useAuth } from './AuthContext';
import { BusinessesFields } from './BusinessesFields';
import { normalizePhone, validateSignup, type SignupValues } from './validation';
import { Icon } from '../../components/Icon';
import { DEFAULT_BUSINESS_ID } from '../../domain/spaces';
import { saveLogo } from '../../services/logoService';
import { LogoControl } from '../settings/LogoControl';

export function SignupScreen() {
  const privacyLabel = usePrivacyLabel();
  const navigate = useNavigate();
  const { register, justRegistered, dismissWelcome } = useAuth();
  const [values, setValues] = useState<SignupValues>({
    firstName: '',
    lastName: '',
    businessName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [extraBusinesses, setExtraBusinesses] = useState<string[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
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
      const newUid = await register(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          businessName: values.businessName,
          phone: normalizePhone(values.phone),
          email: values.email,
          accountMode: 'both',
          extraBusinessNames: extraBusinesses.map((n) => n.trim()).filter(Boolean),
          householdName: householdName.trim(),
        },
        values.password,
      );
      // הלוגו לא חוסם את ההרשמה: נשמר במכשיר מיד, ובחשבון כשאפשר
      if (logo) saveLogo(newUid, DEFAULT_BUSINESS_ID, logo).catch(() => undefined);
    } catch (error) {
      setFormError(describeErrorWithCode(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (justRegistered) {
    return (
      <AuthShell>
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
      </AuthShell>
    );
  }

  return (
    <AuthShell className="signup-shell" width={760}>
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
            label="שם העסק (לא חובה)"
            autoComplete="organization"
            value={values.businessName}
            onChange={update('businessName')}
            error={errors.businessName}
          />
          <LogoControl data={logo} onChange={setLogo} />
          <BusinessesFields
            householdName={householdName}
            onHouseholdName={setHouseholdName}
            extras={extraBusinesses}
            onExtras={setExtraBusinesses}
          />
          <Field
            label="מספר טלפון"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={values.phone}
            onChange={update('phone')}
            error={errors.phone}
            hint="ליצירת קשר בנושא החשבון. מוצג למנהל האפליקציה בלבד"
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
            hint="לפחות 10 תווים"
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
          <Link to="/welcome">חזרה</Link> · <Link to="/privacy">{privacyLabel}</Link>
        </p>
      </div>
    </AuthShell>
  );
}
