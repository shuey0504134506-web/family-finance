import { EN } from './en';
import { isEnglish } from './lang';

const HEBREW = /[֐-׿]/;

interface Pattern {
  regex: RegExp;
  english: string;
  order: number[];
  weight: number;
}

const escape = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// תבניות עם {n}: הערכים הדינמיים עצמם מתורגמים רקורסיבית (למשל שם חודש או תווית).
const patterns: Pattern[] = Object.entries(EN)
  .filter(([he]) => /\{\d\}/.test(he))
  .map(([he, english]) => ({
    regex: new RegExp('^' + he.split(/\{\d\}/).map(escape).join('(.+?)') + '$'),
    order: [...he.matchAll(/\{(\d)\}/g)].map((m) => Number(m[1])),
    english,
    weight: he.replace(/\{\d\}/g, '').length,
  }))
  .sort((a, b) => b.weight - a.weight);

const cache = new Map<string, string>();

// "אוקטובר 2026" -> "October 2026"
const MONTH_YEAR = /^(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר) (\d{4})$/;

function lookup(core: string): string {
  const exact = EN[core];
  if (exact !== undefined) return exact;
  const monthYear = MONTH_YEAR.exec(core);
  if (monthYear) return `${EN[monthYear[1]]} ${monthYear[2]}`;
  for (const p of patterns) {
    const m = p.regex.exec(core);
    if (!m) continue;
    const values: string[] = [];
    p.order.forEach((index, i) => {
      values[index] = translateText(m[i + 1], true);
    });
    return p.english.replace(/\{(\d)\}/g, (_, d) => values[Number(d)] ?? '');
  }
  return segment(core) ?? core;
}

/**
 * ביטוי שהורכב מכמה מחרוזות מוכרות (למשל "החודש אנחנו" + "בפלוס"):
 * מתרגם רק אם כל המילים מכוסות, כדי לא לערבב עברית ואנגלית בטקסט של המשתמש.
 */
function segment(core: string): string | null {
  const words = core.split(' ');
  if (words.length < 2) return null;
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let hit: string | undefined;
    let len = Math.min(8, words.length - i);
    for (; len > 0; len--) {
      hit = EN[words.slice(i, i + len).join(' ')];
      if (hit !== undefined) break;
    }
    if (hit === undefined) return null;
    out.push(hit);
    i += len;
  }
  return out.join(' ');
}

/** מתרגמת טקסט עברי לאנגלית (כשהשפה אנגלית). טקסט לא מוכר מוחזר כמות שהוא. */
export function translateText(text: string, force = false): string {
  if ((!force && !isEnglish()) || !HEBREW.test(text)) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const lead = /^\s*/.exec(text)![0];
  const trail = /\s*$/.exec(text)![0];
  const core = text.trim().replace(/\s+/g, ' ');
  const result = core ? lead + lookup(core) + (lead.length === text.length ? '' : trail) : text;
  if (cache.size < 5000) cache.set(text, result);
  return result;
}

/** קיצור לשימוש בקוד שאינו JSX (למשל תוויות CSV). */
export const tr = (text: string): string => translateText(text);
