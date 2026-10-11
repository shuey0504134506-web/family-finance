import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrency } from './currency';
import { balanceAgorot, debtCategories, debtTotals, isSettled, validateDebt, validatePayment, type Debt } from './debt';

const debt = (o: Partial<Debt> = {}): Debt => ({
  id: 'd', scope: 'household', direction: 'owe', name: 'בנק', amountAgorot: 100000, category: 'הלוואה בנקאית',
  paymentMethod: 'transfer', date: '2026-10-01', note: '', payments: [], createdAt: 1, updatedAt: 1, ...o,
});

describe('חובות', () => {
  beforeEach(() => setCurrency('ILS'));

  it('יתרה = סכום פחות תשלומים, וחוב ששולם נחשב סגור', () => {
    const d = debt({ payments: [{ id: 'p', amountAgorot: 30000, date: '2026-10-05' }] });
    expect(balanceAgorot(d)).toBe(70000);
    expect(isSettled(d)).toBe(false);
    expect(isSettled(debt({ payments: [{ id: 'p', amountAgorot: 100000, date: '2026-10-05' }] }))).toBe(true);
  });

  it('סיכום לפי מטבע: אני חייב מול חייבים לי, בלי חובות סגורים', () => {
    const totals = debtTotals([
      debt(),
      debt({ id: '2', direction: 'owed', amountAgorot: 50000 }),
      debt({ id: '3', currency: 'USD', amountAgorot: 2000 }),
      debt({ id: '4', payments: [{ id: 'p', amountAgorot: 100000, date: '2026-10-05' }] }),
    ]);
    expect(totals).toEqual([
      { currency: 'ILS', oweAgorot: 100000, owedAgorot: 50000 },
      { currency: 'USD', oweAgorot: 2000, owedAgorot: 0 },
    ]);
  });

  it('קטגוריות: ברירות מחדל ואז אישיות ללא כפילות', () => {
    const list = debtCategories([{ category: 'חבר' }, { category: 'אחר' }, { category: 'חבר' }]);
    expect(list[0]).toBe('הלוואה בנקאית');
    expect(list.filter((c) => c === 'חבר')).toHaveLength(1);
    expect(list.filter((c) => c === 'אחר')).toHaveLength(1);
  });

  const ok = { name: 'דנה', amountAgorot: 500, category: 'אחר', date: '2026-10-01', dueDate: '', note: '' };
  it('טופס תקין ללא שגיאות, וסוגי שגיאות', () => {
    expect(validateDebt(ok)).toEqual({});
    expect(validateDebt({ ...ok, name: ' ' }).name).toBeDefined();
    expect(validateDebt({ ...ok, amountAgorot: 0 }).amount).toBeDefined();
    expect(validateDebt({ ...ok, amountAgorot: null }).amount).toBeDefined();
    expect(validateDebt({ ...ok, date: '2026-13-01' }).date).toBeDefined();
    expect(validateDebt({ ...ok, dueDate: 'x' }).dueDate).toBeDefined();
  });

  it('תשלום לא יעלה על היתרה', () => {
    const d = debt({ payments: [{ id: 'p', amountAgorot: 90000, date: '2026-10-05' }] });
    expect(validatePayment(d, 10000, '2026-10-06')).toBeNull();
    expect(validatePayment(d, 10001, '2026-10-06')).not.toBeNull();
    expect(validatePayment(d, 0, '2026-10-06')).not.toBeNull();
  });
});
