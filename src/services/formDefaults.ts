import { isCurrencyCode, type CurrencyCode } from '../domain/currency';
import { type PaymentChoice, choiceKey, parseChoiceKey } from '../domain/payment';
import { PAYMENT_METHOD_LABELS, type Scope, type TransactionType } from '../domain/types';

/**
 * ברירות מחדל לטופס ההוספה, בנפרד לכל אחד מארבעת המקרים: הכנסה/הוצאה במשק הבית, והכנסה/הוצאה בעסק.
 * נשמרות במכשיר בלבד (בלי שינוי בכללי האבטחה). חסר = המטבע הראשי ומזומן.
 */
export interface FormDefault {
  currency?: CurrencyCode;
  payment?: PaymentChoice;
}
export type FormDefaults = Partial<Record<string, FormDefault>>;

const KEY = 'ff.formDefaults.v2';

export const defaultsKey = (scope: Scope, type: TransactionType): string => `${scope}.${type}`;

export function parseFormDefaults(raw: string | null): FormDefaults {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as Record<string, { currency?: unknown; payment?: unknown } | null> | null;
    if (!p || typeof p !== 'object') return {};
    const out: FormDefaults = {};
    for (const scope of ['business', 'household']) {
      for (const type of ['income', 'expense']) {
        const k = `${scope}.${type}`;
        const v = p[k];
        if (!v || typeof v !== 'object') continue;
        const entry: FormDefault = {};
        if (isCurrencyCode(v.currency)) entry.currency = v.currency;
        if (typeof v.payment === 'string') {
          const choice = parseChoiceKey(v.payment);
          if (choice.method === 'other' ? !!choice.label : Object.prototype.hasOwnProperty.call(PAYMENT_METHOD_LABELS, choice.method)) {
            entry.payment = choice;
          }
        }
        if (entry.currency || entry.payment) out[k] = entry;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function readFormDefaults(): FormDefaults {
  try {
    return parseFormDefaults(localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

export function writeFormDefaults(value: FormDefaults): void {
  const serial: Record<string, { currency?: CurrencyCode; payment?: string }> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!v) continue;
    serial[k] = { ...(v.currency ? { currency: v.currency } : {}), ...(v.payment ? { payment: choiceKey(v.payment) } : {}) };
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(serial));
  } catch {
    // אחסון חסום: ההעדפה לא תישמר
  }
}
