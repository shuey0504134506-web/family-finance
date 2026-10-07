import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { APP_NAME, APP_VERSION } from '../../config/appInfo';
import { describeError } from '../../services/authErrors';
import { useReadyAuth, useAuth } from '../auth/AuthContext';
import { DataSection } from './DataSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { FormulasSection } from './FormulasSection';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';

/** מסך הגדרות: חשבון, קטגוריות, חישובים, אבטחה, גיבוי, יציאה ומחיקת חשבון. */
export function SettingsScreen() {
  const { user } = useReadyAuth();
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
              <dt>כתובת מייל</dt>
              <dd dir="ltr">{user.email}</dd>
            </div>
          </dl>
        </section>

        <ProfileSection />
        <FormulasSection />

        <section className="card">
          <h2 className="card-title">ניהול</h2>
          <Link className="btn btn-secondary" to="/categories">
            קטגוריות
          </Link>
        </section>

        <SecuritySection />
        <DataSection />

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

        <DeleteAccountSection />

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
