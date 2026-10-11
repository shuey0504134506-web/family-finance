/**
 * מטבע התצוגה והחישוב. הסכומים נשמרים תמיד כמספר שלם של יחידות משנה (אגורות/סנטים),
 * ולכן החלפת מטבע משנה רק את הסימן והתצוגה. היא אינה ממירה סכומים קיימים.
 * כל המטבעות הנתמכים מחולקים ל-100 יחידות משנה.
 */
export const CURRENCY_CODES = ['ILS', 'USD', 'EUR', 'GBP'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = 'ILS';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCY_CODES as readonly string[]).includes(value);
}

let current: CurrencyCode = DEFAULT_CURRENCY;

export function getCurrency(): CurrencyCode {
  return current;
}

export function setCurrency(code: CurrencyCode): void {
  current = code;
}

export function currencySymbol(code: CurrencyCode = current): string {
  return CURRENCY_SYMBOLS[code];
}

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  ILS: 'שקל חדש',
  USD: 'דולר אמריקאי',
  EUR: 'אירו',
  GBP: 'לירה שטרלינג',
};

/** מטבע הפעולה. פעולה בלי שדה מטבע נרשמה במטבע הראשי (ברירת המחדל של החשבון). */
export function currencyOf(item: { currency?: CurrencyCode }): CurrencyCode {
  return item.currency ?? current;
}

/** האם הפעולה במטבע הראשי. רק פעולות כאלה נכנסות לתקציב, למעשרות ולסיכום הראשי. */
export function isPrimaryCurrency(item: { currency?: CurrencyCode }): boolean {
  return currencyOf(item) === current;
}

export interface CurrencyTotals {
  currency: CurrencyCode;
  incomeAgorot: number;
  expenseAgorot: number;
}

/** סיכום הכנסות והוצאות לכל מטבע שאינו הראשי, ממוין לפי סדר המטבעות הנתמכים. */
export function foreignTotals(
  items: ReadonlyArray<{ currency?: CurrencyCode; type: 'income' | 'expense'; amountAgorot: number }>,
): CurrencyTotals[] {
  const map = new Map<CurrencyCode, CurrencyTotals>();
  for (const t of items) {
    const code = currencyOf(t);
    if (code === current) continue;
    const row = map.get(code) ?? { currency: code, incomeAgorot: 0, expenseAgorot: 0 };
    if (t.type === 'income') row.incomeAgorot += t.amountAgorot;
    else row.expenseAgorot += t.amountAgorot;
    map.set(code, row);
  }
  return CURRENCY_CODES.filter((c) => map.has(c)).map((c) => map.get(c) as CurrencyTotals);
}

/** שערים: כמה יחידות מכל מטבע שוות למטבע בסיס אחד (ILS=1). */
export type Rates = Record<CurrencyCode, number>;

/** המרת סכום (באגורות/סנטים) ממטבע למטבע לפי השערים. מעגל למספר שלם. */
export function convertAgorot(amount: number, from: CurrencyCode, to: CurrencyCode, rates: Rates): number {
  if (from === to) return amount;
  const result = Math.round((amount * rates[to]) / rates[from]);
  return result === 0 ? 0 : result;
}
