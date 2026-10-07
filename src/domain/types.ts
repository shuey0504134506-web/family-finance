/** טיפוסים משותפים לכל האפליקציה. אין כאן לוגיקה ואין תלות ב-Firebase. */

export type AccountMode = 'both' | 'business' | 'household';
export type Scope = 'business' | 'household';
export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'credit' | 'direct' | 'check' | 'transfer';
export type TitheStatus = 'liable' | 'exempt';

/**
 * איך נטו העסק הופך להכנסה במשק הבית.
 * - positive-only: חודש הפסדי לא יוצר "הכנסה שלילית" במשק הבית (ברירת מחדל).
 * - allow-negative: גם הפסד עובר למשק הבית כהכנסה שלילית.
 * זו נקודת החלטה פתוחה, ולכן היא הגדרה ולא קוד קבוע.
 */
export type BusinessTransferMode = 'positive-only' | 'allow-negative';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'מזומן',
  credit: 'אשראי',
  direct: 'דיירקט',
  check: "צ'ק",
  transfer: 'העברה בנקאית',
};

export const ACCOUNT_MODE_LABELS: Record<AccountMode, string> = {
  both: 'עסק + משק בית',
  business: 'עסק בלבד',
  household: 'משק בית בלבד',
};

export function scopesForMode(mode: AccountMode): Scope[] {
  switch (mode) {
    case 'both':
      return ['business', 'household'];
    case 'business':
      return ['business'];
    case 'household':
      return ['household'];
  }
}

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
  updatedAt: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  titheBps: 1000,
  countBusinessTithePayments: true,
  businessTransferMode: 'positive-only',
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
}
