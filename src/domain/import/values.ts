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
    const amount = Math.round(Math.abs(value) * 100);
    return Number.isSafeInteger(amount) ? (value < 0 && amount ? -amount : amount) : null;
  }
  if (typeof value === 'boolean') return null;
  let s = cleanText(value);
  if (!s) return null;
  let negative = false;
  let signed = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    signed = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[₪$€£]|ש"ח|שח|ILS|USD|EUR|GBP|NIS/gi, '').replace(/\s+/g, '');
  if (s.endsWith('-')) {
    if (signed) return null;
    negative = true;
    signed = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    if (signed) return null;
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    if (signed) return null;
    s = s.slice(1);
  }
  if (!/^[0-9][0-9,.]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIsDot = lastDot > lastComma;
    if (!(decimalIsDot ? /^\d{1,3}(,\d{3})+\.\d{1,2}$/ : /^\d{1,3}(\.\d{3})+,\d{1,2}$/).test(s)) return null;
    normalized = decimalIsDot ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) normalized = s.replace(/,/g, '');
    else if (/^\d+,\d{1,2}$/.test(s)) normalized = s.replace(',', '.');
    else return null;
  } else {
    normalized = s;
    if (normalized.split('.').length > 2) {
      // 1.234.567 = אלפים
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
      normalized = normalized.replace(/\./g, '');
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const agorot = Math.round(n * 100);
  return Number.isSafeInteger(agorot) ? (negative && agorot ? -agorot : agorot) : null;
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
