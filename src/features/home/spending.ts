export interface SpendingSlice {
  /** מזהה הקטגוריה, או 'other' לשארית */
  id: string;
  name: string;
  agorot: number;
}

export interface SpendingBreakdown {
  totalAgorot: number;
  slices: SpendingSlice[];
}

interface Expense {
  type: 'income' | 'expense';
  amountAgorot: number;
  categoryId: string;
  categoryName: string;
}

/**
 * פילוח ההוצאות לפי קטגוריה: הקטגוריות הגדולות ביותר, והשאר מצטבר ל"אחר".
 * רק הוצאות נספרות. קטגוריות בלי הוצאות לא מופיעות.
 */
export function spendingBreakdown(items: readonly Expense[], maxSlices = 4): SpendingBreakdown {
  const byId = new Map<string, SpendingSlice>();
  let total = 0;
  for (const t of items) {
    if (t.type !== 'expense' || t.amountAgorot <= 0) continue;
    total += t.amountAgorot;
    const slice = byId.get(t.categoryId);
    if (slice) slice.agorot += t.amountAgorot;
    else byId.set(t.categoryId, { id: t.categoryId, name: t.categoryName, agorot: t.amountAgorot });
  }
  const sorted = [...byId.values()].sort((a, b) => b.agorot - a.agorot);
  if (sorted.length <= maxSlices + 1) return { totalAgorot: total, slices: sorted };
  const head = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices).reduce((sum, s) => sum + s.agorot, 0);
  return { totalAgorot: total, slices: [...head, { id: 'other', name: 'קטגוריות נוספות', agorot: rest }] };
}

/** השינוי באחוזים של ההוצאות ביחס לתקופת ההשוואה, מעוגל. null כשאין השוואה אפשרית. */
export function spendingChangePercent(currentAgorot: number, previousAgorot: number): number | null {
  if (previousAgorot <= 0) return null;
  return Math.round(((currentAgorot - previousAgorot) / previousAgorot) * 100);
}
