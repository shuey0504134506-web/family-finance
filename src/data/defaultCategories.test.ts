import { describe, expect, it } from 'vitest';
import { buildBusinessCategories, buildDefaultCategories, categoryDocId } from './defaultCategories';

describe('קטגוריות ברירת מחדל', () => {
  it('העסק הראשון שומר על המזהים המקוריים', () => {
    expect(categoryDocId('business', 'expense', 'fuel')).toBe('business-expense-fuel');
    expect(buildDefaultCategories(0).some((c) => c.id === 'business-expense-fuel' && c.businessId === undefined)).toBe(true);
  });

  it('לעסק נוסף מזהים וקטגוריות משלו', () => {
    const list = buildBusinessCategories(0, 'b2');
    expect(list.length).toBeGreaterThan(5);
    expect(list.every((c) => c.scope === 'business' && c.businessId === 'b2')).toBe(true);
    expect(list.some((c) => c.id === 'business-b2-expense-fuel')).toBe(true);
    const ids = new Set([...list, ...buildDefaultCategories(0)].map((c) => c.id));
    expect(ids.size).toBe(list.length + buildDefaultCategories(0).length);
  });
});
