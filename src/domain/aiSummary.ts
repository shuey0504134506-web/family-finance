import { merchantBreakdown, paymentBreakdown } from "./periods";
import type { Transaction } from "./types";
import { paymentLabelOf } from "./payment";

type Item = Pick<
  Transaction,
  | "type"
  | "amountAgorot"
  | "yearMonth"
  | "categoryName"
  | "counterparty"
  | "paymentMethod"
  | "paymentLabel"
  | "categoryId"
>;

export interface MonthTotals {
  yearMonth: string;
  incomeAgorot: number;
  expenseAgorot: number;
}

const shekels = (agorot: number): number => Math.round(agorot / 100);

function topCategories(
  items: readonly Item[],
  yearMonth: string,
  type: "income" | "expense",
  limit: number,
) {
  const totals = new Map<string, number>();
  for (const t of items) {
    if (t.type !== type || t.yearMonth !== yearMonth) continue;
    const name = t.categoryName?.trim() || "אחר";
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
  const label = (r: {
    label: string;
    amountAgorot: number;
    percent: number;
  }) => ({
    name: r.label,
    amount: shekels(r.amountAgorot),
    percent: r.percent,
  });
  return {
    space: spaceName,
    currency: "ILS",
    selectedMonth: selected,
    months: months.map((m) => ({
      month: m.yearMonth,
      income: shekels(m.incomeAgorot),
      expenses: shekels(m.expenseAgorot),
      balance: shekels(m.incomeAgorot) - shekels(m.expenseAgorot),
    })),
    selectedMonthExpensesByCategory: topCategories(
      items,
      selected,
      "expense",
      8,
    ),
    selectedMonthIncomeByCategory: topCategories(items, selected, "income", 5),
    previousMonthExpensesByCategory: topCategories(
      items,
      previousMonth,
      "expense",
      8,
    ),
    selectedMonthExpensesByMerchant: merchantBreakdown(
      items,
      [selected],
      8,
    ).map(label),
    selectedMonthExpensesByPaymentMethod: paymentBreakdown(items, [
      selected,
    ]).map(label),
  };
}

/**
 * כמה תווים לכל היותר בנתונים שנשלחים למודל. נתונים גדולים מדי גורמים לתשובה של דקה ויותר, ולכן שולחים את הפעולות האחרונות
 * ומהישנות רק את מה שקשור לשאלה, ולצידן סיכום חודשי לפי קטגוריה על כל ההיסטוריה.
 */
export const AI_DATA_MAX_CHARS = 200_000;
const AI_RECENT_ROWS = 1500;
const AI_MATCHED_OLD_ROWS = 600;

const STOP_WORDS = new Set([
  "כמה",
  "הוצאתי",
  "הוצאות",
  "הכנסות",
  "הכנסתי",
  "שילמתי",
  "קניתי",
  "לכבוד",
  "החודש",
  "הזה",
  "הזאת",
  "מתחילת",
  "השנה",
  "על",
  "את",
  "של",
  "עם",
  "אני",
  "לי",
  "מה",
  "איך",
  "האם",
  "יש",
  "היה",
  "היו",
  "בכל",
  "כל",
  "מאז",
  "לפי",
  "בין",
  "גם",
  "רק",
  "עוד",
]);

/** מילות מפתח מהשאלה לחיפוש בפעולות ישנות (כולל צורה בלי אות שימוש בתחילת המילה: "לשבת" -> "שבת"). */
export function questionKeywords(question: string): string[] {
  const words =
    question.toLowerCase().match(/[\u0590-\u05ffa-z0-9"']{3,}/g) ?? [];
  const out = new Set<string>();
  for (const raw of words) {
    const w = raw.replace(/["']/g, "");
    if (w.length < 3 || STOP_WORDS.has(w)) continue;
    out.add(w);
    if (w.length >= 4 && /^[לבהוכמש]/.test(w)) out.add(w.slice(1));
  }
  return [...out];
}

type DataItem = Item & Pick<Transaction, "date" | "note">;

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
export function buildAiData(
  input: AiDataInput,
  question = "",
): Record<string, unknown> {
  // שורה אחת לפעולה בטקסט קצר (פחות טוקנים מ-JSON, ולכן מהיר וזול יותר). הערות מלאות יותר, כדי שיהיה אפשר לחפש בהן.
  const clean = (value: string, max: number) =>
    value
      .replace(/[|\r\n]+/g, " ")
      .trim()
      .slice(0, max);
  const line = (t: AiDataInput["items"][number]) =>
    [
      t.date,
      t.type === "income" ? "I" : "E",
      money(t.amountAgorot),
      clean(t.categoryName ?? "", 40),
      clean(t.counterparty ?? "", 60),
      paymentLabelOf(t),
      clean(t.note ?? "", 120),
    ].join("|");
  const sorted = [...input.items].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  const recent = sorted.slice(0, AI_RECENT_ROWS);
  const keywords = questionKeywords(question);
  const matchedOld = keywords.length
    ? sorted
        .slice(AI_RECENT_ROWS)
        .filter((t) => {
          const hay =
            `${t.categoryName ?? ""} ${t.counterparty ?? ""} ${t.note ?? ""}`.toLowerCase();
          return keywords.some((k) => hay.includes(k));
        })
        .slice(0, AI_MATCHED_OLD_ROWS)
    : [];
  const rows = [...recent, ...matchedOld].map(line);
  // סיכום חודשי לפי קטגוריה על כל ההיסטוריה, כדי שאפשר יהיה לענות על שאלות רחבות גם בלי כל הפעולות הישנות
  const byMonthCategory = new Map<string, number>();
  for (const t of input.items) {
    const key = `${t.date.slice(0, 7)}|${t.type === "income" ? "I" : "E"}|${(t.categoryName ?? "").replace(/[|\r\n]+/g, " ")}`;
    byMonthCategory.set(key, (byMonthCategory.get(key) ?? 0) + t.amountAgorot);
  }
  const categoryTotals = [...byMonthCategory.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, agorot]) => `${key}|${money(agorot)}`);
  // הפעולות של החודש שנבחר בנפרד ובראש הנתונים: שאלות על "החודש" לא תלויות בחיפוש בכל ההיסטוריה
  const monthRows = sorted
    .filter((t) => t.date.startsWith(input.selected))
    .map(line);
  const base = {
    about:
      "נתוני משתמש מלאים של האפליקציה. סכומים בשקלים. selectedMonthTransactions ו-transactions הם טקסט, שורה לכל פעולה בפורמט: תאריך|I=הכנסה/E=הוצאה|סכום|קטגוריה|בית עסק או שם|צורת תשלום|הערה (מהחדשה לישנה). selectedMonthTransactions הן כל פעולות החודש שנבחר. transactions הן הפעולות האחרונות, ומהישנות יותר רק אלה שקשורות לשאלה. monthlyCategoryTotals מסכם את כל ההיסטוריה: חודש|I/E|קטגוריה|סכום.",
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
    monthlySavingsGoal:
      input.savingsGoal === null ? null : money(input.savingsGoal),
    budgets: input.budgets,
    debts: input.debts,
    standingOrders: input.standingOrders,
    categories: input.categories,
  };
  // חותכים את הפעולות הישנות ביותר עד שהכול נכנס בתקרת האורך
  const head = {
    ...base,
    selectedMonthTransactions: monthRows.join("\n"),
    monthlyCategoryTotals: categoryTotals.join("\n"),
  };
  let keep = rows.length;
  let json = JSON.stringify({
    ...head,
    transactionCount: rows.length,
    transactions: rows.join("\n"),
  });
  while (json.length > AI_DATA_MAX_CHARS && keep > 0) {
    keep = Math.floor(keep * 0.85);
    json = JSON.stringify({
      ...head,
      transactionCount: rows.length,
      transactionsShown: keep,
      transactions: rows.slice(0, keep).join("\n"),
    });
  }
  return JSON.parse(json) as Record<string, unknown>;
}
