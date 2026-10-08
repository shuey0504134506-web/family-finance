import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';

/** מסך פתיחה: מופיע בכניסה הראשונה ממכשיר חדש. */
export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <main className="auth-screen welcome-screen">
      <div className="auth-column">
        <header className="welcome-hero">
          <div className="welcome-logo" aria-hidden="true">
            <Icon name="currency" size="1.6em" />
          </div>
          <h1>ניהול כספים לעסק ולמשק הבית</h1>
          <p className="muted">הכול במקום אחד, כל חלק בנפרד וברור.</p>
        </header>

        <div className="welcome-bottom">
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
      </div>
    </main>
  );
}
