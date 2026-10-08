import type { Agorot } from './money';
import { toYearMonth } from './dates';
import { totalsByCategory, totalsOf, transferFromBusinesses } from './summary';
import type { BusinessTransferMode, Scope, Transaction } from './types';

type Tx = Pick<Transaction, 'type' | 'amountAgorot' | 'categoryId' | 'yearMonth' | 'businessId'>;

export interface PeriodTotals {
  incomeAgorot: Agorot;
  expenseAgorot: Agorot;
  balanceAgorot: Agorot;
  /** רק במשק הבית: ההכנסה (או ההפסד) שעברה מהעסק, כבר כלולה ב-incomeAgorot */
  fromBusinessAgorot: Agorot;
}

export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => toYearMonth(year, i + 1));
}

const inMonths = <T extends Tx>(items: readonly T[], months: ReadonlySet<string>) =>
  items.filter((t) => months.has(t.yearMonth));

/**
 * סיכום חודש אחד. למשק הבית נוספת ההעברה מהעסק, וכל חודש מחושב בנפרד
 * (חשוב כשהגדרת ההעברה היא "רק רווח": חודש הפסדי לא מקזז חודש רווחי).
 */
export function monthTotals(
  scope: Scope,
  household: readonly Tx[],
  business: readonly Tx[],
  yearMonth: string,
  mode: BusinessTransferMode,
): PeriodTotals {
  return periodTotals(scope, household, business, [yearMonth], mode);
}

export function periodTotals(
  scope: Scope,
  household: readonly Tx[],
  business: readonly Tx[],
  yearMonths: readonly string[],
  mode: BusinessTransferMode,
): PeriodTotals {
  if (scope === 'business') {
    const t = totalsOf(inMonths(business, new Set(yearMonths)));
    return {
      incomeAgorot: t.incomeAgorot,
      expenseAgorot: t.expenseAgorot,
      balanceAgorot: t.balanceAgorot,
      fromBusinessAgorot: 0,
    };
  }
  let fromBusiness = 0;
  for (const ym of yearMonths) {
    fromBusiness += transferFromBusinesses(
      business.filter((t) => t.yearMonth === ym),
      mode,
    );
  }
  const own = totalsOf(inMonths(household, new Set(yearMonths)));
  const income = own.incomeAgorot + fromBusiness;
  return {
    incomeAgorot: income,
    expenseAgorot: own.expenseAgorot,
    balanceAgorot: income - own.expenseAgorot,
    fromBusinessAgorot: fromBusiness,
  };
}

export interface CategoryShare {
  categoryId: string;
  amountAgorot: Agorot;
  /** אחוז מהסך, ספרה אחת אחרי הנקודה */
  percent: number;
}

/** פירוט לפי קטגוריה, מהגדולה לקטנה, עם אחוז מהסך. */
export function categoryBreakdown(
  items: readonly Tx[],
  yearMonths: readonly string[],
  type: Transaction['type'],
): CategoryShare[] {
  const totals = totalsByCategory(inMonths(items, new Set(yearMonths)), type);
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([categoryId, amountAgorot]) => ({
      categoryId,
      amountAgorot,
      percent: sum > 0 ? Math.round((amountAgorot / sum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amountAgorot - a.amountAgorot);
}
