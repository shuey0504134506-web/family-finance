import { applyBasisPoints, sumAgorot, type Agorot } from './money';
import type { Transaction } from './types';

/**
 * מעשרות. הנוסחה כאן מבודדת בכוונה כדי שיהיה קל לשנות אותה.
 *
 * - הכנסות העסק הגולמיות לא נכנסות לחישוב, רק הנטו של העסק שעבר למשק הבית.
 * - החוב מצטבר מחודש לחודש ואינו מתאפס.
 * - הכנסה חייבת = הכנסות משק הבית החייבות + נטו העסק המצטבר.
 * - הפסד עסקי מקטין רק את החלק שנובע מנטו העסק. הוא מקזז רווח עסקי של חודשים קודמים,
 *   אך אינו מקטין מעשר על הכנסות אחרות של משק הבית, ואינו יורד מתחת לאפס.
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
  // רשת ביטחון: אי אפשר "לחייב" מעשר שלילי, וגם לא להציג הפסד כ"עודף מעשרות".
  const requiredAgorot = Math.max(0, applyBasisPoints(liableIncomeAgorot, bps));
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
 * הכנסות משק הבית החייבות במעשר בחודש: הכנסות שלא סומנו "פטורה".
 * נטו העסק אינו כלול כאן, והוא נכנס לחישוב בנפרד (ראו titheByMonth).
 */
export function householdTitheLiableIncome(householdTransactions: readonly TitheIncomeTx[]): Agorot {
  return sumAgorot(
    householdTransactions
      .filter((t) => t.type === 'income' && t.titheStatus === 'liable')
      .map((t) => t.amountAgorot),
  );
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
  /** הכנסות משק הבית החייבות במעשר באותו חודש */
  householdLiableIncomeAgorot: Agorot;
  /** נטו העסק שעבר למשק הבית באותו חודש. שלילי כשהעסק הפסיד. */
  businessNetAgorot: Agorot;
  /** מעשר ששולם באותו חודש */
  paidAgorot: Agorot;
}

export interface TitheMonthRow {
  yearMonth: string;
  /** מה שנוסף ושולם בחודש עצמו */
  month: TitheBalance;
  /** המצב המצטבר מתחילת הנתונים ועד סוף החודש הזה */
  cumulative: TitheBalance;
  /** נטו העסק המצטבר עד סוף החודש (יכול להיות שלילי), לפני החסם על אפס */
  cumulativeBusinessNetAgorot: Agorot;
}

/**
 * שורה לכל חודש, עם יתרה מצטברת. העיגול נעשה פעם אחת על הסכום המצטבר,
 * כדי שלא יצטברו סטיות עיגול.
 *
 * ההכנסה החייבת המצטברת = הכנסות משק הבית החייבות (מצטבר)
 *                         + max(0, נטו העסק המצטבר).
 * כך הפסד עסקי מקזז רק רווח עסקי, ואינו מקטין מעשר על הכנסות אחרות.
 */
export function titheByMonth(months: readonly TitheMonthInput[], bps: number): TitheMonthRow[] {
  const sorted = [...months].sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));
  let runningHousehold = 0;
  let runningBusinessNet = 0;
  let runningPaid = 0;
  return sorted.map((m) => {
    runningHousehold += m.householdLiableIncomeAgorot;
    runningBusinessNet += m.businessNetAgorot;
    runningPaid += m.paidAgorot;
    return {
      yearMonth: m.yearMonth,
      month: computeTitheBalance(
        m.householdLiableIncomeAgorot + m.businessNetAgorot,
        m.paidAgorot,
        bps,
      ),
      cumulative: computeTitheBalance(
        runningHousehold + Math.max(0, runningBusinessNet),
        runningPaid,
        bps,
      ),
      cumulativeBusinessNetAgorot: runningBusinessNet,
    };
  });
}
