import { describe, expect, it } from 'vitest';
import { categoryBreakdown, monthsOfYear, periodTotals } from './periods';

const tx = (yearMonth: string, type: 'income' | 'expense', amountAgorot: number, categoryId = 'c') => ({
  yearMonth,
  type,
  amountAgorot,
  categoryId,
});

describe('periodTotals', () => {
  const business = [
    tx('2026-01', 'income', 1_000_000),
    tx('2026-01', 'expense', 400_000),
    tx('2026-02', 'income', 100_000),
    tx('2026-02', 'expense', 300_000),
  ];
  const household = [tx('2026-01', 'income', 200_000), tx('2026-01', 'expense', 150_000), tx('2026-02', 'expense', 50_000)];

  it('עסק: הכנסות והוצאות של התקופה בלבד', () => {
    const t = periodTotals('business', household, business, ['2026-01'], 'allow-negative');
    expect(t).toEqual({ incomeAgorot: 1_000_000, expenseAgorot: 400_000, balanceAgorot: 600_000, fromBusinessAgorot: 0 });
  });

  it('משק בית: נטו העסק נכלל פעם אחת, גם כשהוא שלילי', () => {
    const t = periodTotals('household', household, business, ['2026-01', '2026-02'], 'allow-negative');
    // נטו עסק: +600,000 ואחריו -200,000 = 400,000. הכנסה עצמית 200,000.
    expect(t.fromBusinessAgorot).toBe(400_000);
    expect(t.incomeAgorot).toBe(600_000);
    expect(t.expenseAgorot).toBe(200_000);
    expect(t.balanceAgorot).toBe(400_000);
  });

  it('במצב positive-only חודש הפסדי לא מקזז חודש רווחי', () => {
    const t = periodTotals('household', household, business, ['2026-01', '2026-02'], 'positive-only');
    expect(t.fromBusinessAgorot).toBe(600_000);
  });

  it('אין ספירה כפולה: הכנסות העסק הגולמיות אינן במשק הבית', () => {
    const t = periodTotals('household', [], business, ['2026-01'], 'allow-negative');
    expect(t.incomeAgorot).toBe(600_000);
  });

  it('תקופה ריקה היא אפס', () => {
    const t = periodTotals('household', household, business, ['2030-01'], 'allow-negative');
    expect(t).toEqual({ incomeAgorot: 0, expenseAgorot: 0, balanceAgorot: 0, fromBusinessAgorot: 0 });
  });
});

describe('categoryBreakdown', () => {
  it('ממיין מהגדול לקטן ומחשב אחוזים', () => {
    const result = categoryBreakdown(
      [tx('2026-01', 'expense', 300, 'a'), tx('2026-01', 'expense', 100, 'b'), tx('2026-01', 'expense', 100, 'a'), tx('2026-02', 'expense', 999, 'z'), tx('2026-01', 'income', 50, 'i')],
      ['2026-01'],
      'expense',
    );
    expect(result).toEqual([
      { categoryId: 'a', amountAgorot: 400, percent: 80 },
      { categoryId: 'b', amountAgorot: 100, percent: 20 },
    ]);
  });
});

describe('monthsOfYear', () => {
  it('12 חודשים לפי הסדר', () => {
    const months = monthsOfYear(2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
  });
});
