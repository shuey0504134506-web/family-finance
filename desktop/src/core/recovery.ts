import { formatMonthYear, type YearMonth } from '../../../src/domain/dates';
import type { Scope, Transaction } from '../../../src/domain/types';

/**
 * שאלות זיהוי לשחזור סיסמה בחשבון מנותק.
 * שלוש שאלות, וכולן נדרשות: חלקן שהמשתמש קבע בעצמו, וחלקן נגזרות מהפעולות הכספיות הישנות שלו.
 * נוסח השאלות נשמר בגלוי (אחרת אי אפשר להציג אותן לפני הכניסה), ולכן שאלות נגזרות כוללות רק חודש
 * ותחום ולא שם ספק או סכום.
 */
export const QUESTION_COUNT = 3;

export interface RecoveryQuestion {
  kind: 'custom' | 'derived';
  /** מזהה סוג לשאלה נגזרת, כדי לדעת להשוות ולרענן */
  template?: DerivedTemplate;
  /** לשאלה נגזרת: החודש והתחום שממנו נגזרה, כדי לחשב מחדש את התשובה אחרי עריכות */
  month?: YearMonth;
  scope?: Scope;
  text: string;
}

export type DerivedTemplate = 'top-expense-category' | 'top-expense-name' | 'top-income-amount' | 'expense-count';

/** תשובה מנורמלת: אותיות קטנות, בלי ניקוד ופיסוק, רווחים בודדים; מספרים בשקלים שלמים. */
export function normalizeAnswer(raw: string): string {
  const base = raw
    .normalize('NFKC')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[‎‏]/g, '')
    .trim()
    .toLowerCase();
  const numeric = base.replace(/[₪\s,]|ש"ח|שח|שקלים|שקל/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return String(Math.round(Number(numeric)));
  return base
    .replace(/["'`´׳״.,;:!?()\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** הסוד שנגזר מכל התשובות יחד. סדר השאלות קובע. */
export function answersSecret(answers: readonly string[]): string {
  return answers.map(normalizeAnswer).join('\u0001');
}

export function validateCustomQuestion(text: string, answer: string): string | null {
  if (text.trim().length < 5) return 'השאלה קצרה מדי.';
  if (text.trim().length > 120) return 'השאלה ארוכה מדי.';
  if (normalizeAnswer(answer).length < 2) return 'התשובה קצרה מדי.';
  return null;
}

export interface DerivedCandidate {
  question: RecoveryQuestion;
  /** התשובה כפי שנגזרת מהנתונים (עדיין לא מנורמלת) */
  answer: string;
  month: YearMonth;
  scope: Scope;
}

export interface TxLike {
  type: Transaction['type'];
  amountAgorot: number;
  date: string;
  counterparty: string;
  categoryName: string;
}

const scopeLabel = (scope: Scope) => (scope === 'business' ? 'העסק' : 'משק הבית');

/** המקסימום היחיד של מילון, או undefined אם יש תיקו או שאין נתונים. */
function uniqueMax<T extends string>(totals: Map<T, number>): T | undefined {
  let best: T | undefined;
  let bestValue = -Infinity;
  let tie = false;
  for (const [k, v] of totals) {
    if (v > bestValue) {
      best = k;
      bestValue = v;
      tie = false;
    } else if (v === bestValue) tie = true;
  }
  return tie ? undefined : best;
}

/**
 * שאלות נגזרות מחודשים שהסתיימו (לפחות חודש שלם אחורה), כדי שהתשובה לא תשתנה מהפעולות השוטפות.
 * שאלה נוצרת רק כשהתשובה חד-משמעית (אין תיקו) ויש בחודש לפחות 4 פעולות.
 */
export function derivedCandidates(
  byScope: Record<Scope, readonly TxLike[]>,
  currentMonth: YearMonth,
): DerivedCandidate[] {
  const out: DerivedCandidate[] = [];
  for (const scope of ['household', 'business'] as const) {
    const months = new Map<YearMonth, TxLike[]>();
    for (const t of byScope[scope]) {
      const ym = t.date.slice(0, 7);
      if (ym >= currentMonth) continue;
      months.set(ym, [...(months.get(ym) ?? []), t]);
    }
    const recent = [...months.entries()].filter(([, list]) => list.length >= 4).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    for (const [month, list] of recent.slice(0, 4)) {
      const label = `${formatMonthYear(month)} ב${scopeLabel(scope)}`;
      const expenses = list.filter((t) => t.type === 'expense');
      const incomes = list.filter((t) => t.type === 'income');

      const byCategory = new Map<string, number>();
      for (const t of expenses) byCategory.set(t.categoryName, (byCategory.get(t.categoryName) ?? 0) + t.amountAgorot);
      const topCategory = uniqueMax(byCategory);
      if (topCategory) out.push({ question: { kind: 'derived', template: 'top-expense-category', month, scope, text: `באיזו קטגוריה הוצאת הכי הרבה כסף ב${label}?` }, answer: topCategory, month, scope });

      const single = [...expenses].sort((a, b) => b.amountAgorot - a.amountAgorot);
      if (single.length >= 2 && single[0]!.amountAgorot > single[1]!.amountAgorot && single[0]!.counterparty.trim()) {
        out.push({ question: { kind: 'derived', template: 'top-expense-name', month, scope, text: `מה שם הספק או העסק של ההוצאה הבודדת הגדולה ביותר ב${label}?` }, answer: single[0]!.counterparty, month, scope });
      }

      const topIncome = [...incomes].sort((a, b) => b.amountAgorot - a.amountAgorot)[0];
      if (topIncome) out.push({ question: { kind: 'derived', template: 'top-income-amount', month, scope, text: `מה הסכום, בשקלים שלמים, של ההכנסה הגדולה ביותר ב${label}?` }, answer: String(Math.round(topIncome.amountAgorot / 100)), month, scope });

      if (expenses.length >= 3) out.push({ question: { kind: 'derived', template: 'expense-count', month, scope, text: `כמה הוצאות רשמת ב${label}?` }, answer: String(expenses.length), month, scope });
    }
  }
  return out;
}

/**
 * בוחר שאלה נגזרת שונה בסוגה ובחודש מכל קודמותיה. מחזיר עד `count` שאלות.
 */
export function pickDerived(candidates: readonly DerivedCandidate[], count: number): DerivedCandidate[] {
  const picked: DerivedCandidate[] = [];
  const usedTemplates = new Set<string>();
  const usedMonths = new Set<string>();
  for (const pass of [true, false]) {
    for (const c of candidates) {
      if (picked.length >= count) return picked;
      if (picked.includes(c)) continue;
      const fresh = !usedTemplates.has(c.question.template!) && !usedMonths.has(`${c.scope}:${c.month}`);
      if (pass && !fresh) continue;
      if (!pass && usedTemplates.has(c.question.template!) && picked.some((p) => p.question.text === c.question.text)) continue;
      picked.push(c);
      usedTemplates.add(c.question.template!);
      usedMonths.add(`${c.scope}:${c.month}`);
    }
  }
  return picked;
}

/**
 * מחשב מחדש את התשובה לשאלה נגזרת מהנתונים הנוכחיים. null אם כבר אי אפשר (תיקו או חודש שהתרוקן).
 * קוראים לזה בכל כניסה, כדי שעריכת פעולה ישנה לא תנעל את השחזור.
 */
export function recomputeDerived(q: RecoveryQuestion, byScope: Record<Scope, readonly TxLike[]>, currentMonth: YearMonth): string | null {
  if (q.kind !== 'derived') return null;
  const hit = derivedCandidates(byScope, currentMonth).find((c) => c.question.template === q.template && c.month === q.month && c.scope === q.scope);
  return hit ? hit.answer : null;
}
