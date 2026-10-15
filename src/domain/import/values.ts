/** קריאת ערכים מתאי קובץ: סכומים ותאריכים בכל הצורות שבהן בנקים וחברות אשראי בישראל מייצאים אותם. */

export type Cell = string | number | boolean | Date | null | undefined;

/** מנקה תו כיווניות, רווח קשיח ורווחים כפולים. */
export function cleanText(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';
  return String(value)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
}

/**
 * סכום באגורות (שלמות, עם סימן), או null אם התא אינו סכום.
 * מקבל: 1234.5 | "1,234.50" | "₪ 1,234.50" | "(123.40)" | "-123.4" | "123.4-" | "12,50".
 */
export function parseAmountAgorot(value: Cell): number | null {
  if (value === null || value === undefined || value === '' || value instanceof Date) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }
  if (typeof value === 'boolean') return null;
  let s = cleanText(value);
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[₪$€£]|ש"ח|שח|ILS|USD|EUR|GBP|NIS/gi, '').replace(/\s+/g, '');
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^[0-9][0-9,.]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIsDot = lastDot > lastComma;
    normalized = decimalIsDot ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    const after = s.length - lastComma - 1;
    // פסיק יחיד ואחריו 3 ספרות = אלפים; 1-2 ספרות = עשרוני
    normalized = after === 3 ? s.replace(/,/g, '') : s.replace(/,/g, '.');
    if (normalized.split('.').length > 2) normalized = s.replace(/,/g, '');
  } else {
    normalized = s;
    if (normalized.split('.').length > 2) {
      // 1.234.567 = אלפים
      normalized = normalized.replace(/\./g, '');
    }
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const agorot = Math.round(n * 100);
  return negative ? -agorot : agorot;
}

const pad = (n: number) => String(n).padStart(2, '0');

function validIso(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** תאריך YYYY-MM-DD מתא: טקסט (יום קודם לחודש), מספר סידורי של אקסל, או Date. */
export function parseDateCell(value: Cell): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : validIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') {
    if (value < 32000 || value > 80000) return null; // 1987..2119
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return validIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof value === 'boolean') return null;
  const s = cleanText(value);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) return validIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ T].*)?$/.exec(s);
  if (m) {
    const yy = m[3]!;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    return validIso(year, Number(m[2]), Number(m[1]));
  }
  return null;
}
