import { describe, expect, it } from 'vitest';
import { computeTitheBalance, titheByMonth, titheLiableIncome, tithePaid } from './tithe';

describe('computeTitheBalance', () => {
  it('מחשב 10% מההכנסה החייבת', () => {
    const balance = computeTitheBalance(1_800_000, 0, 1000);
    expect(balance.requiredAgorot).toBe(180_000);
    expect(balance.remainingAgorot).toBe(180_000);
    expect(balance.surplusAgorot).toBe(0);
  });

  it('מציג עודף כשניתן יותר מהנדרש', () => {
    const balance = computeTitheBalance(1_000_000, 115_000, 1000);
    expect(balance.remainingAgorot).toBe(0);
    expect(balance.surplusAgorot).toBe(15_000);
  });

  it('יתרה אפס כשהמעשר שולם בדיוק', () => {
    const balance = computeTitheBalance(1_000_000, 100_000, 1000);
    expect(balance.remainingAgorot).toBe(0);
    expect(balance.surplusAgorot).toBe(0);
  });
});

describe('titheLiableIncome', () => {
  it('מחשב נטו מהעסק ועוד הכנסות חייבות, ומדלג על הכנסה פטורה', () => {
    const liable = titheLiableIncome(
      [
        { type: 'income', amountAgorot: 200_000, titheStatus: 'liable' },
        { type: 'income', amountAgorot: 500_000, titheStatus: 'exempt' },
        { type: 'expense', amountAgorot: 999_999, titheStatus: 'liable' },
      ],
      1_800_000,
    );
    expect(liable).toBe(2_000_000);
  });

  it('הכנסות העסק הגולמיות אינן חלק מהחישוב, רק הנטו שעבר', () => {
    // עסק: 30,000 הכנסות, 12,000 הוצאות -> 18,000 עוברים. מעשר = 1,800
    const liable = titheLiableIncome([], 1_800_000);
    expect(computeTitheBalance(liable, 0, 1000).requiredAgorot).toBe(180_000);
  });
});

describe('tithePaid', () => {
  const household = [
    { type: 'expense' as const, amountAgorot: 80_000, isTithePayment: true },
    { type: 'expense' as const, amountAgorot: 500_000, isTithePayment: false },
    { type: 'income' as const, amountAgorot: 70_000, isTithePayment: true },
  ];
  const business = [{ type: 'expense' as const, amountAgorot: 20_000, isTithePayment: true }];

  it('סופר רק הוצאות שסומנו כמעשר', () => {
    expect(tithePaid(household, [], false)).toBe(80_000);
  });

  it('סופר גם הוצאות עסק מסומנות כשההגדרה פעילה', () => {
    expect(tithePaid(household, business, true)).toBe(100_000);
    expect(tithePaid(household, business, false)).toBe(80_000);
  });
});

describe('titheByMonth - דוגמת ינואר/פברואר מהמסמך', () => {
  // ינואר: חיוב 1,000, ניתן 800 -> נותר 200
  // פברואר: חיוב נוסף 1,200 -> חוב מצטבר 1,400. ניתן 1,500 -> עודף 100
  const rows = titheByMonth(
    [
      { yearMonth: '2026-02', liableIncomeAgorot: 1_200_000, paidAgorot: 150_000 },
      { yearMonth: '2026-01', liableIncomeAgorot: 1_000_000, paidAgorot: 80_000 },
    ],
    1000,
  );

  it('ממיין לפי חודש', () => {
    expect(rows.map((r) => r.yearMonth)).toEqual(['2026-01', '2026-02']);
  });

  it('ינואר: נותר 200', () => {
    expect(rows[0].cumulative.requiredAgorot).toBe(100_000);
    expect(rows[0].cumulative.remainingAgorot).toBe(20_000);
  });

  it('פברואר: החוב המצטבר לפני תשלום הוא 1,400', () => {
    // 200 שנותרו מינואר + 1,200 חיוב חדש = 1,400
    const febBeforePayment = titheByMonth(
      [
        { yearMonth: '2026-01', liableIncomeAgorot: 1_000_000, paidAgorot: 80_000 },
        { yearMonth: '2026-02', liableIncomeAgorot: 1_200_000, paidAgorot: 0 },
      ],
      1000,
    );
    expect(febBeforePayment[1].cumulative.remainingAgorot).toBe(140_000);
  });

  it('פברואר: אם ניתן 1,500 בפברואר, יש עודף של 100', () => {
    const feb = titheByMonth(
      [
        { yearMonth: '2026-01', liableIncomeAgorot: 1_000_000, paidAgorot: 80_000 },
        { yearMonth: '2026-02', liableIncomeAgorot: 1_200_000, paidAgorot: 150_000 },
      ],
      1000,
    );
    expect(feb[1].cumulative.remainingAgorot).toBe(0);
    expect(feb[1].cumulative.surplusAgorot).toBe(10_000);
  });

  it('החוב לא מתאפס בתחילת חודש חדש', () => {
    const result = titheByMonth(
      [
        { yearMonth: '2026-01', liableIncomeAgorot: 1_000_000, paidAgorot: 0 },
        { yearMonth: '2026-02', liableIncomeAgorot: 0, paidAgorot: 0 },
        { yearMonth: '2026-03', liableIncomeAgorot: 0, paidAgorot: 0 },
      ],
      1000,
    );
    expect(result[2].cumulative.remainingAgorot).toBe(100_000);
  });
});
