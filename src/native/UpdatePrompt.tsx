import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { applyUpdate, findUpdate, type UpdateInfo } from './appUpdate';

const SKIP_KEY = 'ff.update.skipped';

/** גרסה שהמשתמש דחה ("אחר כך"): לא מציגים שוב עד שתצא גרסה חדשה יותר. */
function skippedVersion(): string | null {
  try {
    return localStorage.getItem(SKIP_KEY);
  } catch {
    return null;
  }
}
function skipVersion(version: string): void {
  try {
    localStorage.setItem(SKIP_KEY, version);
  } catch {
    // אחסון חסום: החלון יוצג שוב בפתיחה הבאה
  }
}

/** חלון קופץ שמציע לעדכן כשיצאה גרסה חדשה של האפליקציה (אנדרואיד) או התוכנה (Windows). */
export function UpdatePrompt() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'failed' | 'permission'>('idle');
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    // מעט אחרי הפתיחה, כדי לא להתחרות בטעינת המסך
    const t = window.setTimeout(() => {
      void findUpdate().then((u) => alive && setInfo(u && u.version !== skippedVersion() ? u : null));
    }, 1500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  if (!info) return null;
  const windows = info.kind === 'windows';

  const later = () => {
    skipVersion(info.version);
    setInfo(null);
  };

  const update = async () => {
    setState('busy');
    try {
      const result = await applyUpdate(info, setPercent);
      setPercent(null);
      setState(result === 'needsPermission' ? 'permission' : 'idle');
    } catch {
      setState('failed');
    }
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
            : 'האפליקציה תוריד את העדכון ותפתח את מסך ההתקנה. מאשרים "התקנה", והנתונים שלך נשמרים.'}
        </p>
        {state === 'busy' ? (
          <p role="status">{percent === null ? 'מוריד את העדכון…' : `מוריד את העדכון… ${percent}%`}</p>
        ) : null}
        {state === 'permission' ? (
          <p role="status">
            בפעם הראשונה צריך לאשר לאפליקציה להתקין עדכונים: במסך שנפתח מדליקים את המתג וחוזרים לכאן, ואז לוחצים שוב "עדכון עכשיו".
          </p>
        ) : null}
        {state === 'failed' ? (
          <p className="form-error" role="alert">
            העדכון נכשל. אפשר לנסות שוב, או להוריד את הגרסה החדשה ממסך האתר.
          </p>
        ) : null}
        <button type="button" className="btn btn-primary" disabled={state === 'busy'} onClick={() => void update()}>
          עדכון עכשיו
        </button>
        <button type="button" className="btn btn-secondary" disabled={state === 'busy'} onClick={later}>
          אחר כך
        </button>
      </div>
    </Modal>
  );
}
