import { mulDivRound, type Agorot } from './money';

/**
 * ניצול תקציב וסטטוס התראה.
 * ספים: מתחת ל-75% תקין | 75-90% מתקרבים | 90-100% קרובים מאוד | מעל 100% חריגה.
 */
export type BudgetStatus = 'ok' | 'approaching' | 'near' | 'over';

export interface BudgetUsage {
  budgetAgorot: Agorot;
  usedAgorot: Agorot;
  /** יכול להיות שלילי בחריגה */
  remainingAgorot: Agorot;
  /** אחוז ניצול עם ספרה עשרונית אחת, או null כשאין תקציב להשוות אליו */
  percentUsed: number | null;
  status: BudgetStatus;
}

export function budgetStatus(budgetAgorot: Agorot, usedAgorot: Agorot): BudgetStatus {
  if (budgetAgorot <= 0) return usedAgorot > 0 ? 'over' : 'ok';
  // משווים בחשבון שלם: used/budget מול הספים, בלי מספרים עשרוניים.
  const scaled = usedAgorot * 100;
  if (scaled > budgetAgorot * 100) return 'over';
  if (scaled >= budgetAgorot * 90) return 'near';
  if (scaled >= budgetAgorot * 75) return 'approaching';
  return 'ok';
}

export function budgetUsage(budgetAgorot: Agorot, usedAgorot: Agorot): BudgetUsage {
  const percentUsed =
    budgetAgorot > 0 ? mulDivRound(usedAgorot, 1000, budgetAgorot) / 10 : null;
  return {
    budgetAgorot,
    usedAgorot,
    remainingAgorot: budgetAgorot - usedAgorot,
    percentUsed,
    status: budgetStatus(budgetAgorot, usedAgorot),
  };
}

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  ok: 'מצב תקין',
  approaching: 'מתקרבים לתקציב',
  near: 'קרובים מאוד לתקרה',
  over: 'חריגה',
};

import type { Budget, Category } from './types';

export interface BudgetRow {
  categoryId: string;
  categoryName: string;
  /** null = לא הוגדר תקציב לקטגוריה */
  usage: BudgetUsage | null;
  usedAgorot: Agorot;
}

/**
 * שורות מסך התקציב: כל קטגוריות ההוצאה הפעילות של התחום, עם התקציב (אם הוגדר) והניצול.
 * קטגוריה שהושבתה מופיעה רק אם יש בה הוצאות או תקציב. קודם קטגוריות עם תקציב, לפי חומרת הסטטוס.
 */
export function buildBudgetRows(
  categories: readonly Category[],
  budgets: readonly Budget[],
  usedByCategory: ReadonlyMap<string, Agorot>,
): BudgetRow[] {
  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b.amountAgorot]));
  const severity: Record<BudgetStatus, number> = { over: 0, near: 1, approaching: 2, ok: 3 };

  const rows = categories
    .filter((c) => c.type === 'expense')
    .filter(
      (c) => c.active || (usedByCategory.get(c.id) ?? 0) > 0 || budgetByCategory.has(c.id),
    )
    .map<BudgetRow>((c) => {
      const used = usedByCategory.get(c.id) ?? 0;
      const budget = budgetByCategory.get(c.id);
      return {
        categoryId: c.id,
        categoryName: c.name,
        usedAgorot: used,
        usage: budget === undefined ? null : budgetUsage(budget, used),
      };
    });

  return rows.sort((a, b) => {
    if (!a.usage && !b.usage) return 0;
    if (!a.usage) return 1;
    if (!b.usage) return -1;
    return severity[a.usage.status] - severity[b.usage.status];
  });
}
