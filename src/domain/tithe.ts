import { applyBasisPoints, sumAgorot, type Agorot } from './money';
import type { Transaction } from './types';

/**
 * מעשרות. הנוסחה כאן מבודדת בכוונה כדי שיהיה קל לשנות אותה.
 * - הכנסות העסק עצמן לא נכנסות לחישוב, רק הנטו שעבר למשק הבית.
 * - החוב מצטבר מחודש לחודש ואינו מתאפס.
 */

export interface TitheBalance {
  liableIncomeAgorot: Agorot;
  requiredAgorot: Agorot;
  paidAgorot: Agorot;
  /** נותר לתת (0 אם אין חוב) */
  remainingAgorot: Agorot;
  /** עודף שניתן (0 אם אין עודף) */
  surplusAgorot: Agorot;
}

export function computeTitheBalance(
  liableIncomeAgorot: Agorot,
  paidAgorot: Agorot,
  bps: number,
): TitheBalance {
  const requiredAgorot = applyBasisPoints(liableIncomeAgorot, bps);
  const difference = requiredAgorot - paidAgorot;
  return {
    liableIncomeAgorot,
    requiredAgorot,
    paidAgorot,
    remainingAgorot: Math.max(0, difference),
    surplusAgorot: Math.max(0, -difference),
  };
}

type TitheIncomeTx = Pick<Transaction, 'type' | 'amountAgorot' | 'titheStatus'>;
type TithePaymentTx = Pick<Transaction, 'type' | 'amountAgorot' | 'isTithePayment'>;

/**
 * הכנסה החייבת במעשר בחודש: הכנסות משק הבית שלא סומנו "פטורה",
 * ועוד הנטו שעבר מהעסק (שחייב במעשר).
 */
export function titheLiableIncome(
  householdTransactions: readonly TitheIncomeTx[],
  businessTransferAgorot: Agorot,
): Agorot {
  const own = sumAgorot(
    householdTransactions
      .filter((t) => t.type === 'income' && t.titheStatus === 'liable')
      .map((t) => t.amountAgorot),
  );
  return own + businessTransferAgorot;
}

/**
 * מעשר ששולם בחודש: הוצאות משק הבית שסומנו "מעשר שנתתי",
 * ואופציונלית גם הוצאות עסק שסומנו כך (נקודת החלטה, ראו הגדרות).
 */
export function tithePaid(
  householdTransactions: readonly TithePaymentTx[],
  businessTransactions: readonly TithePaymentTx[],
  countBusinessPayments: boolean,
): Agorot {
  const fromHousehold = sumAgorot(
    householdTransactions
      .filter((t) => t.type === 'expense' && t.isTithePayment)
      .map((t) => t.amountAgorot),
  );
  if (!countBusinessPayments) return fromHousehold;
  const fromBusiness = sumAgorot(
    businessTransactions
      .filter((t) => t.type === 'expense' && t.isTithePayment)
      .map((t) => t.amountAgorot),
  );
  return fromHousehold + fromBusiness;
}

export interface TitheMonthInput {
  yearMonth: string;
  liableIncomeAgorot: Agorot;
  paidAgorot: Agorot;
}

export interface TitheMonthRow {
  yearMonth: string;
  /** מה שנוסף ושולם בחודש עצמו */
  month: TitheBalance;
  /** המצב המצטבר מתחילת הנתונים ועד סוף החודש הזה */
  cumulative: TitheBalance;
}

/**
 * שורה לכל חודש, עם יתרה מצטברת. העיגול נעשה פעם אחת על הסכום המצטבר,
 * כדי שלא יצטברו סטיות עיגול.
 */
export function titheByMonth(months: readonly TitheMonthInput[], bps: number): TitheMonthRow[] {
  const sorted = [...months].sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));
  let runningLiable = 0;
  let runningPaid = 0;
  return sorted.map((m) => {
    runningLiable += m.liableIncomeAgorot;
    runningPaid += m.paidAgorot;
    return {
      yearMonth: m.yearMonth,
      month: computeTitheBalance(m.liableIncomeAgorot, m.paidAgorot, bps),
      cumulative: computeTitheBalance(runningLiable, runningPaid, bps),
    };
  });
}
