/**
 * יציאה מכוונת מהאפליקציה לרגע (בחירת קובץ, חיוג, מייל, בקשת הרשאה של המערכת) אינה "עזיבה":
 * בזמן הזה נעילה אוטומטית של האפליקציה לא תופעל, כדי שהמשתמש לא יידרש להקליד קוד
 * רק בגלל שהוא פתח חלון של המערכת וחזר.
 */
let until = 0;

export const SUPPRESS_DEFAULT_MS = 2 * 60_000;

export function suppressLock(ms: number = SUPPRESS_DEFAULT_MS, now: number = Date.now()): void {
  until = Math.max(until, now + ms);
}

export function isLockSuppressed(now: number = Date.now()): boolean {
  return now < until;
}

/** לבדיקות בלבד. */
export function resetLockSuppress(): void {
  until = 0;
}

/**
 * חשבון שנוצר בהפעלה הנוכחית של האפליקציה: אין צורך להקליד קוד מיד אחריה, גם אם
 * ההרשמה והמסך "החשבון נוצר" לקחו יותר מכמה שניות. נמחק ביציאה מהחשבון.
 */
let newAccountUid: string | null = null;
export const markNewAccount = (uid: string): void => {
  newAccountUid = uid;
};
export const isNewAccount = (uid: string): boolean => newAccountUid === uid;
export const clearNewAccount = (): void => {
  newAccountUid = null;
};
