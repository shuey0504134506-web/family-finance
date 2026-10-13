import { afterEach, describe, expect, it } from 'vitest';
import { setCurrency, type Rates } from './currency';
import { applyConversion, conversionNote, convertBudgets, datesNeedingRates, mainAmountOf } from './fx';
import type { TransactionRecord } from './types';

const rates = (usd: number): Rates => ({ ILS: 1, USD: usd, EUR: 0.25, GBP: 0.21 });

function tx(id: string, date: string, amountAgorot: number, currency?: 'USD' | 'ILS' | 'EUR'): TransactionRecord {
  return {
    id,
    type: 'expense',
    amountAgorot,
    date,
    yearMonth: date.slice(0, 7),
    currency,
  } as unknown as TransactionRecord;
}

afterEach(() => setCurrency('ILS'));

describe('fx', () => {
  it('ממיר דולר לשקל לפי שער היום (0.25 דולר לשקל = 4 ₪ לדולר)', () => {
    expect(mainAmountOf({ currency: 'USD', amountAgorot: 1000 }, rates(0.25))).toBe(4000);
  });

  it('בלי שער אין שווי, ובמטבע הראשי הסכום נשאר', () => {
    expect(mainAmountOf({ currency: 'USD', amountAgorot: 1000 }, undefined)).toBeUndefined();
    expect(mainAmountOf({ amountAgorot: 1000 }, undefined)).toBe(1000);
  });

  it('כל פעולה מומרת לפי שער היום שלה', () => {
    const byDate: Record<string, Rates> = { '2026-01-01': rates(0.25), '2026-02-01': rates(0.2) };
    const out = applyConversion(
      [tx('a', '2026-01-01', 100, 'USD'), tx('b', '2026-02-01', 100, 'USD'), tx('c', '2026-02-01', 500)],
      (d) => byDate[d],
    );
    expect(out.items.map((t) => t.amountAgorot)).toEqual([400, 500, 500]);
    expect(out.all.map((t) => t.mainAgorot)).toEqual([400, 500, undefined]);
    expect(out.all[0].amountAgorot).toBe(100);
    expect(out.all[0].currency).toBe('USD');
  });

  it('פעולה זרה בלי שער לא נכנסת לחישובים', () => {
    const out = applyConversion([tx('a', '2026-01-01', 100, 'USD')], () => undefined);
    expect(out.items).toHaveLength(0);
    expect(out.all).toHaveLength(1);
  });

  it('אם המטבע הראשי הוא דולר, שקל נחשב זר', () => {
    setCurrency('USD');
    const out = applyConversion([tx('a', '2026-01-01', 4000, 'ILS'), tx('b', '2026-01-01', 100, 'USD')], () => rates(0.25));
    expect(out.items.map((t) => t.amountAgorot)).toEqual([1000, 100]);
  });

  it('פעולה בלי שדה מטבע היא תמיד שקל, גם כשהמטבע הראשי דולר, והסכום השמור לא משתנה', () => {
    setCurrency('USD');
    const out = applyConversion([tx('a', '2026-01-01', 4000)], () => rates(0.25));
    expect(out.items[0].amountAgorot).toBe(1000);
    expect(out.all[0].amountAgorot).toBe(4000);
    expect(out.all[0].mainAgorot).toBe(1000);
  });

  it('תקציבים מומרים למטבע הראשי לפי השער הנתון, ובלי שער תקציב זר מושמט', () => {
    setCurrency('USD');
    const b = { id: 'x', amountAgorot: 4000 } as never;
    const d = { id: 'y', amountAgorot: 700, currency: 'USD' } as never;
    expect(convertBudgets([b, d], rates(0.25)).map((x) => x.amountAgorot)).toEqual([1000, 700]);
    expect(convertBudgets([b, d], undefined).map((x) => x.amountAgorot)).toEqual([700]);
  });

  it('מחזיר רק תאריכים של פעולות זרות, בלי כפילויות', () => {
    const dates = datesNeedingRates([
      tx('a', '2026-01-01', 1, 'USD'),
      tx('b', '2026-01-01', 1, 'EUR'),
      tx('c', '2026-01-02', 1),
    ]);
    expect(dates).toEqual(['2026-01-01']);
  });
});

describe('conversionNote', () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
  it('פעולה מלפני החלפת המטבע: שונה ביום ההחלפה, גם אם הוזנה באותו יום שהתרחשה', () => {
    const item = { date: '2026-09-29', createdAt: at('2026-09-29') };
    expect(conversionNote(item, false, at('2026-10-13'))).toBe('שונה ביום 13/10/2026 לסכום');
  });
  it('הוזנה ביום ההוצאה אחרי ההחלפה: הומר ביום ההוצאה', () => {
    const item = { date: '2026-10-14', createdAt: at('2026-10-14') };
    expect(conversionNote(item, false, at('2026-10-13'))).toBe('הומר ביום ההוצאה (14/10/2026) לסכום');
    expect(conversionNote(item, true)).toBe('הומר ביום ההכנסה (14/10/2026) לסכום');
  });
  it('הוזנה למפרע אחרי ההחלפה: לפי שער יום הפעולה', () => {
    const item = { date: '2026-10-01', createdAt: at('2026-10-14') };
    expect(conversionNote(item, true, at('2026-10-13'))).toBe('הומר לפי שער יום 01/10/2026 לסכום');
  });
});
