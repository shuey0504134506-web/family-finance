import { useMemo } from 'react';
import { buildAiData, type MonthTotals } from '../../domain/aiSummary';
import { effectiveSavingsGoal } from '../../domain/budget';
import { addMonths, todayIso } from '../../domain/dates';
import { periodTotals } from '../../domain/periods';
import { businessIdOf, inSpace } from '../../domain/spaces';
import { useBudgets } from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';
import { useDebts } from '../../hooks/useDebts';
import { useStandingOrders } from '../../hooks/useStandingOrders';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';

/**
 * הנתונים המלאים של המרחב לסקירה (כמו בקובץ הגיבוי, בלי תמונות): כל ההיסטוריה, תקציבים, חובות, הוראות קבע וקטגוריות.
 * ההיסטוריה משתפת את ההאזנה של מסך הבית ("מתחילת התיעוד"), ולכן אין קריאה נוספת מהשרת.
 * `build()` מחזיר את הנתונים שנשלחים למודל, ו-ready כשהכול נטען.
 */
export function useAiSummaryData(): { ready: boolean; error: boolean; build: () => Record<string, unknown> } {
  const { user } = useReadyAuth();
  const space = useSpace();
  const month = useMonth();
  const settings = useSettings();
  const { countedIds, nameOf } = useSpaces();
  const isBusiness = space.scope === 'business';

  const business = useTransactionsUpTo(user.uid, 'business', '9999-12', isBusiness || countedIds.length > 0);
  const household = useTransactionsUpTo(user.uid, 'household', '9999-12', !isBusiness);
  const { budgets, loading: budgetsLoading } = useBudgets(user.uid);
  const { debts, loading: debtsLoading } = useDebts(user.uid);
  const { orders, loading: ordersLoading } = useStandingOrders(user.uid);
  const { categories, loading: categoriesLoading } = useCategories(user.uid);

  const businessForCalc = useMemo(() => {
    if (isBusiness) return business.items.filter((t) => businessIdOf(t) === space.businessId);
    const counted = new Set(countedIds);
    return business.items.filter((t) => counted.has(businessIdOf(t)));
  }, [isBusiness, business.items, space.businessId, countedIds]);
  const scopeItems = isBusiness ? businessForCalc : household.items;

  const ready = !business.loading && !household.loading && !budgetsLoading && !debtsLoading && !ordersLoading && !categoriesLoading;
  const error = Boolean(business.error || household.error);
  const name = nameOf(space);

  const build = () => {
    const present = new Set<string>([month.selected]);
    for (const t of scopeItems) present.add(t.yearMonth);
    const ordered = [...present].sort();
    // כל החודשים מהראשון בתיעוד ועד החודש הנבחר (חודשים עתידיים עם פעולות כלולים)
    const first = ordered[0];
    const months: string[] = [];
    for (let ym = first; ym <= ordered[ordered.length - 1] && months.length < 600; ym = addMonths(ym, 1)) months.push(ym);
    const totals: MonthTotals[] = months.map((ym) => {
      const t = periodTotals(space.scope, household.items, businessForCalc, [ym], settings.businessTransferMode);
      return { yearMonth: ym, incomeAgorot: t.incomeAgorot, expenseAgorot: t.expenseAgorot };
    });
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    return buildAiData({
      spaceName: name,
      scopeLabel: isBusiness ? 'עסק' : 'משק בית',
      today: todayIso(),
      selected: month.selected,
      items: scopeItems,
      months: totals,
      budgets: budgets
        .filter((b) => inSpace(b, space) && !String(b.categoryId).startsWith('savings-goal'))
        .map((b) => ({ category: catName.get(b.categoryId) ?? b.categoryId, ...(b.period ? { period: b.period } : {}), amount: Math.round(b.amountAgorot) / 100 })),
      savingsGoal: effectiveSavingsGoal(budgets, space.scope, space.businessId, month.selected),
      debts: debts
        .filter((d) => inSpace(d, space))
        .map((d) => ({
          direction: d.direction === 'owe' ? 'אני חייב' : 'חייבים לי',
          name: d.name,
          amount: Math.round(d.amountAgorot) / 100,
          date: d.date,
          ...(d.dueDate ? { dueDate: d.dueDate } : {}),
          paid: Math.round(d.payments.reduce((a, p) => a + p.amountAgorot, 0)) / 100,
          note: d.note.slice(0, 80),
        })),
      standingOrders: orders
        .filter((o) => inSpace(o, space))
        .map((o) => ({ name: o.name, type: o.type === 'income' ? 'הכנסה' : 'הוצאה', amount: Math.round(o.amountAgorot) / 100, dayOfMonth: o.dayOfMonth, category: o.categoryName, active: o.active })),
      categories: categories.filter((c) => c.active && inSpace(c, space)).map((c) => ({ name: c.name, type: c.type === 'income' ? 'הכנסה' : 'הוצאה' })),
    });
  };
  return { ready, error, build };
}
