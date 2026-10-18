import { LangSwitch } from '../../components/LangSwitch';
import { usePrivacyLabel } from '../privacy/privacyLabel';
import { Link, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Icon } from '../../components/Icon';

/** מסך פתיחה: מופיע בכניסה הראשונה ממכשיר חדש. */
export function WelcomeScreen() {
  const privacyLabel = usePrivacyLabel();
  const navigate = useNavigate();

  return (
    <main className="auth-screen welcome-screen">
      <div className="auth-column">
        <LangSwitch />
        <header className="welcome-hero">
          <div className="welcome-logo" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={88} height={88} draggable={false} />
          </div>
          <h1>ניהול כספים לעסק ולמשק הבית</h1>
          <p className="muted">הכול במקום אחד, כל חלק בנפרד וברור.</p>
        </header>

        <ul className="feature-list welcome-features">
          <li>
            <span className="feature-icon" aria-hidden="true"><Icon name="business" /></span>
            <span>עסק ומשק בית, כל אחד בנפרד וברור</span>
          </li>
          <li>
            <span className="feature-icon" aria-hidden="true"><Icon name="budget" /></span>
            <span>תקציב חודשי ושנתי עם מעקב</span>
          </li>
          <li>
            <span className="feature-icon" aria-hidden="true"><Icon name="tithe" /></span>
            <span>מעשרות וחישובים אוטומטיים</span>
          </li>
          <li>
            <span className="feature-icon" aria-hidden="true"><Icon name="sync" /></span>
            <span>סנכרון בין מכשירים וגיבוי אוטומטי</span>
          </li>
        </ul>

        <div className="welcome-bottom">
          <div className="auth-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/signup')}>
              יצירת חשבון
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/login')}>
              כניסה לחשבון קיים
            </button>
            {Capacitor.isNativePlatform() && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.location.assign(`${import.meta.env.BASE_URL}offline/index.html`)}
              >
                חשבון לא מקוון (נשמר על הטלפון בלבד)
              </button>
            )}
          </div>

          <p className="auth-footer-link">
            <Link to="/privacy">{privacyLabel}</Link> · <Link to="/accessibility">הצהרת נגישות</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
