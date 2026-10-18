import { addMonths, isValidIsoDate, parseYearMonth, toYearMonth, yearMonthOfDate, type IsoDate } from './dates';
import { fuzzyMatchAll, normalizeText } from './fuzzy';
import { DEFAULT_BUSINESS_ID } from './spaces';
import { LEGACY_CURRENCY } from './currency';
import type { Scope, StandingOrder, Transaction } from './types';

/** כמה פעולות לכל היותר נוצרות בהרצה אחת (הגנה מפני הצפה אחרי הפסקה ארוכה מאוד). */
export const MAX_CATCH_UP = 24;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** תאריך החיוב בחודש נתון: היום המבוקש, או היום האחרון בחודש אם הוא קצר יותר. */
export function dueDateIn(yearMonth: string, dayOfMonth: number): IsoDate {
  const { year, month } = parseYearMonth(yearMonth);
  return `${yearMonth}-${pad(Math.min(dayOfMonth, daysInMonth(year, month)))}`;
}

/** תאריך החיוב שאחרי התאריך הנתון, בחודש שאחריו. */
export function nextDueAfter(dayOfMonth: number, date: IsoDate): IsoDate {
  return dueDateIn(addMonths(yearMonthOfDate(date), 1), dayOfMonth);
}

/**
 * תאריך החיוב הראשון האוטומטי כשפעולה הופכת להוראת קבע.
 * מתחיל בחודש שאחרי הפעולה האחרונה בסדרה, אבל לעולם לא "מחזיר" חיובים שעברו:
 * אם התאריך כבר עבר, ממשיכים לתאריך החיוב הקרוב (היום עצמו נחשב קרוב).
 */
export function firstDueDate(dayOfMonth: number, lastDate: IsoDate, today: IsoDate): IsoDate {
  let due = nextDueAfter(dayOfMonth, lastDate);
  while (due < today) due = nextDueAfter(dayOfMonth, due);
  return due;
}

/** תאריכי החיוב שהגיעו עד היום (כולל), מהישן לחדש. */
export function dueDatesUpTo(order: Pick<StandingOrder, 'dayOfMonth' | 'nextDue' | 'active'>, today: IsoDate): IsoDate[] {
  if (!order.active || !isValidIsoDate(order.nextDue)) return [];
  const result: IsoDate[] = [];
  let due = order.nextDue;
  while (due <= today && result.length < MAX_CATCH_UP) {
    result.push(due);
    due = nextDueAfter(order.dayOfMonth, due);
  }
  return result;
}

/** מזהה קבוע לפעולה שנוצרת אוטומטית: מכשיר נוסף שמריץ את אותו חיוב כותב לאותו מסמך ולא יוצר כפילות. */
export function generatedTransactionId(orderId: string, date: IsoDate): string {
  return `so_${orderId}_${date}`;
}

/** הפעולה שנוצרת מההוראה בתאריך חיוב. */
export function transactionFromOrder(order: StandingOrder, date: IsoDate, now: number): Transaction {
  const { year, month } = parseYearMonth(yearMonthOfDate(date));
  return {
    id: generatedTransactionId(order.id, date),
    type: order.type,
    amountAgorot: order.amountAgorot,
    date,
    yearMonth: toYearMonth(year, month),
    year,
    month,
    counterparty: order.name,
    categoryId: order.categoryId,
    categoryName: order.categoryName,
    paymentMethod: order.paymentMethod,
    ...(order.paymentMethod === 'other' && order.paymentLabel ? { paymentLabel: order.paymentLabel } : {}),
    note: order.note,
    titheStatus: order.titheStatus,
    isTithePayment: order.isTithePayment,
    createdAt: now,
    updatedAt: now,
    ...(order.currency && order.currency !== LEGACY_CURRENCY ? { currency: order.currency } : {}),
    ...(order.businessId && order.businessId !== DEFAULT_BUSINESS_ID ? { businessId: order.businessId } : {}),
    standingOrderId: order.id,
  };
}

/** הוראת קבע חדשה מתוך פעולה קיימת. nextDue מחושב לפי אחרון הסדרה והיום. */
export function orderFromTransaction(
  tx: Transaction,
  scope: Scope,
  context: { id: string; now: number; today: IsoDate; lastDate?: IsoDate },
): StandingOrder {
  const dayOfMonth = Number(tx.date.slice(8, 10));
  return {
    id: context.id,
    scope,
    ...(tx.businessId ? { businessId: tx.businessId } : {}),
    type: tx.type,
    name: tx.counterparty.trim() || tx.categoryName,
    amountAgorot: tx.amountAgorot,
    ...(tx.currency ? { currency: tx.currency } : {}),
    categoryId: tx.categoryId,
    categoryName: tx.categoryName,
    paymentMethod: tx.paymentMethod,
    ...(tx.paymentLabel ? { paymentLabel: tx.paymentLabel } : {}),
    note: tx.note,
    titheStatus: tx.titheStatus,
    isTithePayment: tx.isTithePayment,
    dayOfMonth,
    nextDue: firstDueDate(dayOfMonth, context.lastDate && context.lastDate > tx.date ? context.lastDate : tx.date, context.today),
    active: true,
    createdAt: context.now,
    updatedAt: context.now,
  };
}

// ---------- זיהוי פעולות דומות ----------

/** כמה שונה יכול להיות הסכום (באחוזים) ובכמה ימים התאריך, כדי שייחשבו "אותה הוראה". */
const AMOUNT_TOLERANCE = 0.1;
const DAY_TOLERANCE = 5;

type Similar = Pick<Transaction, 'id' | 'type' | 'amountAgorot' | 'date' | 'counterparty' | 'categoryId' | 'currency' | 'standingOrderId'> & {
  businessId?: string;
};

function dayDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 31 - diff);
}

/** שם דומה: זהה אחרי נירמול, האחד מכיל את השני, או התאמה מקורבת (טעות כתיב). */
export function similarName(a: string, b: string): boolean {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return x === y;
  if (x === y) return true;
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return true;
  return fuzzyMatchAll(a, b) && fuzzyMatchAll(b, a);
}

function similarAmount(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(a, b) * AMOUNT_TOLERANCE;
}

/** האם הפעולה דומה לעוגן: אותו סוג ומטבע, שם דומה, סכום קרוב ותאריך קרוב בחודש. */
export function isSimilar(anchor: Similar, other: Similar): boolean {
  return (
    anchor.type === other.type &&
    (anchor.currency ?? LEGACY_CURRENCY) === (other.currency ?? LEGACY_CURRENCY) &&
    similarName(anchor.counterparty, other.counterparty) &&
    similarAmount(anchor.amountAgorot, other.amountAgorot) &&
    dayDistance(Number(anchor.date.slice(8, 10)), Number(other.date.slice(8, 10))) <= DAY_TOLERANCE
  );
}

/**
 * פעולות דומות לעוגן בחודשים שאחריו (פעולה אחת לכל חודש, הקרובה ביותר בתאריך).
 * לא כוללת פעולות שכבר שייכות להוראת קבע. מהישן לחדש.
 */
export function findSimilarAfter<T extends Similar>(anchor: Similar, candidates: readonly T[]): T[] {
  const anchorMonth = yearMonthOfDate(anchor.date);
  const anchorDay = Number(anchor.date.slice(8, 10));
  const byMonth = new Map<string, T>();
  for (const c of candidates) {
    if (c.id === anchor.id || c.standingOrderId) continue;
    const month = yearMonthOfDate(c.date);
    if (month <= anchorMonth) continue;
    if ((anchor.businessId ?? '') !== (c.businessId ?? '')) continue;
    if (!isSimilar(anchor, c)) continue;
    const best = byMonth.get(month);
    const dist = dayDistance(anchorDay, Number(c.date.slice(8, 10)));
    if (!best || dist < dayDistance(anchorDay, Number(best.date.slice(8, 10)))) byMonth.set(month, c);
  }
  return [...byMonth.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------- זיהוי פעולות שחוזרות על עצמן ----------

export interface RecurringSuggestion {
  /** מפתח יציב לדחיית ההצעה */
  key: string;
  type: Transaction['type'];
  name: string;
  /** הפעולות שנמצאו, מהישן לחדש */
  transactions: Transaction[];
  amountAgorot: number;
  dayOfMonth: number;
}

/** כמה חודשים רצופים צריכים להופיע כדי להציע הוראת קבע. */
const MIN_RECURRING_MONTHS = 3;

/**
 * מחפש פעולות שחוזרות כל חודש (לפחות שלושה חודשים רצופים, האחרון בחודש הנוכחי או הקודם)
 * באותו שם, בסכום קרוב ובתאריך קרוב, ושעדיין אינן הוראת קבע.
 * `transactions` הן של תחום אחד (עסק או משק בית).
 */
export function detectRecurring(
  transactions: readonly Transaction[],
  orders: readonly Pick<StandingOrder, 'name' | 'type' | 'active'>[],
  today: IsoDate,
): RecurringSuggestion[] {
  const thisMonth = yearMonthOfDate(today);
  const recentFrom = addMonths(thisMonth, -(MIN_RECURRING_MONTHS + 2));
  const pool = transactions.filter((t) => !t.standingOrderId && t.date >= `${recentFrom}-01` && t.yearMonth <= thisMonth);
  const used = new Set<string>();
  const found: RecurringSuggestion[] = [];

  const sorted = [...pool].sort((a, b) => (a.date < b.date ? 1 : -1)); // מהחדש לישן
  for (const seed of sorted) {
    if (used.has(seed.id)) continue;
    if (orders.some((o) => o.type === seed.type && similarName(o.name, seed.counterparty))) continue;
    const group = [seed];
    const months = new Set([seed.yearMonth]);
    for (const other of sorted) {
      if (other.id === seed.id || used.has(other.id) || months.has(other.yearMonth)) continue;
      if ((seed.businessId ?? '') !== (other.businessId ?? '')) continue;
      if (isSimilar(seed, other)) {
        group.push(other);
        months.add(other.yearMonth);
      }
    }
    // רצף חודשים שמסתיים בחודש החדש ביותר, והחדש ביותר קרוב להיום
    const orderedMonths = [...months].sort().reverse();
    if (orderedMonths[0] < addMonths(thisMonth, -1)) continue;
    let run = 1;
    while (run < orderedMonths.length && orderedMonths[run] === addMonths(orderedMonths[0], -run)) run += 1;
    if (run < MIN_RECURRING_MONTHS) continue;
    const members = group.filter((t) => orderedMonths.slice(0, run).includes(t.yearMonth)).sort((a, b) => (a.date < b.date ? -1 : 1));
    members.forEach((m) => used.add(m.id));
    const latest = members[members.length - 1];
    const days = members.map((m) => Number(m.date.slice(8, 10))).sort((a, b) => a - b);
    found.push({
      key: `${seed.type}|${normalizeText(latest.counterparty)}|${seed.businessId ?? ''}`,
      type: seed.type,
      name: latest.counterparty.trim() || latest.categoryName,
      transactions: members,
      amountAgorot: latest.amountAgorot,
      dayOfMonth: days[Math.floor(days.length / 2)],
    });
  }
  return found.sort((a, b) => (a.name < b.name ? -1 : 1));
}
