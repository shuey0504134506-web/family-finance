import { describe, expect, it } from 'vitest';
import {
  buildTransaction,
  draftFromTransaction,
  validateDraft,
  type TransactionDraft,
} from './transactionInput';

const draft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
  type: 'expense',
  amountText: '250',
  date: '2026-10-07',
  counterparty: 'ספק',
  categoryId: 'business-expense-fuel',
  paymentMethod: 'credit',
  note: '',
  titheStatus: 'liable',
  isTithePayment: false,
  ...overrides,
});

const categories = ['business-expense-fuel'];

describe('validateDraft', () => {
  it('טיוטה תקינה אינה מחזירה שגיאות', () => {
    expect(validateDraft(draft(), categories)).toEqual({});
  });

  it('דורש סכום', () => {
    expect(validateDraft(draft({ amountText: '  ' }), categories).amount).toBeDefined();
  });

  it('דוחה סכום לא תקין, אפס, שלילי וגדול מדי', () => {
    for (const amountText of ['abc', '0', '-5', '1.500', '2000000000']) {
      expect(validateDraft(draft({ amountText }), categories).amount, amountText).toBeDefined();
    }
  });

  it('מקבל סכום עם פסיק אלפים ועם אגורות', () => {
    expect(validateDraft(draft({ amountText: '1,250.50' }), categories).amount).toBeUndefined();
  });

  it('דוחה תאריך לא קיים', () => {
    expect(validateDraft(draft({ date: '2026-02-31' }), categories).date).toBeDefined();
    expect(validateDraft(draft({ date: '' }), categories).date).toBeDefined();
  });

  it('דורש קטגוריה מהרשימה', () => {
    expect(validateDraft(draft({ categoryId: 'nope' }), categories).category).toBeDefined();
  });

  it('מגביל אורך שם והערה', () => {
    const errors = validateDraft(
      draft({ counterparty: 'א'.repeat(121), note: 'ב'.repeat(1001) }),
      categories,
    );
    expect(errors.counterparty).toBeDefined();
    expect(errors.note).toBeDefined();
  });
});

describe('buildTransaction', () => {
  const context = { id: 'abc', categoryName: 'דלק', now: 1_000 };

  it('בונה פעולה עם סכום באגורות ושדות חודש נגזרים', () => {
    const tx = buildTransaction(draft({ amountText: '1,250.50' }), context);
    expect(tx.amountAgorot).toBe(125_050);
    expect(tx.yearMonth).toBe('2026-10');
    expect(tx.year).toBe(2026);
    expect(tx.month).toBe(10);
    expect(tx.createdAt).toBe(1_000);
    expect(tx.updatedAt).toBe(1_000);
    expect(tx.id).toBe('abc');
  });

  it('בעריכה createdAt נשמר ו-updatedAt מתעדכן', () => {
    const tx = buildTransaction(draft(), { ...context, now: 5_000, createdAt: 1_000 });
    expect(tx.createdAt).toBe(1_000);
    expect(tx.updatedAt).toBe(5_000);
  });

  it('החודש נגזר מהתאריך גם כשהוא שונה מהחודש הנוכחי', () => {
    expect(buildTransaction(draft({ date: '2025-01-31' }), context).yearMonth).toBe('2025-01');
  });

  it('סימון מעשר חל על הוצאה בלבד, וסטטוס מעשר על הכנסה בלבד', () => {
    const income = buildTransaction(
      draft({ type: 'income', isTithePayment: true, titheStatus: 'exempt' }),
      context,
    );
    expect(income.isTithePayment).toBe(false);
    expect(income.titheStatus).toBe('exempt');

    const expense = buildTransaction(
      draft({ type: 'expense', isTithePayment: true, titheStatus: 'exempt' }),
      context,
    );
    expect(expense.isTithePayment).toBe(true);
    expect(expense.titheStatus).toBe('liable');
  });

  it('זורק שגיאה על סכום לא תקין ולא שומר ערך שגוי', () => {
    expect(() => buildTransaction(draft({ amountText: 'x' }), context)).toThrow();
    expect(() => buildTransaction(draft({ amountText: '0' }), context)).toThrow();
  });

  it('אין שדות undefined (Firestore דוחה אותם)', () => {
    const tx = buildTransaction(draft(), context);
    expect(Object.values(tx).every((v) => v !== undefined)).toBe(true);
  });
});

describe('draftFromTransaction', () => {
  it('הפיכה: בנייה ואז טיוטה מחזירות את אותם ערכים', () => {
    const original = draft({ amountText: '1250.5', note: 'הערה', isTithePayment: true });
    const tx = buildTransaction(original, { id: 'x', categoryName: 'דלק', now: 1 });
    const back = draftFromTransaction(tx);
    expect(back.amountText).toBe('1250.50');
    expect(back.note).toBe('הערה');
    expect(back.isTithePayment).toBe(true);
    expect(buildTransaction(back, { id: 'x', categoryName: 'דלק', now: 1 }).amountAgorot).toBe(
      tx.amountAgorot,
    );
  });

  it('סכום עגול מוצג בלי אגורות', () => {
    const tx = buildTransaction(draft({ amountText: '300' }), { id: 'x', categoryName: 'דלק', now: 1 });
    expect(draftFromTransaction(tx).amountText).toBe('300');
  });
});
