import { beforeEach, describe, expect, it } from 'vitest';
import { convertAgorot, currencyOf, foreignTotals, isPrimaryCurrency, setCurrency, type Rates } from './currency';
import { formatShekels } from './money';
import { buildTransaction, draftFromTransaction, type TransactionDraft } from './transactionInput';
import { parseRatesResponse } from '../services/exchangeRates';

const rates: Rates = { ILS: 1, USD: 0.25, EUR: 0.23, GBP: 0.2 };

describe('מטבע לכל פעולה', () => {
  beforeEach(() => setCurrency('ILS'));

  it('פעולה בלי שדה מטבע היא במטבע הראשי', () => {
    expect(currencyOf({})).toBe('ILS');
    expect(isPrimaryCurrency({})).toBe(true);
    expect(isPrimaryCurrency({ currency: 'USD' })).toBe(false);
  });

  it('סיכום מטבעות זרים בלבד, לפי סדר קבוע', () => {
    const rows = foreignTotals([
      { type: 'income', amountAgorot: 1000 },
      { type: 'income', amountAgorot: 500, currency: 'EUR' },
      { type: 'expense', amountAgorot: 200, currency: 'USD' },
      { type: 'income', amountAgorot: 300, currency: 'USD' },
    ]);
    expect(rows).toEqual([
      { currency: 'USD', incomeAgorot: 300, expenseAgorot: 200 },
      { currency: 'EUR', incomeAgorot: 500, expenseAgorot: 0 },
    ]);
  });

  it('המרה לפי שערים, ובלי שינוי באותו מטבע', () => {
    expect(convertAgorot(10000, 'USD', 'ILS', rates)).toBe(40000);
    expect(convertAgorot(40000, 'ILS', 'USD', rates)).toBe(10000);
    expect(convertAgorot(10000, 'USD', 'EUR', rates)).toBe(9200);
    expect(convertAgorot(777, 'EUR', 'EUR', rates)).toBe(777);
  });

  it('תצוגת סכום לפי המטבע שנתבקש', () => {
    expect(formatShekels(12345, { currency: 'USD' })).toBe('$123.45');
    expect(formatShekels(12345, { currency: 'ILS' })).toBe('123.45 ₪');
  });

  const draft: TransactionDraft = {
    type: 'expense', amountText: '10', date: '2026-10-07', counterparty: '', categoryId: 'c',
    paymentMethod: 'cash', note: '', titheStatus: 'liable', isTithePayment: false, currency: 'ILS',
  };
  const ctx = { id: 'x', categoryName: 'c', now: 1 };

  it('מטבע ראשי נשמר בלי שדה, ומטבע אחר נשמר במפורש', () => {
    expect('currency' in buildTransaction(draft, ctx)).toBe(false);
    const usd = buildTransaction({ ...draft, currency: 'USD' }, ctx);
    expect(usd.currency).toBe('USD');
    expect(draftFromTransaction(usd).currency).toBe('USD');
    expect(draftFromTransaction(buildTransaction(draft, ctx)).currency).toBe('ILS');
  });
});

describe('parseRatesResponse', () => {
  it('מקבל תשובה תקינה', () => {
    const r = parseRatesResponse({ date: '2026-10-09', rates: { USD: 0.27, EUR: 0.25, GBP: 0.21 } }, 5);
    expect(r?.rates.ILS).toBe(1);
    expect(r?.rates.USD).toBe(0.27);
    expect(r?.date).toBe('2026-10-09');
  });
  it('דוחה שער חסר, אפס או לא מספר', () => {
    expect(parseRatesResponse({ date: 'x', rates: { USD: 0.27, EUR: 0.25 } }, 5)).toBeNull();
    expect(parseRatesResponse({ date: 'x', rates: { USD: 0, EUR: 0.25, GBP: 0.2 } }, 5)).toBeNull();
    expect(parseRatesResponse({ date: 'x', rates: { USD: '1', EUR: 0.25, GBP: 0.2 } }, 5)).toBeNull();
    expect(parseRatesResponse(null, 5)).toBeNull();
  });
});
