import { mulDivRound, type Agorot } from './money';

/**
 * שינוי באחוזים בין שני סכומים, עם ספרה עשרונית אחת (למשל 18.3).
 * מחזיר null כשאי אפשר לחשב (הסכום הקודם הוא 0).
 */
export function percentChange(previous: Agorot, current: Agorot): number | null {
  if (previous === 0) return null;
  return mulDivRound(current - previous, 1000, Math.abs(previous)) / 10;
}

/** 18.3 -> "+18.3%", -5 -> "-5.0%", 0 -> "0.0%" */
export function formatPercentChange(change: number | null): string {
  if (change === null) return '—';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}
