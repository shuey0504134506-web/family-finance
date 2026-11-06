import { merchantBreakdown, paymentBreakdown } from './periods';
import type { Transaction } from './types';

type Item = Pick<Transaction, 'type' | 'amountAgorot' | 'yearMonth' | 'categoryName' | 'counterparty' | 'paymentMethod' | 'paymentLabel' | 'categoryId'>;

export interface MonthTotals {
  yearMonth: string;
  incomeAgorot: number;
  expenseAgorot: number;
}

const shekels = (agorot: number): number => Math.round(agorot / 100);

function topCategories(items: readonly Item[], yearMonth: string, type: 'income' | 'expense', limit: number) {
  const totals = new Map<string, number>();
  for (const t of items) {
    if (t.type !== type || t.yearMonth !== yearMonth) continue;
    const name = t.categoryName?.trim() || 'אחר';
    totals.set(name, (totals.get(name) ?? 0) + t.amountAgorot);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, agorot]) => ({ name, amount: shekels(agorot) }));
}

/**
 * הסיכום הקטן שנשלח למודל יחד עם השאלה: סכומים בשקלים שלמים בלבד, ללא פעולות בודדות, הערות או תאריכים מדויקים.
 * החודשים מהישן לחדש; הפירוט המלא (קטגוריות, בתי עסק, צורות תשלום) הוא לחודש הנבחר, וקטגוריות גם לחודש הקודם להשוואה.
 */
export function buildAiSummary(args: {
  spaceName: string;
  selected: string;
  months: readonly MonthTotals[];
  items: readonly Item[];
  previousMonth: string;
}): Record<string, unknown> {
  const { spaceName, selected, months, items, previousMonth } = args;
  const label = (r: { label: string; amountAgorot: number; percent: number }) => ({ name: r.label, amount: shekels(r.amountAgorot), percent: r.percent });
  return {
    space: spaceName,
    currency: 'ILS',
    selectedMonth: selected,
    months: months.map((m) => ({
      month: m.yearMonth,
      income: shekels(m.incomeAgorot),
      expenses: shekels(m.expenseAgorot),
      balance: shekels(m.incomeAgorot) - shekels(m.expenseAgorot),
    })),
    selectedMonthExpensesByCategory: topCategories(items, selected, 'expense', 8),
    selectedMonthIncomeByCategory: topCategories(items, selected, 'income', 5),
    previousMonthExpensesByCategory: topCategories(items, previousMonth, 'expense', 8),
    selectedMonthExpensesByMerchant: merchantBreakdown(items, [selected], 8).map(label),
    selectedMonthExpensesByPaymentMethod: paymentBreakdown(items, [selected]).map(label),
  };
}
