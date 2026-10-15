import { describe, expect, it } from 'vitest';
import { buildImportTransactions, defaultChoice, defaultSelected, planRows, rowProblem } from './plan';
import type { ImportRow } from './parse';

const cats = [
  { id: 'food', name: 'מזון', type: 'expense' as const },
  { id: 'sal', name: 'משכורת', type: 'income' as const },
];
const row = (o: Partial<ImportRow> = {}): ImportRow => ({
  key: 'k1', sheet: 's', line: 2, date: '2026-10-05', type: 'expense', amountAgorot: 12050, currency: 'ILS', name: 'שופרסל דיל',
  details: '', card: '1234', issuerCategory: '', payment: 'credit', cardLumpSum: false, pending: false, refund: false, ...o,
});
const history = [
  { id: 'h1', type: 'expense' as const, amountAgorot: 9000, date: '2026-09-01', counterparty: 'שופרסל', paymentMethod: 'credit' as const, categoryId: 'food' },
];

describe('planRows', () => {
  it('מציע קטגוריה מההיסטוריה ומסמן שורה רגילה לייבוא', () => {
    const [p] = planRows([row()], 'household', history, cats);
    expect(p!.suggested).toEqual({ categoryId: 'food', source: 'history' });
    expect(defaultSelected(p!)).toBe(true);
    expect(p!.id).toMatch(/^imp-/);
  });
  it('כפילות סבירה לא מסומנת', () => {
    const dup = { ...history[0]!, id: 'x', amountAgorot: 12050, date: '2026-10-05', counterparty: 'שופרסל דיל' };
    const [p] = planRows([row()], 'household', [dup], cats);
    expect(p!.match.level).toBe('likely');
    expect(defaultSelected(p!)).toBe(false);
  });
  it('חיוב כרטיס מסכם, ממתין ומטבע לא נתמך לא מסומנים', () => {
    for (const o of [{ cardLumpSum: true }, { pending: true }, { currency: null }]) {
      const [p] = planRows([row(o as never)], 'household', [], cats);
      expect(defaultSelected(p!)).toBe(false);
    }
  });
});

describe('בניית פעולות', () => {
  it('בונה פעולה תקינה עם מזהה יציב והערה', () => {
    const [p] = planRows([row({ details: 'מקור: 100.00 USD' })], 'household', history, cats);
    const choice = defaultChoice(p!);
    const [t] = buildImportTransactions([{ planned: p!, choice }], { categories: cats, now: 1000 });
    expect(t).toMatchObject({
      id: p!.id, type: 'expense', amountAgorot: 12050, date: '2026-10-05', yearMonth: '2026-10', counterparty: 'שופרסל דיל',
      categoryId: 'food', categoryName: 'מזון', paymentMethod: 'credit', note: 'מקור: 100.00 USD · כרטיס 1234',
    });
    expect(t!.currency).toBeUndefined(); // שקל נשמר בלי שדה מטבע
  });
  it('שורה לא מסומנת או בלי קטגוריה לא נשמרת', () => {
    const [p] = planRows([row({ name: 'חנות חדשה' })], 'household', [], cats);
    const choice = defaultChoice(p!);
    expect(rowProblem(p!, choice, new Set(['food']))).toBe('חסרה קטגוריה');
    expect(buildImportTransactions([{ planned: p!, choice: { ...choice, selected: true } }], { categories: cats, now: 1 })).toEqual([]);
    expect(buildImportTransactions([{ planned: p!, choice: { ...choice, categoryId: 'food', selected: false } }], { categories: cats, now: 1 })).toEqual([]);
  });
  it('מטבע זר נשמר עם שדה מטבע, ועסק נוסף עם businessId', () => {
    const [p] = planRows([row({ currency: 'USD' })], 'business.b2', [], cats);
    const [t] = buildImportTransactions([{ planned: p!, choice: { ...defaultChoice(p!), categoryId: 'food', selected: true } }], { categories: cats, now: 1, businessId: 'b2' });
    expect(t).toMatchObject({ currency: 'USD', businessId: 'b2' });
  });
  it('הכנסה: זיכוי מסומן בהערה', () => {
    const [p] = planRows([row({ type: 'income', refund: true, name: 'החזר' })], 'household', [], cats);
    const [t] = buildImportTransactions([{ planned: p!, choice: { ...defaultChoice(p!), categoryId: 'sal', selected: true } }], { categories: cats, now: 1 });
    expect(t).toMatchObject({ type: 'income', note: 'כרטיס 1234 · זיכוי' });
  });
});
