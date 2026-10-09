import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { requestEmailChange, saveProfile } from '../../services/accountService';
import { describeError } from '../../services/authErrors';
import { useAuth, useReadyAuth } from '../auth/AuthContext';
import { isValidEmail } from '../auth/validation';
import { useSyncNotice } from '../sync/SyncNotice';

/**
 * פרטי חשבון. הפרטים מוצגים לקריאה בלבד. שינוי נעשה בחלון "עדכון פרטים" ונשמר בלחיצה על אישור.
 * החלפת כתובת מייל שולחת קישור אימות לכתובת החדשה (Firebase), והכתובת מתחלפת רק אחרי הלחיצה עליו.
 */
export function AccountSection() {
  const { user, profile } = useReadyAuth();
  const { signOutUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSignOut = async () => {
    setBusy(true);
    setError('');
    try {
      await signOutUser();
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Field label="שם פרטי" value={profile.firstName} readOnly />
      <Field label="שם משפחה" value={profile.lastName} readOnly />
      <Field label="כתובת מייל" value={user.email ?? ''} dir="ltr" readOnly />

      <button type="button" className="btn btn-secondary" onClick={() => { setSentTo(''); setEditing(true); }}>
        עדכון פרטים
      </button>

      {sentTo && (
        <div className="form-success" role="status">
          בקשת ההחלפה נשלחה אל {sentTo}. אם הכתובת פנויה, יגיע אליה קישור אימות (כדאי לבדוק גם בספאם), והכתובת תתחלף רק אחרי הלחיצה עליו. אם הכתובת כבר רשומה בחשבון אחר באפליקציה, לא יישלח מייל (מטעמי אבטחה). עד אז ממשיכים להיכנס עם הכתובת הישנה.
        </div>
      )}

      <hr className="divider" />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void onSignOut()}>
        {busy ? 'יוצא…' : 'יציאה מהחשבון'}
      </button>

      {editing && (
        <EditDetailsDialog
          onClose={() => setEditing(false)}
          onEmailRequested={(email) => setSentTo(email)}
        />
      )}
    </div>
  );
}

function EditDetailsDialog({
  onClose,
  onEmailRequested,
}: {
  onClose: () => void;
  onEmailRequested: (email: string) => void;
}) {
  const { user, profile } = useReadyAuth();
  const { reportFailure } = useSyncNotice();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(user.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== (user.email ?? '').toLowerCase();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!firstName.trim() || !lastName.trim()) return setError('יש להזין שם פרטי ושם משפחה.');
    if (firstName.length > 60 || lastName.length > 60) return setError('אחד השדות ארוך מדי.');
    if (emailChanged && !isValidEmail(email)) return setError('יש להזין כתובת מייל תקינה.');
    if (emailChanged && !password) return setError('להחלפת כתובת מייל יש להזין את הסיסמה הנוכחית.');

    setBusy(true);
    setError('');
    try {
      // קודם המייל: אם הסיסמה שגויה או אין חיבור, שום דבר לא נשמר והחלון נשאר פתוח.
      if (emailChanged) {
        await requestEmailChange(user, password, email);
        onEmailRequested(email.trim());
      }
      const unchanged =
        firstName.trim() === profile.firstName &&
        lastName.trim() === profile.lastName;
      if (!unchanged) {
        saveProfile(user.uid, { firstName, lastName, businessName: profile.businessName, accountMode: profile.accountMode }).catch(() =>
          reportFailure('לא הצלחנו לסנכרן את פרטי החשבון. יש לנסות שוב.'),
        );
      }
      onClose();
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  };

  return (
    <Modal title="עדכון פרטים" onClose={busy ? () => undefined : onClose}>
      <form className="settings-form" onSubmit={onSubmit} noValidate>
        <Field label="שם פרטי" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
        <Field label="שם משפחה" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        <Field label="כתובת מייל" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        {emailChanged && (
          <Field
            label="סיסמה נוכחית (נדרשת להחלפת מייל)"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="נשלח קישור אימות לכתובת החדשה. הכתובת חייבת להיות פנויה: כתובת שכבר רשומה בחשבון אחר באפליקציה לא תקבל מייל."
          />
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'שומר…' : 'אישור'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
          ביטול
        </button>
      </form>
    </Modal>
  );
}
