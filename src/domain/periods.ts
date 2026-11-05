import type { Agorot } from './money';
import { toYearMonth } from './dates';
import { totalsByCategory, totalsOf, transferFromBusinesses } from './summary';
import { normalizeText } from './fuzzy';
import { paymentLabelOf } from './payment';
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

export interface LabelShare {
  id: string;
  label: string;
  amountAgorot: Agorot;
  percent: number;
}

type ExpenseTx = Tx & Pick<Transaction, 'counterparty' | 'paymentMethod' | 'paymentLabel'>;

/** הוצאות לפי מפתח כלשהו (צורת תשלום, בית עסק), מהגדול לקטן, עם אחוז מהסך. עודף מעבר ל-`limit` מתאחד לשורה "אחרים". */
function expenseShares(
  items: readonly ExpenseTx[],
  yearMonths: readonly string[],
  keyOf: (t: ExpenseTx) => { id: string; label: string },
  limit: number,
): LabelShare[] {
  const months = new Set(yearMonths);
  const totals = new Map<string, { label: string; amountAgorot: number }>();
  let sum = 0;
  for (const t of items) {
    if (t.type !== 'expense' || !months.has(t.yearMonth)) continue;
    const { id, label } = keyOf(t);
    const row = totals.get(id);
    if (row) row.amountAgorot += t.amountAgorot;
    else totals.set(id, { label, amountAgorot: t.amountAgorot });
    sum += t.amountAgorot;
  }
  const rows = [...totals.entries()]
    .map(([id, v]) => ({ id, label: v.label, amountAgorot: v.amountAgorot }))
    .sort((a, b) => b.amountAgorot - a.amountAgorot || (a.label < b.label ? -1 : 1));
  const shown = rows.length > limit ? rows.slice(0, limit) : rows;
  if (rows.length > limit) {
    const rest = rows.slice(limit).reduce((a, r) => a + r.amountAgorot, 0);
    shown.push({ id: '__others__', label: 'אחרים', amountAgorot: rest });
  }
  return shown.map((r) => ({ ...r, percent: sum > 0 ? Math.round((r.amountAgorot / sum) * 1000) / 10 : 0 }));
}

/** הוצאות לפי צורת תשלום (מזומן, אשראי, הוראת קבע, וכן אמצעים שהמשתמש הוסיף). */
export function paymentBreakdown(items: readonly ExpenseTx[], yearMonths: readonly string[]): LabelShare[] {
  return expenseShares(
    items,
    yearMonths,
    (t) => {
      const label = paymentLabelOf(t);
      return { id: normalizeText(label) || label, label };
    },
    20,
  );
}

/** הוצאות לפי בית עסק (שם בית העסק או מי ששולם לו). פעולה בלי שם נספרת תחת "ללא שם". */
export function merchantBreakdown(items: readonly ExpenseTx[], yearMonths: readonly string[], limit = 10): LabelShare[] {
  return expenseShares(
    items,
    yearMonths,
    (t) => {
      const name = t.counterparty.trim();
      return name ? { id: normalizeText(name) || name, label: name } : { id: '__none__', label: 'ללא שם' };
    },
    limit,
  );
}
