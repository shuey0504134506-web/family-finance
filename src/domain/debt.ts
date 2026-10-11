import { CURRENCY_CODES, currencyOf, type CurrencyCode } from './currency';
import { isValidIsoDate } from './dates';
import { MAX_TRANSACTION_AGOROT } from './money';
import { MAX_PAYMENT_LABEL } from './payment';
import type { PaymentMethod, Scope } from './types';

/**
 * חובות: "אני חייב" (owe) או "חייבים לי" (owed). הם ספר חשבונות נפרד: החוב ותשלומיו
 * אינם הכנסות או הוצאות, ולכן לא נספרים בסיכומים, בתקציב ובמעשרות (ראו docs/ARCHITECTURE.md).
 */
export type DebtDirection = 'owe' | 'owed';

export interface DebtPayment {
  id: string;
  amountAgorot: number;
  /** YYYY-MM-DD */
  date: string;
}

export interface Debt {
  id: string;
  scope: Scope;
  /** רק בעסק נוסף. חסר = העסק הראשון. */
  businessId?: string;
  direction: DebtDirection;
  /** שם הנושה או החייב */
  name: string;
  /** סכום החוב המקורי */
  amountAgorot: number;
  currency?: CurrencyCode;
  category: string;
  paymentMethod: PaymentMethod;
  paymentLabel?: string;
  /** מתי נוצר החוב */
  date: string;
  dueDate?: string;
  note: string;
  payments: DebtPayment[];
  createdAt: number;
  updatedAt: number;
}

export const MAX_DEBT_NAME = 80;
export const MAX_DEBT_CATEGORY = 40;
export const MAX_DEBT_NOTE = 1000;
export const MAX_DEBT_PAYMENTS = 500;

export const DEFAULT_DEBT_CATEGORIES = [
  'הלוואה בנקאית',
  'הלוואה מחבר / משפחה',
  'ספק / אשראי עסקי',
  'כרטיס אשראי',
  'משכנתא',
  'אחר',
] as const;

export const paidAgorot = (d: Pick<Debt, 'payments'>): number => d.payments.reduce((sum, p) => sum + p.amountAgorot, 0);
export const balanceAgorot = (d: Pick<Debt, 'amountAgorot' | 'payments'>): number => d.amountAgorot - paidAgorot(d);
export const isSettled = (d: Pick<Debt, 'amountAgorot' | 'payments'>): boolean => balanceAgorot(d) <= 0;

export interface DebtTotals {
  currency: CurrencyCode;
  /** יתרה פתוחה שאני חייב */
  oweAgorot: number;
  /** יתרה פתוחה שחייבים לי */
  owedAgorot: number;
}

/** סיכום יתרות פתוחות לכל מטבע (חובות ששולמו במלואם לא נספרים). */
export function debtTotals(debts: readonly Debt[]): DebtTotals[] {
  const map = new Map<CurrencyCode, DebtTotals>();
  for (const d of debts) {
    const balance = balanceAgorot(d);
    if (balance <= 0) continue;
    const code = currencyOf(d);
    const row = map.get(code) ?? { currency: code, oweAgorot: 0, owedAgorot: 0 };
    if (d.direction === 'owe') row.oweAgorot += balance;
    else row.owedAgorot += balance;
    map.set(code, row);
  }
  return CURRENCY_CODES.filter((c) => map.has(c)).map((c) => map.get(c) as DebtTotals);
}

/** קטגוריות להצגה: ברירות המחדל, ואחריהן כאלה שכבר נוספו בחובות קיימים. */
export function debtCategories(debts: readonly Pick<Debt, 'category'>[]): string[] {
  const list: string[] = [...DEFAULT_DEBT_CATEGORIES];
  for (const d of debts) if (d.category && !list.includes(d.category)) list.push(d.category);
  return list;
}

export interface DebtDraftErrors {
  name?: string;
  amount?: string;
  category?: string;
  date?: string;
  dueDate?: string;
  note?: string;
}

/** בדיקות לטופס חוב. הסכום הוא אגורות כבר מנותחות (null = לא תקין). */
export function validateDebt(input: {
  name: string;
  amountAgorot: number | null;
  category: string;
  date: string;
  dueDate: string;
  note: string;
  paymentLabel?: string;
}): DebtDraftErrors {
  const errors: DebtDraftErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'יש להזין שם.';
  else if (name.length > MAX_DEBT_NAME) errors.name = `השם ארוך מדי (עד ${MAX_DEBT_NAME} תווים).`;
  if (input.amountAgorot === null || input.amountAgorot <= 0) errors.amount = 'יש להזין סכום תקין.';
  else if (input.amountAgorot > MAX_TRANSACTION_AGOROT) errors.amount = 'הסכום גדול מדי.';
  const category = input.category.trim();
  if (!category) errors.category = 'יש לבחור קטגוריה.';
  else if (category.length > MAX_DEBT_CATEGORY) errors.category = `השם ארוך מדי (עד ${MAX_DEBT_CATEGORY} תווים).`;
  if (!isValidIsoDate(input.date)) errors.date = 'יש לבחור תאריך תקין.';
  if (input.dueDate && !isValidIsoDate(input.dueDate)) errors.dueDate = 'תאריך היעד אינו תקין.';
  if (input.note.length > MAX_DEBT_NOTE) errors.note = `ההערה ארוכה מדי (עד ${MAX_DEBT_NOTE} תווים).`;
  if (input.paymentLabel !== undefined && input.paymentLabel.length > MAX_PAYMENT_LABEL) errors.note = errors.note ?? 'שם אמצעי התשלום ארוך מדי.';
  return errors;
}

/** בדיקת תשלום על חוב: חיובי, ולא יותר מהיתרה. מחזיר הודעת שגיאה או null. */
export function validatePayment(debt: Pick<Debt, 'amountAgorot' | 'payments'>, amountAgorot: number | null, date: string): string | null {
  if (amountAgorot === null || amountAgorot <= 0) return 'יש להזין סכום תקין.';
  if (amountAgorot > balanceAgorot(debt)) return 'הסכום גדול מיתרת החוב.';
  if (!isValidIsoDate(date)) return 'יש לבחור תאריך תקין.';
  if (debt.payments.length >= MAX_DEBT_PAYMENTS) return 'נרשמו יותר מדי תשלומים בחוב הזה.';
  return null;
}
