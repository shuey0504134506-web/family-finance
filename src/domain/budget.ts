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
