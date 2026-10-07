import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  budgetUsage,
  buildBudgetRows,
  overallBudgetId,
  splitBudgets,
  summarizeBudget,
} from './budget';

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

describe('buildBudgetRows', () => {
  const category = (id: string, name: string, active = true, type: 'income' | 'expense' = 'expense') => ({
    id,
    scope: 'household' as const,
    type,
    name,
    active,
    isDefault: true,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
  });
  const budget = (categoryId: string, amountAgorot: number) => ({
    id: categoryId,
    scope: 'household' as const,
    categoryId,
    amountAgorot,
    createdAt: 0,
    updatedAt: 0,
  });

  it('מציג רק קטגוריות הוצאה, וממיין קודם חריגות ואז קטגוריות בלי תקציב', () => {
    const rows = buildBudgetRows(
      [category('a', 'אחת'), category('b', 'שתיים'), category('c', 'שלוש'), category('i', 'הכנסה', true, 'income')],
      [budget('a', 100_000), budget('b', 100_000)],
      new Map([
        ['a', 50_000],
        ['b', 120_000],
        ['c', 1],
      ]),
    );
    expect(rows.map((r) => r.categoryId)).toEqual(['b', 'a', 'c']);
    expect(rows[0].usage?.status).toBe('over');
    expect(rows[1].usage?.status).toBe('ok');
    expect(rows[2].usage).toBeNull();
  });

  it('קטגוריה מושבתת מוצגת רק אם יש בה הוצאות או תקציב', () => {
    const rows = buildBudgetRows(
      [category('a', 'אחת', false), category('b', 'שתיים', false), category('c', 'שלוש', false)],
      [budget('a', 100)],
      new Map([['b', 5]]),
    );
    expect(rows.map((r) => r.categoryId).sort()).toEqual(['a', 'b']);
  });
});

describe('תקציב כללי ופרטני', () => {
  const doc = (id: string, scope: 'business' | 'household', amountAgorot: number, categoryId = id) => ({
    id,
    scope,
    categoryId,
    amountAgorot,
    createdAt: 0,
    updatedAt: 0,
  });

  it('מפריד תקציב כללי מפרטניים, ומתעלם מתחום אחר', () => {
    const split = splitBudgets(
      [
        doc(overallBudgetId('household'), 'household', 900_000),
        doc('food', 'household', 300_000),
        doc('bills', 'household', 200_000),
        doc('fuel', 'business', 999),
      ],
      'household',
    );
    expect(split.overallAgorot).toBe(900_000);
    expect(split.categoriesTotalAgorot).toBe(500_000);
    expect([...split.byCategory.keys()].sort()).toEqual(['bills', 'food']);
  });

  it('בלי שום תקציב: none', () => {
    expect(summarizeBudget(splitBudgets([], 'household'), new Map([['a', 5]]))).toEqual({ kind: 'none' });
  });

  it('תקציב כללי בלי קטגוריות פרטניות: משווה את כל ההוצאות', () => {
    const split = splitBudgets([doc(overallBudgetId('household'), 'household', 1_000_000)], 'household');
    const summary = summarizeBudget(split, new Map([['a', 300_000], ['b', 200_000]]));
    expect(summary).toMatchObject({ kind: 'set', basis: 'overall', budgetAgorot: 1_000_000, usedAgorot: 500_000, overAgorot: 0, status: 'ok' });
  });

  it('חריגה מהתקציב הכללי מחזירה את סכום החריגה', () => {
    const split = splitBudgets([doc(overallBudgetId('household'), 'household', 400_000)], 'household');
    const summary = summarizeBudget(split, new Map([['a', 300_000], ['b', 200_000]]));
    expect(summary).toMatchObject({ kind: 'set', usedAgorot: 500_000, overAgorot: 100_000, status: 'over' });
  });

  it('רק תקציבים פרטניים: משווה רק הוצאות בקטגוריות שיש להן תקציב', () => {
    const split = splitBudgets([doc('food', 'household', 300_000)], 'household');
    const summary = summarizeBudget(split, new Map([['food', 100_000], ['other', 900_000]]));
    expect(summary).toMatchObject({ kind: 'set', basis: 'categories', budgetAgorot: 300_000, usedAgorot: 100_000 });
  });

  it('התקציב הכללי גובר גם כשיש פרטניים', () => {
    const split = splitBudgets(
      [doc(overallBudgetId('household'), 'household', 1_000_000), doc('food', 'household', 300_000)],
      'household',
    );
    expect(summarizeBudget(split, new Map([['food', 100_000], ['x', 100_000]]))).toMatchObject({
      basis: 'overall',
      usedAgorot: 200_000,
    });
  });
});
