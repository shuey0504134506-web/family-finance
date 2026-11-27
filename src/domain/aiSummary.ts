import type { Transaction } from "./types";
import { paymentLabelOf } from "./payment";
import { addMonths } from "./dates";
import type { CurrencyCode } from "./currency";

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

/**
 * כמה תווים לכל היותר בנתונים שנשלחים למודל. נתונים גדולים מדי גורמים לתשובה של דקה ויותר, ולכן שולחים את הפעולות האחרונות
 * ומהישנות רק את מה שקשור לשאלה, ולצידן סיכום חודשי לפי קטגוריה על כל ההיסטוריה.
 */
export const AI_DATA_MAX_CHARS = 70_000;
const AI_MATCHED_OLD_ROWS = 250;
const AI_TOP_MERCHANTS = 40;
const AI_LARGEST_ROWS = 25;

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
  "תעשה",
  "תן",
  "תני",
  "הוצאת",
  "how",
  "much",
  "what",
  "did",
  "was",
  "were",
  "spent",
  "spend",
  "expenses",
  "income",
  "month",
  "year",
  "last",
  "this",
  "from",
  "the",
  "and",
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
  currency?: CurrencyCode;
  omittedForeignTransactions?: number;
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
      clean(paymentLabelOf(t), 80),
      clean(t.note ?? "", 120),
    ].join("|");
  const sorted = [...input.items].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  const prevMonth = addMonths(input.selected, -1);
  const inFocus = (t: AiDataInput["items"][number]) =>
    t.date.startsWith(input.selected) || t.date.startsWith(prevMonth);
  // פעולות מלאות רק לחודש הנבחר ולקודם לו, ומהישנות רק מה שקשור לשאלה: נתונים קטנים = תשובה מהירה
  const monthRows = sorted
    .filter((t) => t.date.startsWith(input.selected))
    .map(line);
  const prevRows = sorted
    .filter((t) => t.date.startsWith(prevMonth))
    .map(line);
  const keywords = questionKeywords(question);
  const matchesQuestion = (value: string) => keywords.some(k => value.toLowerCase().includes(k));
  const allMatchedOld = keywords.length
    ? sorted
        .filter((t) => {
          if (inFocus(t)) return false;
          const hay =
            `${t.categoryName ?? ""} ${t.counterparty ?? ""} ${t.note ?? ""}`.toLowerCase();
          return keywords.some((k) => hay.includes(k));
        })
    : [];
  const rows = allMatchedOld.slice(0, AI_MATCHED_OLD_ROWS).map(line);
  // סיכום חודשי לפי קטגוריה על כל ההיסטוריה, כדי שאפשר יהיה לענות על שאלות רחבות גם בלי כל הפעולות הישנות
  const byMonthCategory = new Map<string, number>();
  const byMonthPayment = new Map<string, { amount: number; count: number }>();
  const matchedByMonth = new Map<string, { amount: number; count: number }>();
  const byMerchant = new Map<string, number>();
  const byYear = new Map<string, { i: number; e: number }>();
  for (const m of input.months) {
    const year = m.yearMonth.slice(0, 4);
    const y = byYear.get(year) ?? { i: 0, e: 0 };
    y.i += m.incomeAgorot; y.e += m.expenseAgorot; byYear.set(year, y);
  }
  for (const t of input.items) {
    const key = `${t.date.slice(0, 7)}|${t.type === "income" ? "I" : "E"}|${(t.categoryName ?? "").replace(/[|\r\n]+/g, " ")}`;
    byMonthCategory.set(key, (byMonthCategory.get(key) ?? 0) + t.amountAgorot);
    const month = t.date.slice(0, 7);
    if (t.type === "expense") {
      const paymentKey = `${month}|${clean(paymentLabelOf(t), 80)}`;
      const payment = byMonthPayment.get(paymentKey) ?? { amount: 0, count: 0 };
      payment.amount += t.amountAgorot; payment.count += 1;
      byMonthPayment.set(paymentKey, payment);
      if (matchesQuestion(`${t.categoryName ?? ""} ${t.counterparty ?? ""} ${t.note ?? ""}`)) {
        const match = matchedByMonth.get(month) ?? { amount: 0, count: 0 };
        match.amount += t.amountAgorot; match.count += 1;
        matchedByMonth.set(month, match);
      }
    }
    const who = (t.counterparty ?? "").replace(/[|\r\n]+/g, " ").trim();
    if (t.type === "expense" && who) {
      const mk = `${who}|${clean(t.categoryName ?? "", 80)}`;
      byMerchant.set(mk, (byMerchant.get(mk) ?? 0) + t.amountAgorot);
    }
  }
  const categoryTotals = [...byMonthCategory.entries()]
    .sort((a, b) => Number(matchesQuestion(b[0].split("|").slice(2).join("|"))) - Number(matchesQuestion(a[0].split("|").slice(2).join("|"))) || b[0].localeCompare(a[0]))
    .map(([key, agorot]) => `${key}|${money(agorot)}`);
  const matchedCategoryTotals = categoryTotals.filter(row => matchesQuestion(row.split("|").slice(2,-1).join("|")));
  const topMerchants = [...byMerchant.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, AI_TOP_MERCHANTS)
    .map(([key, agorot]) => `${key}|${money(agorot)}`);
  const largestExpenses = sorted
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amountAgorot - a.amountAgorot)
    .slice(0, AI_LARGEST_ROWS)
    .map(line);
  const base = {
    about:
      "נתוני משתמש, מסוכמים מראש. סכומים במטבע currency, למעט חובות והוראות קבע שמציינים מטבע משלהם. שורות פעולה הן טקסט בפורמט: תאריך|I=הכנסה/E=הוצאה|סכום|קטגוריה|בית עסק או שם|צורת תשלום|הערה. selectedMonthTransactions: פעולות החודש שנבחר. previousMonthTransactions: פעולות החודש הקודם. relatedOlderTransactions: פעולות ישנות יותר שקשורות לשאלה (לפי מילות המפתח שלה). monthlyCategoryTotals: חודש|I/E|קטגוריה|סכום, על כל ההיסטוריה. yearlyTotals: סיכום שנתי. topMerchantsAllTime: בית עסק|קטגוריה|סכום מצטבר להוצאות. largestExpensesAllTime: ההוצאות הגדולות ביותר. monthlyTotals: הכנסות והוצאות לכל חודש.",
    currency: input.currency ?? "ILS",
    omittedForeignTransactions: input.omittedForeignTransactions ?? 0,
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
    yearlyTotals: [...byYear.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([year, v]) => ({ year, income: money(v.i), expenses: money(v.e) })),
    monthlySavingsGoal:
      input.savingsGoal === null ? null : money(input.savingsGoal),
    budgets: input.budgets,
    debts: input.debts,
    standingOrders: input.standingOrders,
    categories: input.categories,
    matchedExpenseTotals: [...matchedByMonth].sort((a,b) => b[0].localeCompare(a[0])).map(([month, value]) => ({ month, amount: money(value.amount), count: value.count })),
    matchedKeywords: keywords,
    matchedCategoryTotals: matchedCategoryTotals.join("\n"),
    monthlyPaymentTotals: [...byMonthPayment].sort((a,b) => b[0].localeCompare(a[0])).map(([key, value]) => `${key}|${money(value.amount)}|${value.count}`).join("\n"),
  };
  // אם עדיין גדול מדי, חותכים קודם את הפעולות הישנות שהותאמו לשאלה, ואחר כך את סיכום הקטגוריות הישן
  const head = {
    ...base,
    selectedMonthTransactions: monthRows.join("\n"),
    previousMonthTransactions: prevRows.join("\n"),
    topMerchantsAllTime: topMerchants.join("\n"),
    largestExpensesAllTime: largestExpenses.join("\n"),
  };
  let keepRows = rows.length;
  let keepMonthRows = monthRows.length;
  let keepPrevRows = prevRows.length;
  let keepTotals = categoryTotals.length;
  const make = () =>
    JSON.stringify({
      ...head,
      selectedMonthTransactions: monthRows.slice(0, keepMonthRows).join("\n"),
      previousMonthTransactions: prevRows.slice(0, keepPrevRows).join("\n"),
      coverage: { selectedRowsTotal: monthRows.length, selectedRowsIncluded: keepMonthRows, previousRowsTotal: prevRows.length, previousRowsIncluded: keepPrevRows, matchedOlderTotal: allMatchedOld.length, matchedOlderIncluded: keepRows, categoryTotalsTotal: categoryTotals.length, categoryTotalsIncluded: keepTotals, olderRowsAreKeywordMatchesOnly: true, yearlyTotalsIncludeConfiguredTransfers: true },
      monthlyCategoryTotals: categoryTotals.slice(0, keepTotals).join("\n"),
      relatedOlderTransactions: rows.slice(0, keepRows).join("\n"),
    });
  let json = make();
  while (json.length > AI_DATA_MAX_CHARS && (keepRows > 0 || keepMonthRows > 0 || keepPrevRows > 0 || keepTotals > 0)) {
    if (keepRows > 0) keepRows = Math.floor(keepRows * 0.7);
    else if (keepPrevRows > 0) keepPrevRows = Math.floor(keepPrevRows * 0.7);
    else if (keepMonthRows > 0) keepMonthRows = Math.floor(keepMonthRows * 0.7);
    else keepTotals = Math.floor(keepTotals * 0.85);
    json = make();
  }
  // Very large auxiliary lists may still exceed the budget. Trim optional
  // evidence without ever truncating the JSON or changing computed amounts.
  const result = JSON.parse(json) as Record<string, unknown>;
  const omitted: string[] = [];
  for (const field of ["largestExpensesAllTime","topMerchantsAllTime","categories","standingOrders","debts","budgets","monthlyPaymentTotals","matchedCategoryTotals","matchedExpenseTotals","yearlyTotals","monthlyTotals"] as const) {
    if (JSON.stringify(result).length <= AI_DATA_MAX_CHARS - 200) break;
    delete result[field];
    omitted.push(field);
  }
  if (omitted.length) result.coverage = { ...(result.coverage as object), omitted };
  return result;
}
