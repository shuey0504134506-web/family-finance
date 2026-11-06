import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { applyUpdate, canInstallUpdates, findUpdate, installDownloaded, readyVersion, setReadyVersion, updatePending, type UpdateInfo } from './appUpdate';

const SKIP_KEY = 'ff.update.skipped.v2';
/** "אחר כך" משתיק את ההצעה לכמה שעות בלבד (ולא לתמיד), ואז היא חוזרת גם בלי לסגור את האפליקציה. */
const SKIP_MS = 6 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 30 * 60 * 1000;
const MIN_GAP_MS = 5 * 60 * 1000;

function skipped(version: string): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(SKIP_KEY) ?? 'null') as { version?: string; until?: number } | null;
    return raw?.version === version && typeof raw.until === 'number' && raw.until > Date.now();
  } catch {
    return false;
  }
}
function skipVersion(version: string): void {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify({ version, until: Date.now() + SKIP_MS }));
  } catch {
    // אחסון חסום: החלון יוצג שוב בפתיחה הבאה
  }
}

type RunnerState = 'idle' | 'busy' | 'failed' | 'permission' | 'ready';

/** הורדת העדכון והתקנתו, עם מצב והתקדמות. משותף לחלון הקופץ ולמסך אודות. */
export function useUpdateRunner(info: UpdateInfo | null) {
  const [state, setState] = useState<RunnerState>('idle');
  const [percent, setPercent] = useState<number | null>(null);
  const run = async () => {
    if (!info) return;
    setState('busy');
    try {
      // APK שכבר הורד (למשל כשהמשתמש עזב באמצע): רק מתקינים, בלי להוריד שוב
      const result = readyVersion() === info.version && info.kind === 'android' ? await installDownloaded(info, setPercent) : await applyUpdate(info, setPercent);
      setPercent(null);
      setState(result === 'needsPermission' ? 'permission' : result === 'ready' ? 'ready' : 'idle');
    } catch {
      setState('failed');
    }
  };
  // אחרי מסך ההרשאה: כשהמשתמש חוזר לאפליקציה (או שהיא נפתחת מחדש) וההרשאה אושרה, ההורדה וההתקנה ממשיכות לבד
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!info || info.kind !== 'android') return undefined;
    let alive = true;
    const resume = async () => {
      if (alive && updatePending() && (await canInstallUpdates())) void runRef.current();
    };
    void resume();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resume();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [info]);
  return { state, percent, run };
}

/** הודעות המצב של ההורדה (התקדמות, אישור הרשאה, כישלון). */
export function UpdateStatus({ state, percent }: { state: RunnerState; percent: number | null }) {
  return (
    <>
      {state === 'busy' ? <p role="status">{percent === null ? 'מוריד את העדכון…' : `מוריד את העדכון… ${percent}%`}</p> : null}
      {state === 'permission' ? (
        <p role="status">
          בפעם הראשונה צריך לאשר לאפליקציה להתקין עדכונים: במסך שנפתח מדליקים את המתג וחוזרים לכאן. ההורדה וההתקנה יתחילו לבד.
        </p>
      ) : null}
      {state === 'ready' ? (
        <p role="status">ההורדה הסתיימה. כשחוזרים לכאן לוחצים על "התקנה עכשיו" כדי לפתוח את מסך ההתקנה.</p>
      ) : null}
      {state === 'failed' ? (
        <p className="form-error" role="alert">
          העדכון נכשל. אפשר לנסות שוב, או להוריד את הגרסה החדשה ממסך האתר.
        </p>
      ) : null}
    </>
  );
}

/** חלון קופץ שמציע לעדכן כשיצאה גרסה חדשה של האפליקציה (אנדרואיד) או התוכנה (Windows). */
export function UpdatePrompt() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const { state, percent, run } = useUpdateRunner(info);
  const lastCheck = useRef(0);
  const busy = useRef(false);
  busy.current = state === 'busy';

  useEffect(() => {
    let alive = true;
    const check = (force = false) => {
      // לא בודקים שוב ושוב, ולא מחליפים את החלון כשההורדה רצה
      if (busy.current || (!force && Date.now() - lastCheck.current < MIN_GAP_MS)) return;
      lastCheck.current = Date.now();
      void findUpdate().then((u) => {
        if (!alive || busy.current) return;
        if (!u) {
          setReadyVersion(null);
          return;
        }
        // הורדה שהסתיימה ומחכה להתקנה מוצגת תמיד, גם אם המשתמש דחה את ההצעה קודם
        setInfo((cur) => (cur ? cur : readyVersion() === u.version || !skipped(u.version) ? u : null));
      });
    };
    // מעט אחרי הפתיחה, כדי לא להתחרות בטעינת המסך
    const first = window.setTimeout(() => check(true), 1500);
    // וגם בכל חזרה לאפליקציה וכל חצי שעה, לא רק בפתיחה מחדש
    const onVisible = () => {
      if (document.visibilityState === 'visible') check(readyVersion() !== null);
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => check(), CHECK_EVERY_MS);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!info) return null;
  const windows = info.kind === 'windows';
  const downloaded = !windows && readyVersion() === info.version;

  const later = () => {
    // בזמן הורדה לא סוגרים את החלון בטעות (לחיצה על הרקע או Back)
    if (state === 'busy') return;
    skipVersion(info.version);
    setInfo(null);
  };

  return (
    <Modal title="גרסה חדשה זמינה" onClose={later}>
      <div className="stack">
        <p>{windows ? 'יצאה גרסה חדשה של התוכנה.' : 'יצאה גרסה חדשה של האפליקציה.'}</p>
        <p className="muted small" dir="ltr">
          {info.current} → {info.version}
        </p>
        <p className="muted small">
          {windows
            ? 'התוכנה תוריד את העדכון, תיסגר ותפתח את ההתקנה. הנתונים שלך נשמרים.'
            : downloaded
              ? 'העדכון כבר הורד למכשיר. לחיצה על "התקנה עכשיו" פותחת את מסך ההתקנה, והנתונים שלך נשמרים.'
              : 'האפליקציה תוריד את העדכון ותפתח את מסך ההתקנה. מאשרים "התקנה", והנתונים שלך נשמרים.'}
        </p>
        <UpdateStatus state={state} percent={percent} />
        <button type="button" className="btn btn-primary" disabled={state === 'busy'} onClick={() => void run()}>
          {downloaded ? 'התקנה עכשיו' : 'עדכון עכשיו'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={state === 'busy'} onClick={later}>
          אחר כך
        </button>
      </div>
    </Modal>
  );
}
