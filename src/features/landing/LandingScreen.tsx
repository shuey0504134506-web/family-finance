import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { autoDetectLang, changeLang, getLang } from '../../i18n/lang';
import { ChevronLeft, ChevronRight } from '../../components/icons';
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
  { id: 'standing', title: 'הוראות הקבע שלי', text: 'הוצאות והכנסות שחוזרות כל חודש נרשמות מעצמן, והמערכת מציעה לזהות פעולות קבועות שעוד לא סומנו.' },
  { id: 'search', title: 'חיפוש מהיר', text: 'מוצאים כל פעולה לפי שם, קטגוריה, הערה, סכום או תאריך, עם סינון להכנסות או להוצאות.' },
  { id: 'import', title: 'ייבוא נתונים מהבנק', text: 'מעלים קובץ תנועות מהבנק או מחברת האשראי, והאפליקציה מזהה את מבנה הקובץ ומסווגת את הקטגוריות.' },
  { id: 'tasks', title: 'רשימת משימות', text: 'משימות עם תזכורת אופציונלית שקופצת בכניסה לאפליקציה, ומסמנים "בוצע" בלחיצה.' },
  { id: 'shopping', title: 'רשימת קניות', text: 'רשימת פריטים לקנייה, ומסמנים "נקנה" תוך כדי הקנייה.' },
];

const ABOUT =
  'פלטפורמת ניהול כספים שנועדה לעזור למשפחה לשמור על סדר כלכלי: לרשום את כל ההוצאות וההכנסות, לראות בכל רגע כמה נכנס, כמה יצא וכמה נשאר, ולהבין לאן הולך הכסף. אפשר להוסיף גם עסק ולנהל אותו בנפרד ממשק הבית. בפנים כל מה שצריך: מעשרות שמחושבים אוטומטית, הוראות קבע, תקציב לכל קטגוריה, סיכומים והשוואות, חובות, ייבוא נתונים מהבנק, רשימת משימות ורשימת קניות וחיפוש מהיר. הכול בקלות ובלי מאמץ.';


/** קרוסלה של שקופיות זזות: גלילה במגע, חצים, נקודות והחלפה אוטומטית שנעצרת במגע או ריחוף. */
function Slides({ set, base }: { set: 'phone' | 'desktop'; base: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SHOTS.length;

  const go = useCallback((i: number) => {
    const el = track.current?.children[(i + n) % n] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [n]);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Array.from(t.children).indexOf(e.target));
        }
      },
      { root: t, threshold: [0.6] },
    );
    Array.from(t.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => go(active + 1), 5200);
    return () => window.clearInterval(id);
  }, [paused, active, go]);

  return (
    <section
      className={`slides slides-${set}`}
      aria-roledescription="carousel"
      aria-label="הצצה לתוכנה"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocus={() => setPaused(true)}
    >
      <div className="slides-track" ref={track} tabIndex={0}>
        {SHOTS.map((s, i) => (
          <figure key={s.id} className="slide" aria-roledescription="slide" aria-label={`${i + 1} / ${n}`}>
            <div className="slide-box">
            <div className={`slide-frame slide-frame-${set}`}>
              <img
                src={`${base}landing/${set}/${s.id}.webp`}
                alt={s.title}
                loading={i === 0 ? 'eager' : 'lazy'}
                width={set === 'phone' ? 390 : 1280}
                height={set === 'phone' ? 844 : 800}
                draggable={false}
              />
            </div>
            </div>
            <figcaption>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="slides-nav">
        <button type="button" className="slides-arrow" aria-label="הקודם" onClick={() => go(active - 1)}>
          <ChevronRight />
        </button>
        <div className="slides-dots">
          {SHOTS.map((s, i) => (
            <button key={s.id} type="button" className={i === active ? 'is-active' : ''} aria-label={s.title} aria-current={i === active} onClick={() => go(i)} />
          ))}
        </div>
        <button type="button" className="slides-arrow" aria-label="הבא" onClick={() => go(active + 1)}>
          <ChevronLeft />
        </button>
      </div>
    </section>
  );
}

/** דף הנחיתה של האתר: הסבר, כניסה, התקנה ושקופיות. מותאם כך שהכול נכנס למסך אחד בלי גלילה. */
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

  const lang = getLang();
  useEffect(() => {
    autoDetectLang();
  }, []);

  const [promptReady, setPromptReady] = useState(canPromptInstall());
  const [showHow, setShowHow] = useState(false);
  const [tour, setTour] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTour(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour]);
  useEffect(() => {
    if (wide) setTour(false);
  }, [wide]);

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
  const note = installed
    ? 'ההתקנה הושלמה. אפשר לפתוח מהמסך הראשי או מתפריט היישומים.'
    : showHow
      ? kind === 'ios'
        ? 'באייפון ובאייפד: לוחצים על כפתור השיתוף בדפדפן Safari ובוחרים "הוספה למסך הבית".'
        : kind === 'mac'
          ? 'במק: ב-Safari בוחרים "קובץ" ואז "הוספה ל-Dock". ב-Chrome לוחצים על סמל ההתקנה בשורת הכתובת.'
          : 'בדפדפן: לוחצים על סמל ההתקנה בשורת הכתובת, או בתפריט הדפדפן בוחרים "התקנת אפליקציה".'
      : null;

  return (
    <main className="landing">
      <header className="landing-bar">
        <div className="landing-brand">
          <img src={`${base}icon-192.png`} alt="" width={40} height={40} draggable={false} />
          <h1>ניהול כספים</h1>
        </div>
        <button
          type="button"
          className="landing-lang"
          lang={lang === 'he' ? 'en' : 'he'}
          aria-label={lang === 'he' ? 'English' : 'עברית'}
          onClick={() => changeLang(lang === 'he' ? 'en' : 'he')}
        >
          {lang === 'he' ? 'English' : 'עברית'}
        </button>
      </header>

      <div className="landing-body">
        <section className="landing-side" aria-label="כניסה והתקנה">
          <p className="landing-about">{ABOUT}</p>

          {wide ? (
            <p className="landing-seehint" aria-hidden="true">
              <span>כך זה נראה</span>
              <ChevronLeft />
            </p>
          ) : (
            <button type="button" className="btn btn-secondary landing-how" onClick={() => setTour(true)}>
              <span aria-hidden="true" className="landing-how-play">▶</span>
              <span>ראו איך זה נראה</span>
            </button>
          )}

          <div className="landing-actions">
            <button type="button" className="btn btn-primary" onClick={enter}>
              כניסה או יצירת חשבון
            </button>
            <button type="button" className="btn btn-secondary landing-recommended" onClick={() => void installWebApp()}>
              <span>{isMobileKind(kind) ? 'התקנת האפליקציה במכשיר' : 'התקנת האתר כתוכנה במחשב'}</span>
              <span className="landing-badge">מומלץ</span>
            </button>
            {installer && (
              <>
                <a className="btn btn-secondary landing-download" href={downloadHref} rel="noopener">
                  {installer === 'windows' ? 'הורדת התוכנה למחשב' : 'הורדת האפליקציה (APK)'}
                </a>
                <p className="landing-offline">מיועד למי שמעוניין בחשבון לא מקוון, שנשמר על המכשיר בלבד</p>
              </>
            )}
          </div>

          <p className="auth-footer-link">
            <Link to="/privacy">{privacyLabel}</Link> · <Link to="/accessibility">הצהרת נגישות</Link>
          </p>
        </section>

        {wide && (
          <section className="landing-stage" aria-label="הצצה לתוכנה">
            <Slides set={set} base={base} />
          </section>
        )}
      </div>

      {note && (
        <button type="button" className="landing-note" role="status" onClick={() => { setShowHow(false); setInstalled(false); }}>
          {note}
        </button>
      )}

      {tour && !wide && (
        <div className="landing-modal" role="dialog" aria-modal="true" aria-label="איך זה נראה">
          <div className="landing-modal-head">
            <h2>איך זה נראה</h2>
            <button type="button" className="landing-modal-close" aria-label="סגירה" onClick={() => setTour(false)}>
              ✕
            </button>
          </div>
          <Slides set={set} base={base} />
        </div>
      )}
    </main>
  );
}
