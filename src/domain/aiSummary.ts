import { merchantBreakdown, paymentBreakdown } from './periods';
import type { Transaction } from './types';
import { paymentLabelOf } from './payment';

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

/** כמה תווים לכל היותר בנתונים שנשלחים למודל (כ-100 אלף טוקנים). מעבר לכך נחתכות הפעולות הישנות ביותר. */
export const AI_DATA_MAX_CHARS = 380_000;
const AI_MAX_ROWS = 4000;

type DataItem = Item & Pick<Transaction, 'date' | 'note'>;

export interface AiDataInput {
  spaceName: string;
  scopeLabel: string;
  today: string;
  selected: string;
  items: readonly DataItem[];
  months: readonly MonthTotals[];
  budgets: readonly { category: string; period?: string; amount: number }[];
  savingsGoal: number | null;
  debts: readonly Record<string, unknown>[];
  standingOrders: readonly Record<string, unknown>[];
  categories: readonly { name: string; type: string }[];
}

const money = (agorot: number): number => Math.round(agorot) / 100;

/**
 * כל הנתונים של המרחב כמו בקובץ הגיבוי, בצורה קומפקטית: סכומי כל החודשים מתחילת התיעוד, כל הפעולות (מהחדשה לישנה,
 * עד תקרת אורך), תקציבים ויעד חיסכון, חובות, הוראות קבע וקטגוריות. ללא תמונות מצורפות.
 */
export function buildAiData(input: AiDataInput): Record<string, unknown> {
  const rows = [...input.items]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, AI_MAX_ROWS)
    .map((t) => [t.date, t.type === 'income' ? 'I' : 'E', money(t.amountAgorot), t.categoryName ?? '', (t.counterparty ?? '').slice(0, 60), paymentLabelOf(t), (t.note ?? '').slice(0, 60)]);
  const base = {
    about:
      'נתוני משתמש מלאים של האפליקציה. סכומים בשקלים. transactions: כל שורה היא [תאריך, I=הכנסה/E=הוצאה, סכום, קטגוריה, בית עסק או שם, צורת תשלום, הערה], מהחדשה לישנה.',
    space: input.spaceName,
    kind: input.scopeLabel,
    today: input.today,
    selectedMonth: input.selected,
    monthlyTotals: input.months.map((m) => ({
      month: m.yearMonth,
      income: money(m.incomeAgorot),
      expenses: money(m.expenseAgorot),
      balance: Math.round(m.incomeAgorot - m.expenseAgorot) / 100,
    })),
    monthlySavingsGoal: input.savingsGoal === null ? null : money(input.savingsGoal),
    budgets: input.budgets,
    debts: input.debts,
    standingOrders: input.standingOrders,
    categories: input.categories,
  };
  // חותכים את הפעולות הישנות ביותר עד שהכול נכנס בתקרת האורך
  let keep = rows.length;
  let json = JSON.stringify({ ...base, transactionCount: rows.length, transactions: rows });
  while (json.length > AI_DATA_MAX_CHARS && keep > 0) {
    keep = Math.floor(keep * 0.85);
    json = JSON.stringify({ ...base, transactionCount: rows.length, transactionsShown: keep, transactions: rows.slice(0, keep) });
  }
  return JSON.parse(json) as Record<string, unknown>;
}
