import { useEffect, useState } from 'react';
import { usePrivacyLabel } from '../privacy/privacyLabel';
import { Link } from 'react-router-dom';
import { isAdminEmail } from '../../config/admin';
import { loadPendingCount, subscribeApprovalRequired } from '../../services/adminService';
import { useReadyAuth } from '../auth/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { APP_NAME, APP_VERSION } from '../../config/appInfo';
import { SectionItem, useOpenSection } from './SectionPages';
import { AboutSection } from './AboutSection';
import { AccountSection } from './AccountSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { FormDefaultsSection } from './FormDefaultsSection';
import { LanguageCurrencySection } from './LanguageCurrencySection';
import { LockSection } from './LockSection';
import { ManageSection } from './ManageSection';
import { PurposeSection } from './PurposeSection';
import { PasswordForm } from './SecuritySection';

/**
 * מסך הגדרות: רשימת אפשרויות, ולכל אפשרות מסך משלה.
 * פרטי חשבון, ייעוד האפליקציה, ניהול האפליקציה, אבטחה, ובסוף מחיקת חשבון.
 */
export function SettingsScreen() {
  const privacyLabel = usePrivacyLabel();
  const { user } = useReadyAuth();
  const [pending, setPending] = useState(0);
  const [unanswered, setUnanswered] = useState(0);
  const [newAccounts, setNewAccounts] = useState(0);
  const isAdmin = isAdminEmail(user.email);
  // כשדרישת האישור כבויה, אין "ממתינים לאישור": חשבונות חדשים נכנסים רגיל
  const [approvalRequired, setApprovalRequired] = useState<boolean | null>(null);
  useEffect(() => (isAdmin ? subscribeApprovalRequired(setApprovalRequired) : undefined), [isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    loadPendingCount()
      .then((r) => {
        setPending(r.pending);
        setUnanswered(r.unanswered);
        setNewAccounts(r.newAccounts ?? 0);
      })
      .catch(() => {
        setPending(0);
        setUnanswered(0);
        setNewAccounts(0);
      });
  }, [isAdmin]);
  const [openSection] = useOpenSection();

  return (
    <div className="app-shell">
      <ScreenHeader title="הגדרות" />
      <main className="content">
        <div className="acc-list">
          <SectionItem id="account" title="פרטי חשבון">
            <AccountSection />
          </SectionItem>

          <SectionItem id="mode" title="ייעוד האפליקציה">
            <PurposeSection />
          </SectionItem>

          <SectionItem id="defaults" title="ברירות מחדל להוספה">
            <FormDefaultsSection />
          </SectionItem>

          <SectionItem id="lang" title="שפה ומטבע">
            <LanguageCurrencySection />
          </SectionItem>

          <SectionItem id="manage" title="ניהול האפליקציה">
            <ManageSection />
          </SectionItem>

          <SectionItem id="security" title="אבטחה">
            <div className="stack">
              <h3 className="subhead">נעילת האפליקציה</h3>
              <LockSection />
              <hr className="divider" />
              <PasswordForm />
            </div>
          </SectionItem>

          <SectionItem id="about" title="אודות">
            <AboutSection />
          </SectionItem>

          <SectionItem id="delete" title="מחיקת חשבון">
            <DeleteAccountSection />
          </SectionItem>
        </div>

        {isAdminEmail(user.email) && openSection === null ? (
          <Link to="/admin" className="btn btn-secondary btn-borderless">
            {['ניהול מתקדם (מנהל)', pending > 0 && approvalRequired === true ? `${pending} ממתינים לאישור` : '', unanswered > 0 ? `${unanswered} הודעות ללא מענה` : '',
              newAccounts > 0 ? `${newAccounts} חשבונות חדשים` : '']
              .filter(Boolean)
              .join(' · ')}
          </Link>
        ) : null}

        {openSection === null ? (
        <>
        <p className="auth-footer-link">
          <Link to="/privacy">{privacyLabel}</Link> · <Link to="/accessibility">הצהרת נגישות</Link>
        </p>
        <p className="muted center-text">
          {APP_NAME} · גרסה {APP_VERSION}
        </p>
        </>
        ) : null}
      </main>
    </div>
  );
}
