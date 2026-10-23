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

/** קישור שפותח אפליקציה או חלון אחר: טלפון, מייל, הודעה, מפות, או כל כתובת מחוץ לאפליקציה. */
export function isExternalLink(a: Pick<HTMLAnchorElement, 'getAttribute' | 'target'>, origin = ''): boolean {
  const href = (a.getAttribute('href') ?? '').trim().toLowerCase();
  if (!href || href.startsWith('#')) return a.target === '_blank';
  if (/^(tel|mailto|sms|whatsapp|geo|market|intent|content|file):/.test(href)) return true;
  if (a.target === '_blank') return true;
  return /^https?:\/\//.test(href) && !!origin && !href.startsWith(origin.toLowerCase());
}

let guardsInstalled = false;

/**
 * שכבת הגנה מרכזית: כל פעולה שמוציאה את המשתמש לרגע מהאפליקציה (בחירת קובץ, מצלמה, גלריה, שיתוף,
 * חלון חדש, קישור לטלפון או למייל) משתיקה את הנעילה האוטומטית, בלי שכל מסך יצטרך לזכור לעשות זאת.
 * מסך חדש שמוסיף שדה קובץ או קישור כזה מכוסה אוטומטית. נקרא פעם אחת בעליית האפליקציה.
 */
export function installLockGuards(): void {
  if (guardsInstalled || typeof document === 'undefined') return;
  guardsInstalled = true;
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t instanceof HTMLInputElement && t.type === 'file') return suppressLock();
      const label = t.closest('label');
      if (label?.querySelector('input[type=file]') || (label?.htmlFor && document.getElementById(label.htmlFor)?.getAttribute('type') === 'file')) return suppressLock();
      const a = t.closest('a');
      if (a && isExternalLink(a, window.location.origin)) suppressLock();
    },
    true,
  );
  const w = window as Window & { open: typeof window.open };
  const open = w.open.bind(w);
  w.open = (...args: Parameters<typeof window.open>) => {
    suppressLock();
    return open(...args);
  };
  if (typeof navigator.share === 'function') {
    const share = navigator.share.bind(navigator);
    navigator.share = (data?: ShareData) => {
      suppressLock();
      return share(data);
    };
  }
}
