import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { applyUpdate, findUpdate, type UpdateInfo } from './appUpdate';

/** חלון קופץ שמציע לעדכן כשיצאה גרסה חדשה של האפליקציה (אנדרואיד) או התוכנה (Windows). */
export function UpdatePrompt() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');

  useEffect(() => {
    let alive = true;
    // מעט אחרי הפתיחה, כדי לא להתחרות בטעינת המסך
    const t = window.setTimeout(() => {
      void findUpdate().then((u) => alive && setInfo(u));
    }, 1500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  if (!info) return null;
  const windows = info.kind === 'windows';

  const update = async () => {
    setState('busy');
    try {
      await applyUpdate(info);
      setState('idle');
      if (!windows) setInfo(null);
    } catch {
      setState('failed');
    }
  };

  return (
    <Modal title="גרסה חדשה זמינה" onClose={() => setInfo(null)}>
      <div className="stack">
        <p>{windows ? 'יצאה גרסה חדשה של התוכנה.' : 'יצאה גרסה חדשה של האפליקציה.'}</p>
        <p className="muted small" dir="ltr">
          {info.current} → {info.version}
        </p>
        <p className="muted small">
          {windows
            ? 'התוכנה תוריד את העדכון, תיסגר ותפתח את ההתקנה. הנתונים שלך נשמרים.'
            : 'ההורדה נפתחת בדפדפן. בסיום מקישים על הקובץ שהורד כדי להתקין, והנתונים שלך נשמרים.'}
        </p>
        {state === 'busy' && windows ? <p role="status">מוריד את העדכון…</p> : null}
        {state === 'failed' ? (
          <p className="form-error" role="alert">
            העדכון נכשל. אפשר לנסות שוב, או להוריד את הגרסה החדשה ממסך האתר.
          </p>
        ) : null}
        <button type="button" className="btn btn-primary" disabled={state === 'busy'} onClick={() => void update()}>
          עדכון עכשיו
        </button>
        <button type="button" className="btn btn-secondary" disabled={state === 'busy'} onClick={() => setInfo(null)}>
          אחר כך
        </button>
      </div>
    </Modal>
  );
}
