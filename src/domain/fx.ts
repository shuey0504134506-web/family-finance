import { convertAgorot, currencyOf, getCurrency, type Rates } from './currency';
import { formatDisplayDate, todayIso } from './dates';
import type { Budget, TransactionRecord } from './types';

/**
 * המרה אוטומטית של פעולות במטבע זר למטבע הראשי, לפי שער יום הפעולה.
 * ההמרה נעשית בזמן הקריאה בלבד: בבסיס הנתונים נשמרים תמיד הסכום והמטבע המקוריים.
 */

/** שווי הפעולה במטבע הראשי, או undefined אם הפעולה במטבע זר ועדיין אין שער ליום שלה. */
export function mainAmountOf(
  t: { currency?: TransactionRecord['currency']; amountAgorot: number },
  rates: Rates | undefined,
): number | undefined {
  const from = currencyOf(t);
  const main = getCurrency();
  if (from === main) return t.amountAgorot;
  if (!rates) return undefined;
  return convertAgorot(t.amountAgorot, from, main, rates);
}

export interface Converted {
  /** לחישובים: פעולות במטבע הראשי, ובנוסף פעולות זרות שהומרו (הסכום כבר במטבע הראשי). */
  items: TransactionRecord[];
  /** לרשימות: כל הפעולות במטבע המקורי, וב-mainAgorot השווי שהומר. */
  all: TransactionRecord[];
}

export function applyConversion(
  all: readonly TransactionRecord[],
  ratesOf: (date: string) => Rates | undefined,
): Converted {
  const items: TransactionRecord[] = [];
  const list: TransactionRecord[] = [];
  const main = getCurrency();
  for (const t of all) {
    if (currencyOf(t) === main) {
      items.push(t);
      list.push(t);
      continue;
    }
    const value = mainAmountOf(t, ratesOf(t.date));
    if (value === undefined) {
      list.push(t);
      continue;
    }
    list.push({ ...t, mainAgorot: value });
    items.push({ ...t, amountAgorot: value, currency: main });
  }
  return { items, all: list };
}

/** התאריכים שחסר להם שער: של פעולות במטבע זר. */
export function datesNeedingRates(all: readonly { date: string; currency?: TransactionRecord['currency'] }[]): string[] {
  const main = getCurrency();
  const dates = new Set<string>();
  for (const t of all) if (currencyOf(t) !== main) dates.add(t.date);
  return [...dates];
}

/**
 * תקציבים במטבע הראשי: תקציב שנקבע במטבע אחר מומר לפי השער הנתון (העדכני).
 * המסמך השמור לא משתנה. בלי שער, תקציב במטבע אחר מושמט במקום לנחש.
 */
export function convertBudgets(budgets: readonly Budget[], rates: Rates | undefined): Budget[] {
  const main = getCurrency();
  const out: Budget[] = [];
  for (const b of budgets) {
    const from = currencyOf(b);
    if (from === main) {
      out.push(b);
    } else if (rates) {
      out.push({ ...b, amountAgorot: convertAgorot(b.amountAgorot, from, main, rates), currency: main });
    }
  }
  return out;
}

/**
 * הערה ברשימה על פעולה שהומרה למטבע הראשי:
 * - פעולה שנרשמה לפני שהמטבע הראשי הוחלף: ההמרה נעשתה בהחלפה, ולכן "שונה ביום <יום ההחלפה>".
 * - פעולה שהוזנה באותו יום שבו התרחשה: "הומר ביום ההכנסה/ההוצאה".
 * - פעולה שהוזנה למפרע: "הומר לפי שער יום <תאריך הפעולה>".
 */
export function conversionNote(
  item: { date: string; createdAt: number },
  isIncome: boolean,
  currencyChangedAt?: number,
): string {
  const day = formatDisplayDate(item.date);
  if (currencyChangedAt !== undefined && item.createdAt < currencyChangedAt) {
    return `שונה ביום ${formatDisplayDate(todayIso(new Date(currencyChangedAt)))} לסכום`;
  }
  if (todayIso(new Date(item.createdAt)) === item.date) {
    return isIncome ? `הומר ביום ההכנסה (${day}) לסכום` : `הומר ביום ההוצאה (${day}) לסכום`;
  }
  return `הומר לפי שער יום ${day} לסכום`;
}
