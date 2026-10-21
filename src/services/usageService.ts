import { doc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { installed } from '../native/appUpdate';

/**
 * ספירת פתיחות האפליקציה ליום, לסטטיסטיקה כללית של המנהל (מספרים בלבד, בלי תוכן).
 * נספרת פעם אחת בכל טעינה של האפליקציה. כישלון לא משפיע על השימוש.
 */
export function localDay(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const SESSION_KEY = 'ff.usage.counted';

export function recordAppOpen(uid: string): void {
  try {
    if (sessionStorage.getItem(SESSION_KEY) === uid) return;
    sessionStorage.setItem(SESSION_KEY, uid);
  } catch {
    // אחסון חסום: נספור בכל טעינה
  }
  void write(uid);
}

/**
 * הפתיחה נרשמת יחד עם הפלטפורמה והגרסה (android / windows / web), לסטטיסטיקה של המנהל.
 * הסימון נשמר בתוך days כמפתח "@פלטפורמה@גרסה" עם זמן הפתיחה, כדי לא לשנות את כללי Firestore.
 */
async function write(uid: string): Promise<void> {
  const now = Date.now();
  const days: Record<string, unknown> = { [localDay()]: increment(1) };
  try {
    const app = await installed();
    days[`@${app ? app.kind : 'web'}@${app ? app.version : ''}`] = now;
  } catch {
    // בלי סימון פלטפורמה: הפתיחה עדיין נספרת
  }
  setDoc(doc(db, 'usage', uid), { days, updatedAt: now }, { merge: true }).catch(() => {
    // כללים ישנים או בלי חיבור: לא קריטי
  });
}
