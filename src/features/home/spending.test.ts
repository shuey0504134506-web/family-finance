import { describe, expect, it } from 'vitest';
import { spendingBreakdown, spendingChangePercent } from './spending';

const e = (categoryId: string, amountAgorot: number, type: 'income' | 'expense' = 'expense') => ({
  type,
  amountAgorot,
  categoryId,
  categoryName: `ק-${categoryId}`,
});

describe('spendingBreakdown', () => {
  it('סוכם לפי קטגוריה, ממוין מהגדולה לקטנה, ומתעלם מהכנסות', () => {
    const r = spendingBreakdown([e('a', 100), e('b', 300), e('a', 50), e('c', 999, 'income')]);
    expect(r.totalAgorot).toBe(450);
    expect(r.slices.map((s) => s.id)).toEqual(['b', 'a']);
  });
  it('מעבר למספר הפרוסות המותר, השאר מצטבר ל"אחר"', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => e(id, 600 - i * 100));
    const r = spendingBreakdown(items, 4);
    expect(r.slices).toHaveLength(5);
    expect(r.slices[4]).toEqual({ id: 'other', name: 'קטגוריות נוספות', agorot: 200 + 100 });
    expect(r.slices.reduce((s, x) => s + x.agorot, 0)).toBe(r.totalAgorot);
  });
  it('בדיוק פרוסה אחת מעל המגבלה לא נהפכת ל"אחר" מיותר', () => {
    const r = spendingBreakdown(['a', 'b', 'c', 'd', 'e'].map((id, i) => e(id, 500 - i * 10)), 4);
    expect(r.slices).toHaveLength(5);
    expect(r.slices.some((s) => s.id === 'other')).toBe(false);
  });
});

describe('spendingChangePercent', () => {
  it('אחוז שינוי מעוגל, וללא השוואה כשהקודם אפס', () => {
    expect(spendingChangePercent(880, 1000)).toBe(-12);
    expect(spendingChangePercent(1500, 1000)).toBe(50);
    expect(spendingChangePercent(100, 0)).toBeNull();
  });
});
