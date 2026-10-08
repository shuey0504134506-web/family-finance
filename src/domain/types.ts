/** טיפוסים משותפים לכל האפליקציה. אין כאן לוגיקה ואין תלות ב-Firebase. */

import { DEFAULT_ANNUAL_MODE, type AnnualMode } from './annual';
import { DEFAULT_CURRENCY, type CurrencyCode } from './currency';

export type AccountMode = 'both' | 'business' | 'household';
export type Scope = 'business' | 'household';
export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'credit' | 'direct' | 'check' | 'transfer';
export type TitheStatus = 'liable' | 'exempt';

/**
 * איך נטו העסק הופך להכנסה במשק הבית.
 * - allow-negative: גם הפסד עובר למשק הבית, כהכנסה שלילית (ברירת מחדל, לפי החלטת בעל האפליקציה).
 * - positive-only: חודש הפסדי לא עובר למשק הבית.
 * נשמר כהגדרה כדי שאפשר יהיה לשנות את הנוסחה בלי לגעת בקוד החישוב.
 */
export type BusinessTransferMode = 'positive-only' | 'allow-negative';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'מזומן',
  credit: 'אשראי',
  direct: 'דיירקט',
  check: "צ'ק",
  transfer: 'העברה בנקאית',
};

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  accountMode: AccountMode;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  /** אחוז המעשר בנקודות בסיס: 1000 = 10%. */
  titheBps: number;
  /** האם הוצאה עסקית שסומנה "מעשר" נספרת כמעשר ששולם. נקודת החלטה פתוחה. */
  countBusinessTithePayments: boolean;
  businessTransferMode: BusinessTransferMode;
  /** מטבע התצוגה והחישוב. החלפה אינה ממירה סכומים קיימים. */
  currency: CurrencyCode;
  /** שיטת חישוב שנה בסיכום השנתי ובתקציב השנתי: קלנדרי, או 12 חודשים מתחילת התיעוד. */
  annualMode: AnnualMode;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  titheBps: 1000,
  countBusinessTithePayments: true,
  businessTransferMode: 'allow-negative',
  currency: DEFAULT_CURRENCY,
  annualMode: DEFAULT_ANNUAL_MODE,
  updatedAt: 0,
};

/** פעולה כספית (הכנסה או הוצאה). הסכום תמיד באגורות שלמות וחיובי. */
export interface Transaction {
  id: string;
  type: TransactionType;
  amountAgorot: number;
  /** YYYY-MM-DD (תאריך מקומי, ללא אזור זמן) */
  date: string;
  /** YYYY-MM, נגזר מהתאריך ונשמר לצורך שאילתות ואכיפת חוקים */
  yearMonth: string;
  year: number;
  month: number;
  /** שם העסק/ספק או מקור ההכנסה */
  counterparty: string;
  categoryId: string;
  categoryName: string;
  paymentMethod: PaymentMethod;
  note: string;
  titheStatus: TitheStatus;
  /** האם הפעולה היא תשלום מעשר (רלוונטי להוצאות) */
  isTithePayment: boolean;
  createdAt: number;
  updatedAt: number;
  /** באיזה עסק נרשמה הפעולה. חסר = העסק הראשון (נתונים שנשמרו לפני שנוספה תמיכה בכמה עסקים). */
  businessId?: string;
}

/** פעולה כפי שמגיעה מ-Firestore, עם מידע על מצב הסנכרון שלה. */
export interface TransactionRecord extends Transaction {
  /** true = נשמרה במכשיר וממתינה לאישור מהשרת */
  pendingSync: boolean;
}

export interface Category {
  id: string;
  scope: Scope;
  type: TransactionType;
  name: string;
  active: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  /** רק לקטגוריות עסק. חסר = העסק הראשון. */
  businessId?: string;
}

/**
 * תקציב לקטגוריית הוצאה (או תקציב כללי של תחום).
 * בלי period: תקציב חודשי קבוע, תקף לכל חודש; מזהה המסמך הוא מזהה הקטגוריה.
 * period='YYYY-MM': תקציב לחודש מסוים בלבד, שדורס את הקבוע באותו חודש; מזהה המסמך `${categoryId}@${period}`.
 * period='YYYY': תקציב שנתי לאותה שנה; מזהה המסמך `${categoryId}@${period}`.
 */
export interface Budget {
  id: string;
  scope: Scope;
  categoryId: string;
  amountAgorot: number;
  createdAt: number;
  updatedAt: number;
  /** חסר = תקציב חודשי קבוע. 'YYYY-MM' = חודש מסוים. 'YYYY' = שנה. */
  period?: string;
  /** רק לתקציבי עסק. חסר = העסק הראשון. */
  businessId?: string;
}
