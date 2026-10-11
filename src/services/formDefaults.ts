import { isCurrencyCode, type CurrencyCode } from '../domain/currency';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../domain/types';

/**
 * ברירות מחדל לטופס ההוספה (מטבע ואמצעי תשלום). נשמרות במכשיר בלבד, כך שאין צורך בשינוי
 * בכללי האבטחה בשרת, ולכל מכשיר אפשר לקבוע ברירת מחדל משלו. חסר = המטבע הראשי ומזומן.
 */
export interface FormDefaults {
  currency?: CurrencyCode;
  paymentMethod?: PaymentMethod;
}

const KEY = 'ff.formDefaults.v1';

export function parseFormDefaults(raw: string | null): FormDefaults {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as { currency?: unknown; paymentMethod?: unknown } | null;
    const out: FormDefaults = {};
    if (p && isCurrencyCode(p.currency)) out.currency = p.currency;
    if (p && typeof p.paymentMethod === 'string' && Object.prototype.hasOwnProperty.call(PAYMENT_METHOD_LABELS, p.paymentMethod)) {
      out.paymentMethod = p.paymentMethod as PaymentMethod;
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
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // אחסון חסום: ההעדפה לא תישמר
  }
}
