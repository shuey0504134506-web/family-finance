import { describe, expect, it } from 'vitest';
import {
  buildTitheInputs,
  computeTitheBalance,
  householdTitheLiableIncome,
  titheByMonth,
  tithePaid,
  type TitheMonthInput,
} from './tithe';

const month = (
  yearMonth: string,
  householdLiableIncomeAgorot: number,
  businessNetAgorot: number,
  paidAgorot = 0,
): TitheMonthInput => ({ yearMonth, householdLiableIncomeAgorot, businessNetAgorot, paidAgorot });

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

  it('הפסד לא יוצר חוב מעשר שלילי ולא עודף בדיוני', () => {
    const balance = computeTitheBalance(-300_000, 0, 1000);
    expect(balance.requiredAgorot).toBe(0);
    expect(balance.remainingAgorot).toBe(0);
    expect(balance.surplusAgorot).toBe(0);
  });

  it('יתרה אפס כשהמעשר שולם בדיוק', () => {
    const balance = computeTitheBalance(1_000_000, 100_000, 1000);
    expect(balance.remainingAgorot).toBe(0);
    expect(balance.surplusAgorot).toBe(0);
  });
});

describe('householdTitheLiableIncome', () => {
  it('סופר הכנסות חייבות בלבד, ומדלג על הכנסה פטורה ועל הוצאות', () => {
    const liable = householdTitheLiableIncome([
      { type: 'income', amountAgorot: 200_000, titheStatus: 'liable' },
      { type: 'income', amountAgorot: 500_000, titheStatus: 'exempt' },
      { type: 'expense', amountAgorot: 999_999, titheStatus: 'liable' },
    ]);
    expect(liable).toBe(200_000);
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

describe('titheByMonth - מעשרות מנטו העסק', () => {
  it('הכנסות העסק הגולמיות אינן חלק מהחישוב, רק הנטו שעבר', () => {
    // עסק: 30,000 הכנסות, 12,000 הוצאות -> 18,000 עוברים. מעשר = 1,800
    const [row] = titheByMonth([month('2026-10', 0, 1_800_000)], 1000);
    expect(row.cumulative.liableIncomeAgorot).toBe(1_800_000);
    expect(row.cumulative.requiredAgorot).toBe(180_000);
  });

  it('חודש הפסדי אחרי חודש רווחי מקטין את המעשר שנובע מנטו העסק', () => {
    // ינואר: נטו עסק +10,000 -> מעשר 1,000. פברואר: הפסד 4,000 -> מצטבר 6,000 -> מעשר 600
    const rows = titheByMonth([month('2026-01', 0, 1_000_000), month('2026-02', 0, -400_000)], 1000);
    expect(rows[0].cumulative.requiredAgorot).toBe(100_000);
    expect(rows[1].cumulativeBusinessNetAgorot).toBe(600_000);
    expect(rows[1].cumulative.liableIncomeAgorot).toBe(600_000);
    expect(rows[1].cumulative.requiredAgorot).toBe(60_000);
  });

  it('הפסד עסקי לא מקטין מעשר על הכנסות אחרות של משק הבית', () => {
    // ינואר: נטו עסק +1,000. פברואר: הכנסה עצמית 5,000, הפסד עסקי 4,000.
    // נטו עסק מצטבר: -3,000, ולכן החלק העסקי הוא 0. הכנסה חייבת = 5,000, מעשר 500.
    // (אם ההפסד היה מקטין גם את ההכנסה העצמית, היינו מקבלים 2,000 וחוב של 200.)
    const rows = titheByMonth([month('2026-01', 0, 100_000), month('2026-02', 500_000, -400_000)], 1000);
    expect(rows[1].cumulativeBusinessNetAgorot).toBe(-300_000);
    expect(rows[1].cumulative.liableIncomeAgorot).toBe(500_000);
    expect(rows[1].cumulative.requiredAgorot).toBe(50_000);
  });

  it('הפסד גדול מהרווח שנצבר לא יוצר חוב שלילי', () => {
    const rows = titheByMonth([month('2026-01', 0, 1_000_000), month('2026-02', 0, -1_400_000)], 1000);
    expect(rows[1].cumulative.liableIncomeAgorot).toBe(0);
    expect(rows[1].cumulative.requiredAgorot).toBe(0);
    expect(rows[1].cumulative.surplusAgorot).toBe(0);
  });

  it('הפסד שלא כוסה ממשיך להקטין רווח של חודשים הבאים', () => {
    // ינואר +10,000, פברואר -14,000, מרץ +5,000 -> מצטבר 1,000 -> מעשר 100
    const rows = titheByMonth(
      [month('2026-01', 0, 1_000_000), month('2026-02', 0, -1_400_000), month('2026-03', 0, 500_000)],
      1000,
    );
    expect(rows[2].cumulativeBusinessNetAgorot).toBe(100_000);
    expect(rows[2].cumulative.requiredAgorot).toBe(10_000);
  });
});

describe('titheByMonth - דוגמת ינואר/פברואר מהמסמך', () => {
  // ינואר: חיוב 1,000, ניתן 800 -> נותר 200
  // פברואר: חיוב נוסף 1,200 -> חוב מצטבר 1,400. ניתן 1,500 -> עודף 100
  it('ממיין לפי חודש', () => {
    const rows = titheByMonth(
      [month('2026-02', 1_200_000, 0, 150_000), month('2026-01', 1_000_000, 0, 80_000)],
      1000,
    );
    expect(rows.map((r) => r.yearMonth)).toEqual(['2026-01', '2026-02']);
  });

  it('ינואר: נותר 200', () => {
    const [jan] = titheByMonth([month('2026-01', 1_000_000, 0, 80_000)], 1000);
    expect(jan.cumulative.requiredAgorot).toBe(100_000);
    expect(jan.cumulative.remainingAgorot).toBe(20_000);
  });

  it('פברואר: החוב המצטבר לפני תשלום הוא 1,400', () => {
    // 200 שנותרו מינואר + 1,200 חיוב חדש = 1,400
    const rows = titheByMonth([month('2026-01', 1_000_000, 0, 80_000), month('2026-02', 1_200_000, 0, 0)], 1000);
    expect(rows[1].cumulative.remainingAgorot).toBe(140_000);
  });

  it('פברואר: אם ניתן 1,500 בפברואר, יש עודף של 100', () => {
    const rows = titheByMonth(
      [month('2026-01', 1_000_000, 0, 80_000), month('2026-02', 1_200_000, 0, 150_000)],
      1000,
    );
    expect(rows[1].cumulative.remainingAgorot).toBe(0);
    expect(rows[1].cumulative.surplusAgorot).toBe(10_000);
  });

  it('החוב לא מתאפס בתחילת חודש חדש', () => {
    const rows = titheByMonth(
      [month('2026-01', 1_000_000, 0), month('2026-02', 0, 0), month('2026-03', 0, 0)],
      1000,
    );
    expect(rows[2].cumulative.remainingAgorot).toBe(100_000);
  });
});

describe('buildTitheInputs', () => {
  const tx = (
    yearMonth: string,
    type: 'income' | 'expense',
    amountAgorot: number,
    extra: { titheStatus?: 'liable' | 'exempt'; isTithePayment?: boolean } = {},
  ) => ({
    yearMonth,
    type,
    amountAgorot,
    titheStatus: extra.titheStatus ?? ('liable' as const),
    isTithePayment: extra.isTithePayment ?? false,
  });
  const options = {
    lastYearMonth: '2026-02',
    countBusinessTithePayments: true,
    transferMode: 'allow-negative' as const,
  };

  it('מסכם נטו עסק, הכנסה חייבת ומעשר ששולם לכל חודש, ומוסיף את החודש האחרון גם אם ריק', () => {
    const rows = buildTitheInputs(
      [tx('2026-01', 'income', 500_000), tx('2026-01', 'income', 200_000, { titheStatus: 'exempt' }), tx('2026-01', 'expense', 30_000, { isTithePayment: true })],
      [tx('2026-01', 'income', 1_000_000), tx('2026-01', 'expense', 400_000), tx('2026-01', 'expense', 10_000, { isTithePayment: true })],
      options,
    );
    const jan = rows.find((r) => r.yearMonth === '2026-01');
    expect(jan).toEqual({
      yearMonth: '2026-01',
      householdLiableIncomeAgorot: 500_000,
      // 1,000,000 - 400,000 - 10,000 (ההוצאה של המעשר היא גם הוצאה עסקית)
      businessNetAgorot: 590_000,
      paidAgorot: 40_000,
    });
    expect(rows.find((r) => r.yearMonth === '2026-02')).toBeDefined();
  });

  it('לא סופר מעשר שנתן העסק כשההגדרה כבויה', () => {
    const rows = buildTitheInputs([], [tx('2026-01', 'expense', 10_000, { isTithePayment: true })], {
      ...options,
      countBusinessTithePayments: false,
    });
    expect(rows.find((r) => r.yearMonth === '2026-01')?.paidAgorot).toBe(0);
  });

  it('במצב positive-only חודש הפסדי לא מקטין את בסיס המעשר', () => {
    const rows = buildTitheInputs([], [tx('2026-01', 'expense', 300_000)], {
      ...options,
      transferMode: 'positive-only',
    });
    expect(rows.find((r) => r.yearMonth === '2026-01')?.businessNetAgorot).toBe(0);
  });

  it('מתעלם מחודשים אחרי החודש המבוקש', () => {
    const rows = buildTitheInputs([tx('2026-05', 'income', 100_000)], [], options);
    expect(rows.map((r) => r.yearMonth)).toEqual(['2026-02']);
  });
});
