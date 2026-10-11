import { beforeEach, describe, expect, it } from 'vitest';
import { isLockSuppressed, resetLockSuppress, suppressLock } from './lockSuppress';

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
});
