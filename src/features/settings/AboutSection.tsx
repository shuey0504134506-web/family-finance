import { useEffect, useState } from 'react';
import { APP_NAME, PRIVACY_CONTACT_EMAIL, PRIVACY_CONTACT_PHONE } from '../../config/appInfo';
import { findUpdate, installed, type UpdateInfo } from '../../native/appUpdate';
import { UpdateStatus, useUpdateRunner } from '../../native/UpdatePrompt';
import { ContactAdmin } from '../privacy/ContactAdmin';

type Check = 'idle' | 'checking' | 'latest' | 'found' | 'failed';

/** אודות: הסבר על האפליקציה, יצירת קשר ובדיקת גרסה חדשה עם הורדה והתקנה ישירה. */
export function AboutSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [kind, setKind] = useState<'android' | 'windows' | null>(null);
  const [check, setCheck] = useState<Check>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [contact, setContact] = useState(false);
  const { state, percent, run } = useUpdateRunner(info);
  // בגרסת הטלפון הלא מקוונת ובתוכנה אין חיבור לשרת ההודעות
  const canMessage = !window.desktopUpdate && import.meta.env.VITE_TARGET !== 'phone';

  useEffect(() => {
    void installed().then((i) => {
      setVersion(i?.version ?? null);
      setKind(i?.kind ?? null);
    });
  }, []);

  const checkNow = async () => {
    setCheck('checking');
    setInfo(null);
    try {
      if (!kind) {
        // באתר: בודקים אם יש גרסה חדשה של האתר ומרעננים אליה
        const reg = await navigator.serviceWorker?.getRegistration();
        await reg?.update();
        setCheck('latest');
        return;
      }
      const found = await findUpdate();
      setInfo(found);
      setCheck(found ? 'found' : 'latest');
    } catch {
      setCheck('failed');
    }
  };

  return (
    <div className="stack">
      <p>
        {APP_NAME} היא אפליקציה לניהול הכנסות והוצאות של העסק ושל משק הבית, במקום אחד. מוסיפים הכנסה או הוצאה בכמה לחיצות,
        עוקבים אחרי תקציב, חובות, מעשרות והוראות קבע, ורואים בכל רגע כמה נכנס, כמה יצא וכמה נשאר.
      </p>
      <ul className="about-list">
        <li>ייבוא תנועות מקובץ של הבנק או חברת האשראי, בלי הקלדה.</li>
        <li>עבודה בעברית ובאנגלית, ובכמה מטבעות.</li>
        <li>נעילה בקוד, בתבנית או בסיסמה, וגיבוי ושחזור של הנתונים.</li>
        <li>זמינה באתר, באפליקציה לאנדרואיד ובתוכנה למחשב.</li>
      </ul>
      <p className="muted small" dir="auto">
        {version ? `גרסה ${version}` : 'גרסת האתר מתעדכנת אוטומטית'}
      </p>

      <button type="button" className="btn btn-secondary" onClick={() => setContact((v) => !v)} aria-expanded={contact}>
        יצירת קשר
      </button>
      {contact ? (
        <div className="stack" role="region" aria-label="יצירת קשר">
          <p>
            טלפון: <a href={`tel:${PRIVACY_CONTACT_PHONE}`} dir="ltr">{PRIVACY_CONTACT_PHONE}</a>
          </p>
          <p>
            מייל: <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} dir="ltr">{PRIVACY_CONTACT_EMAIL}</a>
          </p>
          {canMessage ? <ContactAdmin /> : null}
        </div>
      ) : null}

      <button type="button" className="btn btn-primary" disabled={check === 'checking' || state === 'busy'} onClick={() => void checkNow()}>
        {check === 'checking' ? 'בודק…' : 'בדיקת גרסאות חדשות'}
      </button>
      {check === 'latest' ? <p role="status">{kind ? 'הגרסה שלך היא העדכנית ביותר.' : 'האתר מעודכן. אם יצאה גרסה חדשה היא תיטען לבד.'}</p> : null}
      {check === 'failed' ? <p className="form-error" role="alert">לא הצלחנו לבדוק. יש לבדוק חיבור לאינטרנט ולנסות שוב.</p> : null}
      {check === 'found' && info ? (
        <div className="stack" role="status">
          <p>יצאה גרסה חדשה: <span dir="ltr">{info.current} → {info.version}</span></p>
          <UpdateStatus state={state} percent={percent} />
          <button type="button" className="btn btn-primary" disabled={state === 'busy'} onClick={() => void run()}>
            עדכון עכשיו
          </button>
        </div>
      ) : null}
    </div>
  );
}
