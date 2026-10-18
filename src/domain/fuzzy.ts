/**
 * התאמה מקורבת לחיפוש: סובלת טעויות כתיב נפוצות בעברית (כתיב חסר/מלא, אותיות דומות,
 * אות חסרה, מיותרת או מוחלפת). משמשת רק אחרי שהתאמה מדויקת לא מצאה דבר, כדי שלא להרעיש תוצאות.
 */

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
/** אותיות שנשמעות דומה ונוטות להתחלף בטעות */
const SIMILAR: Record<string, string> = { ט: 'ת', ק: 'כ', ש: 'ס', ח: 'כ', ע: 'א', ה: 'א' };

/** מסיר ניקוד וגרשיים ומאחד אותיות סופיות. */
export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase('he')
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'׳״`]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c] ?? c)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** שלד: בלי יו"ד/וי"ו (כתיב מלא/חסר) ועם אותיות דומות מאוחדות, כדי ש"מעשרות" ו"מעשרוט" יתאימו. */
export function skeleton(word: string): string {
  return normalizeText(word)
    .replace(/[יו]/g, '')
    .replace(/[טקשחעה]/g, (c) => SIMILAR[c] ?? c)
    .replace(/(.)\1+/g, '$1');
}

/** מרחק עריכה (כולל החלפת אותיות סמוכות). */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1) {
    rows[i] = [i];
    for (let j = 1; j <= b.length; j += 1) rows[i][j] = i === 0 ? j : 0;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2][j - 2] + 1);
      rows[i][j] = v;
    }
  }
  return rows[a.length][b.length];
}

function allowedErrors(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
}

/** האם המילה (עם טעות אפשרית) מופיעה בטקסט. מילים עם ספרות מותאמות במדויק בלבד. */
export function fuzzyWordIn(haystackNormalized: string, wordRaw: string): boolean {
  const word = normalizeText(wordRaw);
  if (!word) return true;
  if (haystackNormalized.includes(word)) return true;
  if (/\d/.test(word)) return false;
  const tokens = haystackNormalized.split(' ').filter(Boolean);
  const skWord = skeleton(word);
  if (skWord.length >= 2) {
    for (const token of tokens) {
      const sk = skeleton(token);
      if (sk === skWord || (skWord.length >= 4 && sk.startsWith(skWord))) return true;
    }
  }
  const max = allowedErrors(word.length);
  if (max === 0) return false;
  for (const token of tokens) {
    // מילה מלאה, או תחילית של מילה (חיפוש חלקי: "מעשר" מול "מעשרות")
    if (editDistance(token, word, max) <= max) return true;
    if (token.length > word.length && editDistance(token.slice(0, word.length), word, max) <= max) return true;
    if (token.length > word.length + 1 && editDistance(token.slice(0, word.length + 1), word, max) <= max) return true;
  }
  return false;
}

/** כל מילות החיפוש מופיעות (בקירוב) בטקסט. */
export function fuzzyMatchAll(haystack: string, query: string): boolean {
  const hay = normalizeText(haystack);
  const words = normalizeText(query).split(' ').filter(Boolean);
  return words.length > 0 && words.every((w) => fuzzyWordIn(hay, w));
}
