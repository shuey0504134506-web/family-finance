import { PAYMENT_METHOD_LABELS, type PaymentMethod, type TransactionType } from './types';

/**
 * אמצעי תשלום / צורת קבלה. בהכנסה ברירת המחדל היא שלוש אפשרויות בלבד, ובהוצאה חמש.
 * אפשר להוסיף אמצעים משלך (לכל סוג בנפרד): הם נשמרים בפעולה כ-'other' עם שם (paymentLabel).
 */
export const BUILTIN_METHODS: Record<TransactionType, readonly PaymentMethod[]> = {
  income: ['cash', 'transfer', 'check'],
  expense: ['cash', 'credit', 'direct', 'check', 'transfer'],
};

export const MAX_PAYMENT_LABEL = 30;
export const MAX_CUSTOM_METHODS = 12;

export interface PaymentChoice {
  method: PaymentMethod;
  /** רק כש-method הוא 'other' */
  label?: string;
}

export const choiceKey = (c: PaymentChoice): string => (c.method === 'other' ? `other:${c.label ?? ''}` : c.method);

export function parseChoiceKey(key: string): PaymentChoice {
  if (key.startsWith('other:')) return { method: 'other', label: key.slice('other:'.length) };
  return { method: key as PaymentMethod };
}

export const choiceText = (c: PaymentChoice): string =>
  c.method === 'other' ? c.label || PAYMENT_METHOD_LABELS.other : PAYMENT_METHOD_LABELS[c.method];

/** שם התצוגה של אמצעי התשלום בפעולה. */
export function paymentLabelOf(t: { paymentMethod: PaymentMethod; paymentLabel?: string }): string {
  return choiceText({ method: t.paymentMethod, label: t.paymentLabel });
}

/** האפשרויות להצגה: המובנות, אחריהן האישיות, ובעריכה גם הערך הנוכחי אם אינו ברשימה. */
export function choicesFor(type: TransactionType, custom: readonly string[], current?: PaymentChoice): PaymentChoice[] {
  const list: PaymentChoice[] = [
    ...BUILTIN_METHODS[type].map((method) => ({ method })),
    ...custom.map((label) => ({ method: 'other' as const, label })),
  ];
  if (current && !list.some((c) => choiceKey(c) === choiceKey(current))) list.push(current);
  return list;
}

/** בדיקת שם לאמצעי חדש. מחזיר הודעת שגיאה או null. */
export function validateCustomMethod(name: string, existing: readonly string[], type: TransactionType): string | null {
  const t = name.trim();
  if (!t) return 'יש להזין שם לאמצעי.';
  if (t.length > MAX_PAYMENT_LABEL) return `השם ארוך מדי (עד ${MAX_PAYMENT_LABEL} תווים).`;
  if (existing.length >= MAX_CUSTOM_METHODS) return `אפשר להוסיף עד ${MAX_CUSTOM_METHODS} אמצעים.`;
  const lower = t.toLowerCase();
  const builtin = BUILTIN_METHODS[type].map((m) => PAYMENT_METHOD_LABELS[m].toLowerCase());
  if (builtin.includes(lower) || existing.some((e) => e.trim().toLowerCase() === lower)) return 'כבר קיים אמצעי בשם הזה.';
  return null;
}
