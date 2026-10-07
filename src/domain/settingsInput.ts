import { parseShekelsToAgorot } from './money';

/**
 * אחוז מעשר כטקסט -> נקודות בסיס (10 -> 1000, 7.5 -> 750).
 * משתמש באותו פענוח קפדני של סכומים (שתי ספרות אחרי הנקודה לכל היותר), כי אחוז עם
 * שתי ספרות עשרוניות הוא בדיוק "מאית", כמו אגורה. מחזיר null אם הערך אינו תקין או מחוץ ל-0..100.
 */
export function parsePercentToBps(text: string): number | null {
  const cleaned = text.replace(/%/g, '');
  const bps = parseShekelsToAgorot(cleaned);
  if (bps === null || bps < 0 || bps > 10_000) return null;
  return bps;
}

/** 1000 -> "10", 750 -> "7.5", 825 -> "8.25" */
export function formatBpsAsPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
