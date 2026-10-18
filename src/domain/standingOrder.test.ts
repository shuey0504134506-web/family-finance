import { describe, expect, it } from 'vitest';
import {
  detectRecurring,
  dueDateIn,
  dueDatesUpTo,
  findSimilarAfter,
  firstDueDate,
  nextDueAfter,
  orderFromTransaction,
  transactionFromOrder,
} from './standingOrder';
import type { Transaction } from './types';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'a',
  type: 'expense',
  amountAgorot: 50_000,
  date: '2026-07-10',
  yearMonth: '2026-07',
  year: 2026,
  month: 7,
  counterparty: 'חברת חשמל',
  categoryId: 'c1',
  categoryName: 'חשבונות',
  paymentMethod: 'direct',
  note: '',
  titheStatus: 'liable',
  isTithePayment: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('תאריכי חיוב', () => {
  it('חודש קצר נחתך ליום האחרון', () => {
    expect(dueDateIn('2026-02', 31)).toBe('2026-02-28');
    expect(nextDueAfter(31, '2026-01-31')).toBe('2026-02-28');
    expect(nextDueAfter(31, '2026-02-28')).toBe('2026-03-31');
  });
  it('החיוב האוטומטי הראשון אינו מחזיר חיובים שעברו', () => {
    expect(firstDueDate(10, '2026-07-10', '2026-10-18')).toBe('2026-11-10');
    expect(firstDueDate(10, '2026-10-10', '2026-10-18')).toBe('2026-11-10');
    expect(firstDueDate(18, '2026-09-18', '2026-10-18')).toBe('2026-10-18');
    expect(firstDueDate(25, '2026-10-25', '2026-10-18')).toBe('2026-11-25');
  });
  it('מחזיר את כל החיובים שהגיעו, וכבויה לא מחזירה כלום', () => {
    const o = { dayOfMonth: 10, nextDue: '2026-08-10', active: true };
    expect(dueDatesUpTo(o, '2026-10-18')).toEqual(['2026-08-10', '2026-09-10', '2026-10-10']);
    expect(dueDatesUpTo({ ...o, active: false }, '2026-10-18')).toEqual([]);
    expect(dueDatesUpTo({ ...o, nextDue: '2026-11-10' }, '2026-10-18')).toEqual([]);
  });
  it('מזהה פעולה אוטומטית קבוע לפי הוראה ותאריך', () => {
    const order = orderFromTransaction(tx(), 'household', { id: 'o1', now: 5, today: '2026-10-18' });
    const a = transactionFromOrder(order, '2026-11-10', 9);
    const b = transactionFromOrder(order, '2026-11-10', 99);
    expect(a.id).toBe(b.id);
    expect(a.standingOrderId).toBe('o1');
    expect(a.counterparty).toBe('חברת חשמל');
    expect(order.nextDue).toBe('2026-11-10');
  });
});

describe('פעולות דומות', () => {
  const anchor = tx();
  it('מוצא פעולה אחת לכל חודש אחרי העוגן, בקירוב בשם ובסכום', () => {
    const list = [
      tx({ id: 'b', date: '2026-08-11', yearMonth: '2026-08', counterparty: 'חברת החשמל', amountAgorot: 52_000 }),
      tx({ id: 'c', date: '2026-09-09', yearMonth: '2026-09' }),
      tx({ id: 'd', date: '2026-09-20', yearMonth: '2026-09' }),
      tx({ id: 'e', date: '2026-10-10', yearMonth: '2026-10', amountAgorot: 200_000 }),
      tx({ id: 'f', date: '2026-06-10', yearMonth: '2026-06' }),
      tx({ id: 'g', date: '2026-10-10', yearMonth: '2026-10', counterparty: 'סופר' }),
    ];
    expect(findSimilarAfter(anchor, list).map((t) => t.id)).toEqual(['b', 'c']);
  });
  it('מדלג על פעולות שכבר בהוראת קבע', () => {
    const list = [tx({ id: 'b', date: '2026-08-10', yearMonth: '2026-08', standingOrderId: 'x' })];
    expect(findSimilarAfter(anchor, list)).toEqual([]);
  });
});

describe('זיהוי פעולות שחוזרות', () => {
  const series = [
    tx({ id: '1', date: '2026-08-10', yearMonth: '2026-08' }),
    tx({ id: '2', date: '2026-09-11', yearMonth: '2026-09' }),
    tx({ id: '3', date: '2026-10-10', yearMonth: '2026-10' }),
  ];
  it('מציע כשיש שלושה חודשים רצופים', () => {
    const found = detectRecurring(series, [], '2026-10-18');
    expect(found).toHaveLength(1);
    expect(found[0].transactions.map((t) => t.id)).toEqual(['1', '2', '3']);
    expect(found[0].dayOfMonth).toBe(10);
  });
  it('לא מציע כשחסר חודש, או כשהסדרה ישנה', () => {
    expect(detectRecurring([series[0], series[2]], [], '2026-10-18')).toEqual([]);
    expect(detectRecurring(series, [], '2027-03-18')).toEqual([]);
  });
  it('לא מציע מה שכבר הוראת קבע או קיים בשמה', () => {
    expect(detectRecurring(series.map((t) => ({ ...t, standingOrderId: 'o' })), [], '2026-10-18')).toEqual([]);
    expect(detectRecurring(series, [{ name: 'חברת חשמל', type: 'expense', active: true }], '2026-10-18')).toEqual([]);
  });
});
