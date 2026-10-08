/**
 * נעילת האפליקציה במכשיר. ההגדרות נשמרות במכשיר בלבד (לא ב-Firestore),
 * וכל סוד (סיסמה, PIN, תבנית) נשמר רק כגיבוב (hash) עם מלח, לעולם לא כטקסט.
 */
export type LockMethod = 'password' | 'pin' | 'pattern';
/** always = בכל יציאה מהמסך, close = רק אחרי סגירה מוחלטת, never = ללא נעילה. */
export type LockTiming = 'always' | 'close' | 'never';

export interface SecretHash {
  salt: string;
  iterations: number;
  hash: string;
}

export interface LockConfig {
  method: LockMethod;
  timing: LockTiming;
  password?: SecretHash;
  pin?: SecretHash & { length: number };
  pattern?: SecretHash;
  /** כישלונות רצופים בקוד PIN או בתבנית. אחרי MAX_LOCAL_FAILS נדרשת סיסמת החשבון. */
  fails: number;
}

export const DEFAULT_LOCK_CONFIG: LockConfig = { method: 'password', timing: 'always', fails: 0 };

export const MAX_LOCAL_FAILS = 5;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;
export const MIN_PATTERN_DOTS = 4;
/** כניסה טרייה (הקלדת סיסמה) לא נועלת מיד. */
export const FRESH_SIGN_IN_MS = 30_000;

const METHODS: readonly LockMethod[] = ['password', 'pin', 'pattern'];
const TIMINGS: readonly LockTiming[] = ['always', 'close', 'never'];

function isHash(value: unknown): value is SecretHash {
  const v = value as SecretHash | null;
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.salt === 'string' &&
    typeof v.hash === 'string' &&
    Number.isInteger(v.iterations) &&
    v.iterations > 0
  );
}

/** קורא הגדרות מהאחסון. נתון חסר או פגום מחזיר את ברירת המחדל (נעילה בסיסמה). */
export function parseLockConfig(raw: string | null): LockConfig {
  if (!raw) return { ...DEFAULT_LOCK_CONFIG };
  try {
    const p = JSON.parse(raw) as Partial<LockConfig> | null;
    if (!p || typeof p !== 'object') return { ...DEFAULT_LOCK_CONFIG };
    const config: LockConfig = {
      method: METHODS.includes(p.method as LockMethod) ? (p.method as LockMethod) : 'password',
      timing: TIMINGS.includes(p.timing as LockTiming) ? (p.timing as LockTiming) : 'always',
      fails: Number.isInteger(p.fails) && (p.fails as number) >= 0 ? (p.fails as number) : 0,
    };
    if (isHash(p.password)) config.password = p.password;
    if (isHash(p.pin) && Number.isInteger(p.pin.length)) config.pin = p.pin;
    if (isHash(p.pattern)) config.pattern = p.pattern;
    return config;
  } catch {
    return { ...DEFAULT_LOCK_CONFIG };
  }
}

/** השיטה בפועל: PIN או תבנית רק אם הוגדרו. אחרת סיסמת החשבון. */
export function effectiveMethod(config: LockConfig): LockMethod {
  if (config.method === 'pin' && config.pin) return 'pin';
  if (config.method === 'pattern' && config.pattern) return 'pattern';
  return 'password';
}

export const lockOnLaunch = (config: LockConfig): boolean => config.timing !== 'never';
export const lockOnBackground = (config: LockConfig): boolean => config.timing === 'always';
export const needsPasswordFallback = (config: LockConfig): boolean => config.fails >= MAX_LOCAL_FAILS;

export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'הקוד יכול להכיל ספרות בלבד.';
  if (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) {
    return `הקוד חייב להכיל בין ${MIN_PIN_LENGTH} ל-${MAX_PIN_LENGTH} ספרות.`;
  }
  return null;
}

/** תבנית: סדרת נקודות ברשת 3x3, מ-0 עד 8, בלי חזרות, לפחות MIN_PATTERN_DOTS. */
export function validatePattern(sequence: readonly number[]): string | null {
  const valid = sequence.every((n) => Number.isInteger(n) && n >= 0 && n <= 8);
  if (!valid || new Set(sequence).size !== sequence.length) return 'התבנית אינה תקינה.';
  if (sequence.length < MIN_PATTERN_DOTS) return `יש לחבר לפחות ${MIN_PATTERN_DOTS} נקודות.`;
  return null;
}

export const patternToSecret = (sequence: readonly number[]): string => sequence.join('');

/** האם כניסה שבוצעה לפני זמן קצר (הקלדת סיסמה זה עתה) פוטרת מנעילה מיידית. */
export function isFreshSignIn(lastSignInTime: string | undefined, now: number): boolean {
  const t = lastSignInTime ? Date.parse(lastSignInTime) : NaN;
  return Number.isFinite(t) && now - t >= 0 && now - t < FRESH_SIGN_IN_MS;
}
