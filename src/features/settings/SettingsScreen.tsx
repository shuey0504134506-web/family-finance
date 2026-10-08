import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { APP_NAME, APP_VERSION } from '../../config/appInfo';
import { describeError } from '../../services/authErrors';
import { useReadyAuth, useAuth } from '../auth/AuthContext';
import { DataSection } from './DataSection';
import { AccordionItem } from './Accordion';
import { ChevronLeft } from '../../components/icons';
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
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

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
        <div className="acc-list">
          <AccordionItem id="account" title="החשבון שלי" open={openId === 'account'} onToggle={toggle}>
            <dl className="details">
              <div>
                <dt>כתובת מייל</dt>
                <dd dir="ltr">{user.email}</dd>
              </div>
            </dl>
          </AccordionItem>

          <AccordionItem id="profile" title="פרטים ושימוש" open={openId === 'profile'} onToggle={toggle}>
            <ProfileSection />
          </AccordionItem>

          <AccordionItem id="formulas" title="מעשרות וחישובים" open={openId === 'formulas'} onToggle={toggle}>
            <FormulasSection />
          </AccordionItem>

          <Link className="acc-trigger acc-link" to="/categories">
            <span>קטגוריות</span>
            <span className="acc-chevron" aria-hidden="true">
              <ChevronLeft />
            </span>
          </Link>

          <AccordionItem id="security" title="אבטחה" open={openId === 'security'} onToggle={toggle}>
            <SecuritySection />
          </AccordionItem>

          <AccordionItem id="data" title="גיבוי ויצוא" open={openId === 'data'} onToggle={toggle}>
            <DataSection />
          </AccordionItem>

          <AccordionItem id="delete" title="מחיקת חשבון" open={openId === 'delete'} onToggle={toggle} danger>
            <DeleteAccountSection />
          </AccordionItem>
        </div>

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
