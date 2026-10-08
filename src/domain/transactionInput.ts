import { isValidIsoDate, parseYearMonth, yearMonthOfDate } from './dates';
import { DEFAULT_BUSINESS_ID } from './spaces';
import { MAX_TRANSACTION_AGOROT, parseShekelsToAgorot } from './money';
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type Transaction,
  type TransactionType,
  type TitheStatus,
} from './types';

/** מה שהמשתמש ממלא בטופס. הסכום עדיין טקסט, והתאריך מחרוזת YYYY-MM-DD. */
export interface TransactionDraft {
  type: TransactionType;
  amountText: string;
  date: string;
  counterparty: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note: string;
  titheStatus: TitheStatus;
  isTithePayment: boolean;
}

export type DraftField = 'amount' | 'date' | 'counterparty' | 'category' | 'paymentMethod' | 'note';
export type DraftErrors = Partial<Record<DraftField, string>>;

export const MAX_COUNTERPARTY_LENGTH = 120;
export const MAX_NOTE_LENGTH = 1000;

/**
 * בדיקות תקינות בצד הלקוח. הכללים זהים לאלה שב-firestore.rules,
 * כדי שהמשתמש יקבל הודעה ברורה במקום דחייה שקטה מהשרת.
 */
export function validateDraft(
  draft: TransactionDraft,
  validCategoryIds: readonly string[],
): DraftErrors {
  const errors: DraftErrors = {};

  const amount = parseShekelsToAgorot(draft.amountText);
  if (draft.amountText.trim() === '') {
    errors.amount = 'יש להזין סכום.';
  } else if (amount === null) {
    errors.amount = 'הסכום אינו תקין. לדוגמה: 250 או 1,250.50';
  } else if (amount <= 0) {
    errors.amount = 'הסכום חייב להיות גדול מאפס.';
  } else if (amount > MAX_TRANSACTION_AGOROT) {
    errors.amount = 'הסכום גדול מדי.';
  }

  if (!isValidIsoDate(draft.date)) {
    errors.date = 'יש לבחור תאריך תקין.';
  }

  if (!validCategoryIds.includes(draft.categoryId)) {
    errors.category = 'יש לבחור קטגוריה.';
  }

  if (!Object.prototype.hasOwnProperty.call(PAYMENT_METHOD_LABELS, draft.paymentMethod)) {
    errors.paymentMethod = 'יש לבחור אמצעי תשלום.';
  }

  if (draft.counterparty.trim().length > MAX_COUNTERPARTY_LENGTH) {
    errors.counterparty = `השם ארוך מדי (עד ${MAX_COUNTERPARTY_LENGTH} תווים).`;
  }
  if (draft.note.length > MAX_NOTE_LENGTH) {
    errors.note = `ההערה ארוכה מדי (עד ${MAX_NOTE_LENGTH} תווים).`;
  }

  return errors;
}

export interface BuildContext {
  /** המזהה נוצר פעם אחת בפתיחת הטופס (או הוא מזהה הפעולה הקיימת בעריכה). */
  id: string;
  categoryName: string;
  now: number;
  /** בעריכה: זמן היצירה המקורי. הוא אינו משתנה לעולם. */
  createdAt?: number;
  /** באיזה עסק נרשמת הפעולה (רק בעסק). */
  businessId?: string;
}

/** בונה פעולה מוכנה לשמירה. מניח שהטיוטה עברה validateDraft בהצלחה. */
export function buildTransaction(draft: TransactionDraft, context: BuildContext): Transaction {
  const amountAgorot = parseShekelsToAgorot(draft.amountText);
  if (amountAgorot === null || amountAgorot <= 0) {
    throw new Error('buildTransaction called with an invalid amount');
  }
  const yearMonth = yearMonthOfDate(draft.date);
  const { year, month } = parseYearMonth(yearMonth);

  return {
    id: context.id,
    type: draft.type,
    amountAgorot,
    date: draft.date,
    yearMonth,
    year,
    month,
    counterparty: draft.counterparty.trim(),
    categoryId: draft.categoryId,
    categoryName: context.categoryName,
    paymentMethod: draft.paymentMethod,
    note: draft.note.trim(),
    // הסימון "תשלום מעשר" רלוונטי להוצאות בלבד. בהכנסה הוא תמיד כבוי.
    titheStatus: draft.type === 'income' ? draft.titheStatus : 'liable',
    isTithePayment: draft.type === 'expense' ? draft.isTithePayment : false,
    createdAt: context.createdAt ?? context.now,
    updatedAt: context.now,
    // העסק הראשון נשמר בלי מזהה (כמו נתונים ישנים). עסק נוסף נשמר עם מזהה.
    ...(context.businessId && context.businessId !== DEFAULT_BUSINESS_ID ? { businessId: context.businessId } : {}),
  };
}

/** המרה הפוכה: פעולה קיימת לטיוטה, לפתיחת טופס עריכה. */
export function draftFromTransaction(transaction: Transaction): TransactionDraft {
  const shekels = Math.floor(transaction.amountAgorot / 100);
  const agorot = transaction.amountAgorot % 100;
  return {
    type: transaction.type,
    amountText: agorot === 0 ? String(shekels) : `${shekels}.${String(agorot).padStart(2, '0')}`,
    date: transaction.date,
    counterparty: transaction.counterparty,
    categoryId: transaction.categoryId,
    paymentMethod: transaction.paymentMethod,
    note: transaction.note,
    titheStatus: transaction.titheStatus,
    isTithePayment: transaction.isTithePayment,
  };
}
