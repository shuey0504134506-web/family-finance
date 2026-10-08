/**
 * תאריכים באפליקציה הם מחרוזות: YYYY-MM-DD לתאריך ו-YYYY-MM לחודש.
 * כך אין בעיות אזור זמן, והמיון והשאילתות ב-Firestore פשוטים.
 */
import { translateText } from '../i18n/translate';

export type IsoDate = string;
export type YearMonth = string;

export const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function toYearMonth(year: number, month: number): YearMonth {
  return `${year}-${pad2(month)}`;
}

export function parseYearMonth(ym: YearMonth): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
  if (!match) throw new Error(`Invalid year-month: ${ym}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isValidYearMonth(ym: string): boolean {
  return /^(\d{4})-(0[1-9]|1[0-2])$/.test(ym);
}

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** התאריך המקומי של המכשיר, כמחרוזת YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function currentYearMonth(now: Date = new Date()): YearMonth {
  return toYearMonth(now.getFullYear(), now.getMonth() + 1);
}

export function yearMonthOfDate(date: IsoDate): YearMonth {
  if (!isValidIsoDate(date)) throw new Error(`Invalid date: ${date}`);
  return date.slice(0, 7);
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const { year, month } = parseYearMonth(ym);
  const index = year * 12 + (month - 1) + delta;
  return toYearMonth(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type MonthStatus = 'past' | 'current' | 'future';

export function monthStatus(selected: YearMonth, current: YearMonth): MonthStatus {
  const cmp = compareYearMonth(selected, current);
  return cmp < 0 ? 'past' : cmp === 0 ? 'current' : 'future';
}

/** טווח תאריכים (כולל) לשאילתה של חודש. '2026-02-31' גדול מכל יום בפברואר ונמוך מ-03-01. */
export function monthDateRange(ym: YearMonth): { start: IsoDate; end: IsoDate } {
  parseYearMonth(ym);
  return { start: `${ym}-01`, end: `${ym}-31` };
}

/** רשימת N חודשים שנגמרת ב-endYm (כולל), מהישן לחדש. */
export function lastMonths(endYm: YearMonth, count: number): YearMonth[] {
  return Array.from({ length: count }, (_, i) => addMonths(endYm, i - (count - 1)));
}

export function hebrewMonthName(ym: YearMonth): string {
  return translateText(HEBREW_MONTHS[parseYearMonth(ym).month - 1]);
}

/** "אוקטובר 2026" */
export function formatMonthYear(ym: YearMonth): string {
  return `${hebrewMonthName(ym)} ${parseYearMonth(ym).year}`;
}

/** 2026-10-07 -> 07/10/2026 */
export function formatDisplayDate(date: IsoDate): string {
  if (!isValidIsoDate(date)) return date;
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
