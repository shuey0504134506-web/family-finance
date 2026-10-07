import { describe, expect, it } from 'vitest';
import { budgetStatus, budgetUsage } from './budget';

describe('budgetUsage (דוגמת התקציב מהמסמך)', () => {
  it('12,000 תקציב, 8,000 נוצל -> נשאר 4,000, 66.7%', () => {
    const usage = budgetUsage(1_200_000, 800_000);
    expect(usage.remainingAgorot).toBe(400_000);
    expect(usage.percentUsed).toBe(66.7);
    expect(usage.status).toBe('ok');
  });

  it('מזון: 2,500 תקציב, 1,900 נוצל -> נשאר 600', () => {
    const usage = budgetUsage(250_000, 190_000);
    expect(usage.remainingAgorot).toBe(60_000);
    expect(usage.percentUsed).toBe(76);
    expect(usage.status).toBe('approaching');
  });

  it('92% -> קרובים מאוד לתקרה', () => {
    expect(budgetUsage(100_000, 92_000).percentUsed).toBe(92);
    expect(budgetUsage(100_000, 92_000).status).toBe('near');
  });

  it('בחריגה היתרה שלילית', () => {
    const usage = budgetUsage(100_000, 120_000);
    expect(usage.remainingAgorot).toBe(-20_000);
    expect(usage.status).toBe('over');
  });

  it('אין אחוז כשאין תקציב', () => {
    expect(budgetUsage(0, 5000).percentUsed).toBeNull();
    expect(budgetUsage(0, 0).percentUsed).toBeNull();
  });
});

describe('budgetStatus - ספים', () => {
  const budget = 100_000;
  const at = (percent: number) => budgetStatus(budget, percent * 1000);

  it('מתחת ל-75% תקין', () => {
    expect(at(0)).toBe('ok');
    expect(at(74)).toBe('ok');
  });

  it('75% עד מתחת ל-90% מתקרבים', () => {
    expect(at(75)).toBe('approaching');
    expect(at(89)).toBe('approaching');
  });

  it('90% עד 100% כולל קרובים מאוד', () => {
    expect(at(90)).toBe('near');
    expect(at(100)).toBe('near');
  });

  it('מעל 100% חריגה', () => {
    expect(budgetStatus(budget, 100_001)).toBe('over');
    expect(at(101)).toBe('over');
  });

  it('תקציב אפס: חריגה רק אם נוצל משהו', () => {
    expect(budgetStatus(0, 0)).toBe('ok');
    expect(budgetStatus(0, 1)).toBe('over');
  });
});
