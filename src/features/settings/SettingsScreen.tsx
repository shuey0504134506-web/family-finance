import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { APP_NAME, APP_VERSION } from '../../config/appInfo';
import { ACCOUNT_MODE_LABELS } from '../../domain/types';
import { describeError } from '../../services/authErrors';
import { useReadyAuth, useAuth } from '../auth/AuthContext';

/**
 * מסך הגדרות. בשלב הזה: פרטי החשבון ויציאה.
 * שאר ההגדרות (סיסמה, קטגוריות, מעשרות, תקציב, ייצוא, מחיקת חשבון) יתווספו בשלב 13.
 */
export function SettingsScreen() {
  const { profile, user } = useReadyAuth();
  const { signOutUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSignOut() {
    setBusy(true);
    setError('');
    try {
      await signOutUser();
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <ScreenHeader title="הגדרות" />
      <main className="content">
        <section className="card" aria-labelledby="account-title">
          <h2 id="account-title" className="card-title">
            החשבון שלי
          </h2>
          <dl className="details">
            <div>
              <dt>שם</dt>
              <dd>
                {profile.firstName} {profile.lastName}
              </dd>
            </div>
            <div>
              <dt>כתובת מייל</dt>
              <dd dir="ltr">{user.email}</dd>
            </div>
            <div>
              <dt>שם העסק</dt>
              <dd>{profile.businessName}</dd>
            </div>
            <div>
              <dt>ייעוד האפליקציה</dt>
              <dd>{ACCOUNT_MODE_LABELS[profile.accountMode]}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onSignOut}>
            {busy ? 'יוצא…' : 'יציאה מהחשבון'}
          </button>
        </section>

        <p className="auth-footer-link">
          <Link to="/privacy">מדיניות פרטיות</Link>
        </p>
        <p className="muted center-text">
          {APP_NAME} · גרסה {APP_VERSION}
        </p>
      </main>
    </div>
  );
}
