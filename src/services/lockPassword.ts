import { hashSecret, patchLockConfig } from './appLockStorage';

/**
 * שומר במכשיר גיבוב של הסיסמה שהוקלדה זה עתה, כדי שנעילת האפליקציה בסיסמה תעבוד גם בלי אינטרנט.
 * נכשל בשקט: אם אי אפשר לשמור, פתיחת הנעילה תאמת מול השרת.
 */
export function rememberPasswordForLock(uid: string, password: string): void {
  hashSecret(password)
    .then((hash) => patchLockConfig(uid, (c) => ({ ...c, password: hash })))
    .catch(() => undefined);
}
