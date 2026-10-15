import { normalizeName, nameSimilarity } from './match';
import type { TransactionType } from '../types';

export interface HistoryTx {
  type: TransactionType;
  counterparty: string;
  categoryId: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  type: TransactionType;
}

/** שם עסק מנורמל -> הקטגוריה הנפוצה ביותר שהמשתמש נתן לו בעבר (לפי סוג). */
export function learnCategories(history: readonly HistoryTx[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const h of history) {
    const key = `${h.type}:${normalizeName(h.counterparty)}`;
    if (key.endsWith(':')) continue;
    const m = counts.get(key) ?? new Map<string, number>();
    m.set(h.categoryId, (m.get(h.categoryId) ?? 0) + 1);
    counts.set(key, m);
  }
  const best = new Map<string, string>();
  for (const [key, m] of counts) {
    let top = '';
    let n = 0;
    for (const [id, c] of m) if (c > n) [top, n] = [id, c];
    best.set(key, top);
  }
  return best;
}

/** קטגוריות חברת האשראי -> מילות מפתח בשמות הקטגוריות של המשתמש. */
const ISSUER_HINTS: [RegExp, RegExp][] = [
  [/מזון|סופר|מכולת|צריכה/, /מזון|סופר|מכולת|קניות|אוכל/],
  [/מסעד|בית קפה|קפה|אוכל/, /מסעד|קפה|בילוי|אוכל/],
  [/דלק|תחבורה|רכב|חנייה|חניה|תחבורה ציבורית/, /רכב|דלק|תחבורה|נסיעות/],
  [/ביטוח/, /ביטוח/],
  [/בריאות|רפוא|תרופ|פארם/, /בריאות|רפוא|תרופות/],
  [/חשמל|מים|גז|ארנונה|תקשורת|סלולר|אינטרנט|טלוויזיה|טלפון/, /חשמל|מים|ארנונה|תקשורת|טלפון|חשבונות|בית/],
  [/ביגוד|הנעלה|אופנה/, /ביגוד|הנעלה|אופנה/],
  [/בילוי|פנאי|ספורט|תיירות|נופש|טיסות|מלון/, /בילוי|פנאי|נופש|חופשה|תיירות|ספורט/],
  [/חינוך|לימודים|ספרים|גנים/, /חינוך|לימודים|ילדים|ספרים/],
  [/ריהוט|מוצרי חשמל|בית|שיפוצים/, /בית|ריהוט|שיפוצים|חשמל/],
];

/**
 * הצעת קטגוריה לשורה: קודם לפי ההיסטוריה (אותו עסק, או עסק דומה מאוד), אחר כך לפי הקטגוריה של חברת האשראי.
 * מחזיר null כשאין הצעה סבירה, ואז המשתמש נשאל.
 */
export function suggestCategory(
  row: { type: TransactionType; name: string; issuerCategory: string },
  learned: ReadonlyMap<string, string>,
  categories: readonly CategoryOption[],
): { categoryId: string; source: 'history' | 'issuer' } | null {
  const valid = new Set(categories.filter((c) => c.type === row.type).map((c) => c.id));
  const exact = learned.get(`${row.type}:${normalizeName(row.name)}`);
  if (exact && valid.has(exact)) return { categoryId: exact, source: 'history' };

  // עסק דומה מאוד בהיסטוריה (שגיאת כתיב, סניף אחר)
  let bestId = '';
  let bestScore = 0;
  const prefix = `${row.type}:`;
  for (const [key, id] of learned) {
    if (!key.startsWith(prefix) || !valid.has(id)) continue;
    const score = nameSimilarity(row.name, key.slice(prefix.length));
    if (score > bestScore) [bestId, bestScore] = [id, score];
  }
  if (bestScore >= 0.8) return { categoryId: bestId, source: 'history' };

  if (row.issuerCategory) {
    const options = categories.filter((c) => c.type === row.type);
    const direct = options.find((c) => normalizeName(c.name) === normalizeName(row.issuerCategory));
    if (direct) return { categoryId: direct.id, source: 'issuer' };
    for (const [issuerRe, ownRe] of ISSUER_HINTS) {
      if (!issuerRe.test(row.issuerCategory)) continue;
      const match = options.find((c) => ownRe.test(c.name));
      if (match) return { categoryId: match.id, source: 'issuer' };
    }
  }
  return null;
}
