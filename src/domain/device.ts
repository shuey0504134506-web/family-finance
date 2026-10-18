/** זיהוי סוג המכשיר לדף הנחיתה של האתר: קובע אילו אפשרויות הורדה מוצגות. */
export type DeviceKind = 'ios' | 'mac' | 'android' | 'windows' | 'other';

export interface DeviceEnv {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

export function detectDevice(env: DeviceEnv): DeviceKind {
  const ua = env.userAgent;
  const touch = env.maxTouchPoints ?? 0;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPad חדש מציג את עצמו כ-Mac אבל עם מגע
  if (/Macintosh|Mac OS X/i.test(ua)) return touch > 1 ? 'ios' : 'mac';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  return 'other';
}

/** האם המכשיר הוא טלפון או טאבלט (מגדיר אילו צילומי מסך להציג). */
export function isMobileKind(kind: DeviceKind): boolean {
  return kind === 'ios' || kind === 'android';
}

/** אפשרויות ההורדה של קובץ התקנה: רק בחלונות (תוכנה) ובאנדרואיד (APK). */
export function installerFor(kind: DeviceKind): 'windows' | 'android' | null {
  return kind === 'windows' ? 'windows' : kind === 'android' ? 'android' : null;
}
