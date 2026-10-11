import { doc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

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
  setDoc(
    doc(db, 'usage', uid),
    { days: { [localDay()]: increment(1) }, updatedAt: Date.now() },
    { merge: true },
  ).catch(() => {
    // כללים ישנים או בלי חיבור: לא קריטי
  });
}
