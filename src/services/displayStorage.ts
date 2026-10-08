import { parseDisplayPrefs, type DisplayPrefs } from '../domain/display';

const key = (uid: string) => `ff.display.v1.${uid}`;

/** מה מוצג במכשיר הזה. נשמר מקומית בלבד, בכל מכשיר בנפרד. */
export function readDisplayPrefs(uid: string): DisplayPrefs | null {
  try {
    return parseDisplayPrefs(localStorage.getItem(key(uid)));
  } catch {
    return null;
  }
}

export function writeDisplayPrefs(uid: string, prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(key(uid), JSON.stringify(prefs));
  } catch {
    // אחסון חסום: ההעדפות יחזרו לברירת המחדל בפעם הבאה, ואין נזק לנתונים.
  }
}

export function clearDisplayPrefs(uid: string): void {
  try {
    localStorage.removeItem(key(uid));
  } catch {
    // ללא פעולה
  }
}
