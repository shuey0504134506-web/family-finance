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
