import { describe, expect, it } from 'vitest';
import { searchTransactions } from './search';

const tx = (over: Partial<Parameters<typeof searchTransactions>[0][number]> = {}) => ({
  type: 'expense' as const,
  amountAgorot: 125_000,
  date: '2026-03-15',
  counterparty: 'סופר פארם',
  categoryName: 'בריאות',
  note: 'תרופות לילדים',
  createdAt: 1,
  ...over,
});

describe('searchTransactions', () => {
  const data = [
    tx(),
    tx({ counterparty: 'שופרסל', categoryName: 'מזון', note: '', amountAgorot: 33_050, date: '2026-04-02', createdAt: 2 }),
    tx({ type: 'income', counterparty: 'לקוח', categoryName: 'שירותים', note: '', amountAgorot: 500_000, date: '2025-12-31', createdAt: 3 }),
  ];

  it('חיפוש ריק מחזיר הכול, מהחדש לישן', () => {
    const result = searchTransactions(data, { text: '', type: 'all' });
    expect(result.map((r) => r.date)).toEqual(['2026-04-02', '2026-03-15', '2025-12-31']);
  });

  it('מוצא לפי שם, קטגוריה והערה', () => {
    expect(searchTransactions(data, { text: 'שופרסל', type: 'all' })).toHaveLength(1);
    expect(searchTransactions(data, { text: 'בריאות', type: 'all' })).toHaveLength(1);
    expect(searchTransactions(data, { text: 'ילדים', type: 'all' })).toHaveLength(1);
  });

  it('כל המילים חייבות להתאים', () => {
    expect(searchTransactions(data, { text: 'סופר ילדים', type: 'all' })).toHaveLength(1);
    expect(searchTransactions(data, { text: 'סופר שופרסל', type: 'all' })).toHaveLength(0);
  });

  it('מוצא לפי סכום, עם פסיקים ובלי', () => {
    expect(searchTransactions(data, { text: '1250', type: 'all' })).toHaveLength(1);
    expect(searchTransactions(data, { text: '1,250', type: 'all' })).toHaveLength(1);
    expect(searchTransactions(data, { text: '330.50', type: 'all' })).toHaveLength(1);
  });

  it('מוצא לפי תאריך', () => {
    expect(searchTransactions(data, { text: '2025-12', type: 'all' })).toHaveLength(1);
    expect(searchTransactions(data, { text: '15/03', type: 'all' })).toHaveLength(1);
  });

  it('מסנן לפי סוג', () => {
    expect(searchTransactions(data, { text: '', type: 'income' })).toHaveLength(1);
    expect(searchTransactions(data, { text: '', type: 'expense' })).toHaveLength(2);
  });
});
