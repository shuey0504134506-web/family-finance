import { mulDivRound, type Agorot } from './money';
import { DEFAULT_BUSINESS_ID, inSpace } from './spaces';

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

import type { Budget, Category, Scope } from './types';

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
  return buildBudgetRowsFromMap(
    categories,
    new Map(budgets.map((b) => [b.categoryId, b.amountAgorot])),
    usedByCategory,
  );
}

/** כמו buildBudgetRows, כשהתקציבים כבר מחושבים כמפה: מזהה קטגוריה -> סכום. */
export function buildBudgetRowsFromMap(
  categories: readonly Category[],
  budgetByCategory: ReadonlyMap<string, Agorot>,
  usedByCategory: ReadonlyMap<string, Agorot>,
): BudgetRow[] {
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

// ---------- תקציב כללי + תקציבים פרטניים ----------

/** מזהה מסמך התקציב הכללי של תחום. אינו מתנגש עם מזהי קטגוריות. */
export function overallBudgetId(scope: Scope, businessId?: string): string {
  // העסק הראשון (וכל נתון ישן) שומר על המזהה המקורי.
  if (scope === 'business' && businessId && businessId !== DEFAULT_BUSINESS_ID) {
    return `overall-business-${businessId}`;
  }
  return `overall-${scope}`;
}

export interface SplitBudgets {
  /** התקציב החודשי הכללי, או null אם לא הוגדר */
  overallAgorot: Agorot | null;
  /** תקציבים פרטניים לפי מזהה קטגוריה */
  byCategory: Map<string, Agorot>;
  /** סכום כל התקציבים הפרטניים */
  categoriesTotalAgorot: Agorot;
}

/** מזהה מסמך תקציב: בלי תקופה הוא מזהה הקטגוריה, ועם תקופה `${מזהה}@${תקופה}`. */
export function budgetDocId(baseId: string, period?: string): string {
  return period ? `${baseId}@${period}` : baseId;
}

/**
 * מפריד את מסמכי התקציב של תחום לתקציב כללי ולתקציבים פרטניים.
 * בלי period: רק התקציבים החודשיים הקבועים. עם period ('YYYY-MM' או 'YYYY'): רק מסמכי התקופה הזו.
 */
export function splitBudgets(
  budgets: readonly Budget[],
  scope: Scope,
  businessId?: string,
  period?: string,
): SplitBudgets {
  const overallId = overallBudgetId(scope, businessId);
  const space = { key: '', scope, businessId: scope === 'business' ? businessId || DEFAULT_BUSINESS_ID : '' };
  let overallAgorot: Agorot | null = null;
  const byCategory = new Map<string, Agorot>();
  let total = 0;
  for (const b of budgets) {
    if (!inSpace(b, space)) continue;
    if ((b.period ?? undefined) !== period) continue;
    if (b.categoryId === overallId) {
      overallAgorot = b.amountAgorot;
    } else {
      byCategory.set(b.categoryId, b.amountAgorot);
      total += b.amountAgorot;
    }
  }
  return { overallAgorot, byCategory, categoriesTotalAgorot: total };
}

export interface EffectiveBudgets extends SplitBudgets {
  /** התקציב הכללי של החודש נקבע במיוחד לחודש הזה */
  overallOverridden: boolean;
  /** קטגוריות שיש להן תקציב מיוחד לחודש הזה */
  overriddenCategories: Set<string>;
}

/**
 * התקציב בפועל לחודש מסוים: התקציב הקבוע, כשכל פריט שנקבע במיוחד לחודש הזה דורס את הקבוע.
 * הדריסה היא פריט-פריט: קטגוריה בלי תקציב מיוחד ממשיכה לפי הקבוע.
 */
export function effectiveMonthly(
  budgets: readonly Budget[],
  scope: Scope,
  businessId: string | undefined,
  yearMonth: string,
): EffectiveBudgets {
  const general = splitBudgets(budgets, scope, businessId);
  const month = splitBudgets(budgets, scope, businessId, yearMonth);
  const byCategory = new Map(general.byCategory);
  for (const [id, amount] of month.byCategory) byCategory.set(id, amount);
  let total = 0;
  for (const amount of byCategory.values()) total += amount;
  return {
    overallAgorot: month.overallAgorot ?? general.overallAgorot,
    byCategory,
    categoriesTotalAgorot: total,
    overallOverridden: month.overallAgorot !== null,
    overriddenCategories: new Set(month.byCategory.keys()),
  };
}

export type BudgetSummary =
  | { kind: 'none' }
  | {
      kind: 'set';
      /** על מה מבוסס החישוב: התקציב הכללי, או סכום התקציבים הפרטניים */
      basis: 'overall' | 'categories';
      budgetAgorot: Agorot;
      usedAgorot: Agorot;
      /** סכום החריגה (0 אם לא חרגו) */
      overAgorot: Agorot;
      status: BudgetStatus;
    };

/**
 * תקציר לכפתור במסך הבית.
 * יש תקציב כללי: משווים אליו את כל הוצאות החודש.
 * אין כללי אבל יש פרטניים: משווים את ההוצאות בקטגוריות שיש להן תקציב לסכום התקציבים.
 */
export function summarizeBudget(
  split: SplitBudgets,
  expenseByCategory: ReadonlyMap<string, Agorot>,
): BudgetSummary {
  let basis: 'overall' | 'categories';
  let budget: Agorot;
  let used: Agorot;
  if (split.overallAgorot !== null) {
    basis = 'overall';
    budget = split.overallAgorot;
    used = 0;
    for (const amount of expenseByCategory.values()) used += amount;
  } else if (split.byCategory.size > 0) {
    basis = 'categories';
    budget = split.categoriesTotalAgorot;
    used = 0;
    for (const id of split.byCategory.keys()) used += expenseByCategory.get(id) ?? 0;
  } else {
    return { kind: 'none' };
  }
  return {
    kind: 'set',
    basis,
    budgetAgorot: budget,
    usedAgorot: used,
    overAgorot: Math.max(0, used - budget),
    status: budgetStatus(budget, used),
  };
}
