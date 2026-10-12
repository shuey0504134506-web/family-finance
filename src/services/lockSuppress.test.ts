import { beforeEach, describe, expect, it } from 'vitest';
import { clearNewAccount, isLockSuppressed, markSignedIn, resetLockSuppress, signedInRecently, signedInThisRun, suppressLock } from './lockSuppress';

describe('lockSuppress', () => {
  beforeEach(resetLockSuppress);

  it('לא מופעל כברירת מחדל', () => {
    expect(isLockSuppressed(1000)).toBe(false);
  });

  it('מדכא עד סוף הזמן שנקבע', () => {
    suppressLock(5000, 1000);
    expect(isLockSuppressed(5999)).toBe(true);
    expect(isLockSuppressed(6000)).toBe(false);
  });

  it('לא מקצר דיכוי קיים', () => {
    suppressLock(10_000, 0);
    suppressLock(1000, 0);
    expect(isLockSuppressed(9000)).toBe(true);
  });

  it('כניסה שבוצעה בהפעלה הזו פוטרת מנעילה מיידית, בלי תלות בשעון', () => {
    expect(signedInThisRun('u1')).toBe(false);
    markSignedIn('u1', 1000);
    expect(signedInThisRun('u1')).toBe(true);
    expect(signedInThisRun('u2')).toBe(false);
  });

  it('חלון המערכת מיד אחרי הכניסה לא נחשב עזיבה, אבל אחרי כמה דקות כן', () => {
    markSignedIn('u1', 0);
    expect(signedInRecently('u1', 60_000)).toBe(true);
    expect(signedInRecently('u1', 3 * 60_000)).toBe(false);
    expect(signedInRecently('u2', 1000)).toBe(false);
  });

  it('יציאה מהחשבון מוחקת את הכניסה', () => {
    markSignedIn('u1', 0);
    clearNewAccount();
    expect(signedInThisRun('u1')).toBe(false);
  });
});
