import { describe, expect, it } from 'vitest';
import { titheRecipients } from './tithe';

const tx = (counterparty: string, amountAgorot: number, date: string, isTithePayment = true, type: 'expense' | 'income' = 'expense') => ({
  type,
  amountAgorot,
  isTithePayment,
  counterparty,
  date,
});

describe('titheRecipients', () => {
  it('מקבץ לפי שם, מסכם ומסדר מהגדול לקטן', () => {
    const r = titheRecipients([tx('גמח א', 1000, '2026-01-05'), tx('גמח ב', 5000, '2026-02-01'), tx('גמח א ', 2000, '2026-03-01')]);
    expect(r.map((x) => [x.name, x.totalAgorot, x.count, x.lastDate])).toEqual([
      ['גמח ב', 5000, 1, '2026-02-01'],
      ['גמח א', 3000, 2, '2026-03-01'],
    ]);
  });
  it('מתעלם מפעולות שאינן תשלום מעשר, ומאחד שמות ריקים', () => {
    const r = titheRecipients([tx('x', 100, '2026-01-01', false), tx('y', 100, '2026-01-01', true, 'income'), tx('', 200, '2026-01-02'), tx('  ', 300, '2026-01-03')]);
    expect(r).toHaveLength(1);
    expect(r[0].totalAgorot).toBe(500);
  });
});

describe('titheRecipients: התשלומים של כל נמען', () => {
  it('מחזיר את התשלומים מהחדש לישן עם מזהה ומסך', () => {
    const r = titheRecipients([
      { ...tx('גמח א', 1000, '2026-01-05'), id: 'a', space: 'household' },
      { ...tx('גמח א', 2000, '2026-03-01'), id: 'b', space: 'business' },
    ]);
    expect(r[0].payments.map((p) => p.id)).toEqual(['b', 'a']);
    expect(r[0].payments[0].space).toBe('business');
  });
});
