import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LangSwitch } from '../../components/LangSwitch';
import { Icon } from '../../components/Icon';
import { usePrivacyLabel } from '../privacy/privacyLabel';
import { detectDevice, installerFor, isMobileKind } from '../../domain/device';
import { pickInstaller, RELEASES_API, RELEASES_PAGE, type ReleaseInfo } from '../../domain/releases';
import { canPromptInstall, onInstallPromptChange, promptInstall } from '../../native/installPrompt';
import { readDeviceUser } from '../../services/deviceUser';
import { useIsWide } from '../../hooks/useIsWide';

const SHOTS: Array<{ id: string; title: string; text: string }> = [
  { id: 'home', title: 'מסך הבית', text: 'מאזן החודש במבט אחד: כמה נכנס, כמה יצא וכמה נשאר, בלי חישובים. מכאן מוסיפים הכנסה או הוצאה בלחיצה.' },
  { id: 'expenses', title: 'רשימת ההוצאות', text: 'כל ההוצאות של החודש לפי תאריך, עם קטגוריה וסכום. לוחצים על פעולה כדי לערוך או למחוק.' },
  { id: 'budget', title: 'תקציב', text: 'קובעים תקציב לכל קטגוריה ורואים בזמן אמת כמה נוצל ממנו.' },
  { id: 'summary', title: 'סיכומים והשוואות', text: 'סיכום החודש והשנה והשוואה לתקופות קודמות, כדי להבין לאן הולך הכסף.' },
  { id: 'tithes', title: 'מעשרות', text: 'חישוב מעשרות אוטומטי לפי ההכנסות, עם מעקב אחרי מה ששולם ומה שנשאר.' },
];

/** דף הנחיתה של האתר: הסבר ויזואלי, כניסה, והתקנה לפי סוג המכשיר. */
export function LandingScreen() {
  const navigate = useNavigate();
  const privacyLabel = usePrivacyLabel();
  const wide = useIsWide();
  const kind = detectDevice({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  const installer = installerFor(kind);
  const set = isMobileKind(kind) || !wide ? 'phone' : 'desktop';
  const base = import.meta.env.BASE_URL;

  const [promptReady, setPromptReady] = useState(canPromptInstall());
  const [showHow, setShowHow] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => onInstallPromptChange(() => setPromptReady(canPromptInstall())), []);

  useEffect(() => {
    if (!installer) return;
    let alive = true;
    fetch(RELEASES_API)
      .then((r) => (r.ok ? (r.json() as Promise<ReleaseInfo[]>) : []))
      .then((list) => alive && setUrl(pickInstaller(list, installer)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [installer]);

  async function installWebApp() {
    if (promptReady) {
      const ok = await promptInstall();
      setInstalled(ok);
      setShowHow(false);
      return;
    }
    setShowHow(true);
  }

  const enter = () => navigate(readDeviceUser() ? '/login' : '/welcome');
  const downloadHref = url ?? RELEASES_PAGE;

  return (
    <main className="landing">
      <div className="landing-inner">
        <LangSwitch />
        <header className="landing-hero">
          <img src={`${base}icon-192.png`} alt="" width={84} height={84} draggable={false} />
          <h1>ניהול כספים לעסק ולמשק הבית</h1>
          <p className="muted">הכול במקום אחד, כל חלק בנפרד וברור.</p>
        </header>

        <section className="landing-actions" aria-label="כניסה והתקנה">
          <button type="button" className="btn btn-primary" onClick={enter}>
            כניסה או יצירת חשבון
          </button>

          <div className="landing-install">
            <button type="button" className="btn btn-secondary landing-recommended" onClick={() => void installWebApp()}>
              <span>{isMobileKind(kind) ? 'התקנת האפליקציה במכשיר' : 'התקנת האתר כתוכנה במחשב'}</span>
              <span className="landing-badge">מומלץ</span>
            </button>
            {installed && <p className="landing-note" role="status">ההתקנה הושלמה. אפשר לפתוח מהמסך הראשי או מתפריט היישומים.</p>}
            {showHow && !installed && (
              <p className="landing-note" role="status">
                {kind === 'ios'
                  ? 'באייפון ובאייפד: לוחצים על כפתור השיתוף בדפדפן Safari ובוחרים "הוספה למסך הבית".'
                  : kind === 'mac'
                    ? 'במק: ב-Safari בוחרים "קובץ" ואז "הוספה ל-Dock". ב-Chrome לוחצים על סמל ההתקנה בשורת הכתובת.'
                    : 'בדפדפן: לוחצים על סמל ההתקנה בשורת הכתובת, או בתפריט הדפדפן בוחרים "התקנת אפליקציה".'}
              </p>
            )}

            {installer && (
              <a className="btn btn-secondary landing-download" href={downloadHref} rel="noopener">
                <span>{installer === 'windows' ? 'הורדת התוכנה למחשב' : 'הורדת האפליקציה (APK)'}</span>
                <small>מיועד למי שמעוניין בחשבון לא מקוון, שנשמר על המכשיר בלבד</small>
              </a>
            )}
          </div>
        </section>

        <section className="landing-shots" aria-label="הצצה לתוכנה">
          <h2>ככה זה נראה</h2>
          {SHOTS.map((s) => (
            <figure key={s.id} className={`landing-shot landing-shot-${set}`}>
              <img
                src={`${base}landing/${set}/${s.id}.webp`}
                alt={s.title}
                loading="lazy"
                width={set === 'phone' ? 390 : 1280}
                height={set === 'phone' ? 844 : 800}
              />
              <figcaption>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </figcaption>
            </figure>
          ))}
        </section>

        <ul className="feature-list landing-points">
          <li><span className="feature-icon" aria-hidden="true"><Icon name="business" /></span><span>עסק ומשק בית, כל אחד בנפרד וברור</span></li>
          <li><span className="feature-icon" aria-hidden="true"><Icon name="sync" /></span><span>סנכרון בין מכשירים וגיבוי אוטומטי</span></li>
        </ul>

        <p className="auth-footer-link">
          <Link to="/privacy">{privacyLabel}</Link> · <Link to="/accessibility">הצהרת נגישות</Link>
        </p>
      </div>
    </main>
  );
}
