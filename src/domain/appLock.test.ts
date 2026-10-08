import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCK_CONFIG,
  effectiveMethod,
  isFreshSignIn,
  lockOnBackground,
  lockOnLaunch,
  needsPasswordFallback,
  parseLockConfig,
  validatePattern,
  validatePin,
} from './appLock';

const hash = { salt: 'AAAA', iterations: 1000, hash: 'BBBB' };

describe('parseLockConfig', () => {
  it('ברירת מחדל: סיסמת החשבון, נעילה בכל יציאה מהמסך', () => {
    expect(parseLockConfig(null)).toEqual(DEFAULT_LOCK_CONFIG);
    expect(parseLockConfig('לא JSON')).toEqual(DEFAULT_LOCK_CONFIG);
    expect(parseLockConfig('null')).toEqual(DEFAULT_LOCK_CONFIG);
  });

  it('ערכים לא מוכרים חוזרים לברירת המחדל, ולא משאירים נעילה פתוחה', () => {
    const c = parseLockConfig(JSON.stringify({ method: 'x', timing: 'y', fails: -3 }));
    expect(c).toEqual(DEFAULT_LOCK_CONFIG);
  });

  it('קורא הגדרות תקינות וגיבובים', () => {
    const c = parseLockConfig(
      JSON.stringify({ method: 'pin', timing: 'close', fails: 2, pin: { ...hash, length: 4 }, pattern: hash }),
    );
    expect(c.method).toBe('pin');
    expect(c.timing).toBe('close');
    expect(c.fails).toBe(2);
    expect(c.pin?.length).toBe(4);
    expect(c.pattern).toEqual(hash);
  });

  it('גיבוב פגום מוסר', () => {
    const c = parseLockConfig(JSON.stringify({ method: 'pin', pin: { salt: 1 } }));
    expect(c.pin).toBeUndefined();
  });
});

describe('effectiveMethod', () => {
  it('PIN או תבנית ללא סוד שמור נופלים לסיסמה', () => {
    expect(effectiveMethod({ ...DEFAULT_LOCK_CONFIG, method: 'pin' })).toBe('password');
    expect(effectiveMethod({ ...DEFAULT_LOCK_CONFIG, method: 'pattern' })).toBe('password');
  });
  it('עם סוד שמור משתמשים בשיטה שנבחרה', () => {
    expect(effectiveMethod({ ...DEFAULT_LOCK_CONFIG, method: 'pin', pin: { ...hash, length: 4 } })).toBe('pin');
    expect(effectiveMethod({ ...DEFAULT_LOCK_CONFIG, method: 'pattern', pattern: hash })).toBe('pattern');
  });
});

describe('מתי נועלים', () => {
  it('always: בהפעלה וביציאה מהמסך', () => {
    const c = { ...DEFAULT_LOCK_CONFIG, timing: 'always' as const };
    expect(lockOnLaunch(c)).toBe(true);
    expect(lockOnBackground(c)).toBe(true);
  });
  it('close: רק בהפעלה', () => {
    const c = { ...DEFAULT_LOCK_CONFIG, timing: 'close' as const };
    expect(lockOnLaunch(c)).toBe(true);
    expect(lockOnBackground(c)).toBe(false);
  });
  it('never: לעולם לא', () => {
    const c = { ...DEFAULT_LOCK_CONFIG, timing: 'never' as const };
    expect(lockOnLaunch(c)).toBe(false);
    expect(lockOnBackground(c)).toBe(false);
  });
  it('אחרי 5 כישלונות נדרשת סיסמת החשבון', () => {
    expect(needsPasswordFallback({ ...DEFAULT_LOCK_CONFIG, fails: 4 })).toBe(false);
    expect(needsPasswordFallback({ ...DEFAULT_LOCK_CONFIG, fails: 5 })).toBe(true);
  });
});

describe('validatePin / validatePattern', () => {
  it('PIN: ספרות בלבד, 4 עד 8', () => {
    expect(validatePin('1234')).toBeNull();
    expect(validatePin('12345678')).toBeNull();
    for (const bad of ['123', '123456789', '12a4', '', '12 4']) expect(validatePin(bad), bad).not.toBeNull();
  });
  it('תבנית: לפחות 4 נקודות ייחודיות בטווח 0-8', () => {
    expect(validatePattern([0, 1, 2, 5])).toBeNull();
    expect(validatePattern([0, 1, 2])).not.toBeNull();
    expect(validatePattern([0, 1, 1, 2])).not.toBeNull();
    expect(validatePattern([0, 1, 2, 9])).not.toBeNull();
  });
});

describe('isFreshSignIn', () => {
  const now = Date.parse('2026-10-08T10:00:00Z');
  it('כניסה לפני שניות פוטרת, ישנה לא', () => {
    expect(isFreshSignIn('Thu, 08 Oct 2026 09:59:50 GMT', now)).toBe(true);
    expect(isFreshSignIn('Thu, 08 Oct 2026 09:00:00 GMT', now)).toBe(false);
    expect(isFreshSignIn(undefined, now)).toBe(false);
    expect(isFreshSignIn('garbage', now)).toBe(false);
  });
});
