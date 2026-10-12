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
  signIn = null;
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
  lockSession = null;
  signIn = null;
};

/**
 * כניסה או הרשמה שהמשתמש ביצע בהפעלה הנוכחית (הקליד סיסמה זה עתה). נשמר בזיכרון בלבד, בלי תלות
 * בשעון של השרת או של המכשיר. מונע נעילה מיידית אחרי הכניסה (טעינה איטית, "שמירת סיסמה" של
 * המערכת וכד'). בהפעלה חדשה של האפליקציה הוא נמחק, והנעילה חלה כרגיל.
 */
let signIn: { uid: string; at: number } | null = null;
export const markSignedIn = (uid: string, now: number = Date.now()): void => {
  signIn = { uid, at: now };
};
export const signedInThisRun = (uid: string): boolean => signIn !== null && signIn.uid === uid;
/** כניסה לפני זמן קצר: חלונות מערכת שנפתחים מיד אחריה (שמירת סיסמה) לא ייחשבו עזיבה. */
export const SIGN_IN_GRACE_MS = 3 * 60_000;
export const signedInRecently = (uid: string, now: number = Date.now()): boolean =>
  signIn !== null && signIn.uid === uid && now - signIn.at < SIGN_IN_GRACE_MS;

/**
 * מצב הנעילה בהפעלה הנוכחית. מסכים כמו מדיניות הפרטיות נמצאים מחוץ לעץ המסכים המחוברים,
 * ולכן הכניסה אליהם והיציאה מהם מפרקת ובונה מחדש את רכיב הנעילה. בלי זיכרון כאן, הבנייה מחדש
 * נחשבת "הפעלה" ונועלת. הזיכרון נמחק ביציאה מהחשבון.
 */
let lockSession: { uid: string; locked: boolean } | null = null;
export const rememberLockState = (uid: string, locked: boolean): void => {
  lockSession = { uid, locked };
};
export const rememberedLockState = (uid: string): boolean | null =>
  lockSession && lockSession.uid === uid ? lockSession.locked : null;
