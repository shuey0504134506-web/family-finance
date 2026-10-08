import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { APP_NAME, APP_VERSION } from '../../config/appInfo';
import { AccordionItem } from './Accordion';
import { AccountSection } from './AccountSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { LanguageCurrencySection } from './LanguageCurrencySection';
import { LockSection } from './LockSection';
import { ManageSection } from './ManageSection';
import { PurposeSection } from './PurposeSection';
import { PasswordForm } from './SecuritySection';

/**
 * מסך הגדרות: רשימת כותרות מתקפלות.
 * פרטי חשבון, ייעוד האפליקציה, ניהול האפליקציה, אבטחה, ובסוף מחיקת חשבון.
 */
export function SettingsScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  return (
    <div className="app-shell">
      <ScreenHeader title="הגדרות" />
      <main className="content">
        <div className="acc-list">
          <AccordionItem id="account" title="פרטי חשבון" open={openId === 'account'} onToggle={toggle}>
            <AccountSection />
          </AccordionItem>

          <AccordionItem id="mode" title="ייעוד האפליקציה" open={openId === 'mode'} onToggle={toggle}>
            <PurposeSection />
          </AccordionItem>

          <AccordionItem id="lang" title="שפה ומטבע" open={openId === 'lang'} onToggle={toggle}>
            <LanguageCurrencySection />
          </AccordionItem>

          <AccordionItem id="manage" title="ניהול האפליקציה" open={openId === 'manage'} onToggle={toggle}>
            <ManageSection />
          </AccordionItem>

          <AccordionItem id="security" title="אבטחה" open={openId === 'security'} onToggle={toggle}>
            <div className="stack">
              <h3 className="subhead">נעילת האפליקציה</h3>
              <LockSection />
              <hr className="divider" />
              <PasswordForm />
            </div>
          </AccordionItem>

          <AccordionItem id="delete" title="מחיקת חשבון" open={openId === 'delete'} onToggle={toggle}>
            <DeleteAccountSection />
          </AccordionItem>
        </div>

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
