import type { PaymentMethod, TransactionType } from '../types';
import type { ImportRow } from './parse';

/** פעולה קיימת, בצורה המינימלית שנדרשת להשוואה. */
export interface ExistingTx {
  id: string;
  type: TransactionType;
  amountAgorot: number;
  date: string;
  counterparty: string;
  note?: string;
  paymentMethod: PaymentMethod;
  currency?: string;
}

const STOP = new Set(['בעמ', 'בע', 'מ', 'ltd', 'inc', 'the', 'של', 'את', 'חיוב', 'קניה', 'קנייה', 'רכישה', 'תשלום', 'עסקה']);

/** שם מנורמל להשוואה: בלי פיסוק, ספרות (מספרי סניף) ומילות מילוי. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u200e\u200f]/g, '')
    .replace(/בע"מ|בע״מ/g, ' ')
    .replace(/[^a-zא-ת\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .join(' ');
}

function bigrams(s: string): Map<string, number> {
  const compact = s.replace(/\s+/g, '');
  const map = new Map<string, number>();
  for (let i = 0; i < compact.length - 1; i++) {
    const g = compact.slice(i, i + 2);
    map.set(g, (map.get(g) ?? 0) + 1);
  }
  return map;
}

/** דמיון בין שני שמות, 0..1. 0.3 = אחד השמות ריק (אין מידע). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0.3;
  if (na === nb) return 1;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  const jaccard = common / (ta.size + tb.size - common);
  const containment = common / Math.min(ta.size, tb.size);
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let inter = 0;
  let total = 0;
  for (const [g, n] of ga) {
    inter += Math.min(n, gb.get(g) ?? 0);
    total += n;
  }
  for (const n of gb.values()) total += n;
  const dice = total ? (2 * inter) / total : 0;
  return Math.max(jaccard, 0.9 * containment, dice);
}

function dayDiff(a: string, b: string): number {
  const ms = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.abs(Math.round(ms / 86400000));
}

function dateScore(days: number): number {
  if (days === 0) return 1;
  if (days === 1) return 0.9;
  if (days === 2) return 0.8;
  if (days <= 4) return 0.6;
  if (days <= 10) return 0.3;
  return 0;
}

function amountScore(a: number, b: number): number {
  if (a === b) return 1;
  const diff = Math.abs(a - b);
  if (diff <= 100 || diff <= Math.max(a, b) * 0.02) return 0.5; // עיגול / עמלה קטנה
  return 0;
}

function paymentScore(imported: PaymentMethod, existing: PaymentMethod): number {
  if (imported === existing) return 1;
  // אשראי נרשם לפעמים כדיירקט/העברה כשהחיוב הגיע מהבנק, ולהפך
  const bankish: PaymentMethod[] = ['direct', 'transfer', 'other'];
  if (bankish.includes(imported) && bankish.includes(existing)) return 0.8;
  return 0.4;
}

export type MatchLevel = 'exact' | 'likely' | 'possible' | 'none';

export interface Match {
  level: MatchLevel;
  /** הסתברות 0..1 שהשורה כבר קיימת */
  probability: number;
  existing?: ExistingTx;
}

/** ההסתברות ששורה מיובאת היא פעולה קיימת. הסכום הוא תנאי: בלי התאמה לפחות חלקית שלו אין התאמה. */
export function matchScore(row: Pick<ImportRow, 'type' | 'amountAgorot' | 'date' | 'name' | 'payment'>, e: ExistingTx): number {
  if (e.type !== row.type) return 0;
  const amount = amountScore(row.amountAgorot, e.amountAgorot);
  if (amount === 0) return 0;
  const days = dayDiff(row.date, e.date);
  const date = dateScore(days);
  if (date === 0) return 0;
  const name = nameSimilarity(row.name, `${e.counterparty}`);
  const payment = paymentScore(row.payment, e.paymentMethod);
  return 0.4 * amount + 0.25 * name + 0.2 * date + 0.15 * payment;
}

export const LIKELY_THRESHOLD = 0.86;
export const POSSIBLE_THRESHOLD = 0.68;

/**
 * מצמיד לכל שורה את הפעולה הקיימת הדומה לה ביותר. פעולה קיימת מוצמדת לשורה אחת בלבד
 * (כדי ששתי קניות זהות באותו יום לא יתפסו את אותה פעולה), לפי ההתאמות הטובות ביותר קודם.
 * existingIds: מזהים שנוצרו בייבוא קודם של אותו קובץ = התאמה מדויקת.
 */
export function findMatches(rows: readonly (Pick<ImportRow, 'type' | 'amountAgorot' | 'date' | 'name' | 'payment'> & { id: string })[], existing: readonly ExistingTx[]): Match[] {
  const result: Match[] = rows.map(() => ({ level: 'none', probability: 0 }));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const taken = new Set<string>();

  rows.forEach((row, i) => {
    const e = byId.get(row.id);
    if (e) {
      result[i] = { level: 'exact', probability: 1, existing: e };
      taken.add(e.id);
    }
  });

  const candidates: { i: number; e: ExistingTx; score: number }[] = [];
  rows.forEach((row, i) => {
    if (result[i]!.level === 'exact') return;
    for (const e of existing) {
      if (taken.has(e.id)) continue;
      const score = matchScore(row, e);
      if (score >= POSSIBLE_THRESHOLD) candidates.push({ i, e, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score);
  const rowDone = new Set<number>();
  for (const c of candidates) {
    if (rowDone.has(c.i) || taken.has(c.e.id)) continue;
    rowDone.add(c.i);
    taken.add(c.e.id);
    result[c.i] = { level: c.score >= LIKELY_THRESHOLD ? 'likely' : 'possible', probability: Math.min(0.99, c.score), existing: c.e };
  }
  return result;
}
