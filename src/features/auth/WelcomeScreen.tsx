import { Link, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';

const FEATURES: Array<[IconName, string]> = [
  ['business', 'ניהול הכנסות והוצאות של העסק'],
  ['household', 'ניהול הכנסות והוצאות של משק הבית'],
  ['sync', 'סנכרון חכם בין העסק למשק הבית, בלי ספירה כפולה'],
  ['calendar', 'סיכומים חודשיים ושנתיים'],
  ['chart', 'תמונת מצב פיננסית, גרפים והשוואות'],
  ['budget', 'תקציב לפי קטגוריות'],
  ['tithe', 'ניהול מעשרות מצטבר'],
  ['search', 'חיפוש בכל הנתונים'],
];

/** מסך פתיחה: מופיע בכניסה הראשונה ממכשיר חדש. */
export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <main className="auth-screen">
      <div className="auth-column">
        <header className="welcome-hero">
          <div className="welcome-logo" aria-hidden="true">
            <Icon name="currency" size="1.6em" />
          </div>
          <h1>ניהול כספים לעסק ולמשק הבית</h1>
          <p className="muted">הכול במקום אחד, כל חלק בנפרד וברור.</p>
        </header>

        <ul className="feature-list">
          {FEATURES.map(([icon, text]) => (
            <li key={text}>
              <span className="feature-icon" aria-hidden="true">
                <Icon name={icon} />
              </span>
              <span>{text}</span>
            </li>
          ))}
          <li>
            <span className="feature-icon" aria-hidden="true">
              <Icon name="sparkle" />
            </span>
            <span>ועוד יכולות בהמשך</span>
          </li>
        </ul>

        <div className="auth-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/signup')}>
            יצירת חשבון
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/login')}>
            כניסה לחשבון קיים
          </button>
        </div>

        <p className="auth-footer-link">
          <Link to="/privacy">מדיניות פרטיות</Link>
        </p>
      </div>
    </main>
  );
}
