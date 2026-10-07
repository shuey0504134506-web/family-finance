import { sumAgorot, type Agorot } from './money';
import type { BusinessTransferMode, Transaction } from './types';

type AmountOnly = Pick<Transaction, 'type' | 'amountAgorot'>;

export interface Totals {
  incomeAgorot: Agorot;
  expenseAgorot: Agorot;
  /** הכנסות פחות הוצאות. שלילי = מינוס. */
  balanceAgorot: Agorot;
}

/** סיכום הכנסות והוצאות של רשימת פעולות. משמש גם לעסק וגם למשק בית. */
export function totalsOf(transactions: readonly AmountOnly[]): Totals {
  const incomeAgorot = sumAgorot(
    transactions.filter((t) => t.type === 'income').map((t) => t.amountAgorot),
  );
  const expenseAgorot = sumAgorot(
    transactions.filter((t) => t.type === 'expense').map((t) => t.amountAgorot),
  );
  return { incomeAgorot, expenseAgorot, balanceAgorot: incomeAgorot - expenseAgorot };
}

/** נטו העסק = הכנסות העסק פחות הוצאות העסק. */
export function businessNet(businessTotals: Totals): Agorot {
  return businessTotals.balanceAgorot;
}

/**
 * הסכום שעובר מהעסק למשק הבית כהכנסה.
 * רק הנטו עובר, לעולם לא ההכנסות הגולמיות של העסק. זה מה שמונע ספירה כפולה.
 * בברירת המחדל גם חודש הפסדי עובר: ההפסד מופיע במשק הבית כהכנסה שלילית.
 */
export function businessTransferToHousehold(
  netAgorot: Agorot,
  mode: BusinessTransferMode = 'allow-negative',
): Agorot {
  if (mode === 'positive-only') return Math.max(0, netAgorot);
  return netAgorot;
}

export interface HouseholdTotals extends Totals {
  /** הכנסות שהוזנו ידנית במשק הבית */
  ownIncomeAgorot: Agorot;
  /** הכנסה מהעסק (נגזרת, לא נשמרת כפעולה) */
  fromBusinessAgorot: Agorot;
}

/**
 * סיכום משק הבית. ההכנסה מהעסק נוספת כסכום נגזר אחד,
 * והיא אינה נשמרת כפעולה, כך שאי אפשר לספור אותה פעמיים.
 */
export function householdTotals(
  householdTransactions: readonly AmountOnly[],
  fromBusinessAgorot: Agorot,
): HouseholdTotals {
  const own = totalsOf(householdTransactions);
  const incomeAgorot = own.incomeAgorot + fromBusinessAgorot;
  return {
    ownIncomeAgorot: own.incomeAgorot,
    fromBusinessAgorot,
    incomeAgorot,
    expenseAgorot: own.expenseAgorot,
    balanceAgorot: incomeAgorot - own.expenseAgorot,
  };
}

/** סיכום לפי קטגוריה: מזהה קטגוריה -> סכום, לפעולות מסוג מסוים. */
export function totalsByCategory(
  transactions: readonly Pick<Transaction, 'type' | 'amountAgorot' | 'categoryId'>[],
  type: Transaction['type'],
): Map<string, Agorot> {
  const result = new Map<string, Agorot>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    result.set(t.categoryId, (result.get(t.categoryId) ?? 0) + t.amountAgorot);
  }
  return result;
}
