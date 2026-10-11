import { convertAgorot, currencyOf, getCurrency, type Rates } from './currency';
import type { TransactionRecord } from './types';

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
