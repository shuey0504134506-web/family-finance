import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { Icon } from '../../components/Icon';
import { AppHeader } from '../../components/AppHeader';
import { ScopeTabs } from '../../components/ScopeTabs';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { useSwipe } from '../../hooks/useSwipe';
import { splitBudgets, summarizeBudget } from '../../domain/budget';
import { neighborSpace } from '../../domain/display';
import { businessIdOf } from '../../domain/spaces';
import {
  householdTotals,
  totalsByCategory,
  totalsOf,
  transferFromBusinesses,
} from '../../domain/summary';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
import { useBudgets } from '../../hooks/useBudgets';
import { useTitheRows } from '../tithes/useTitheRows';
import { QuickLink } from './QuickLink';
import { BalanceFrame } from './BalanceFrame';
import { notStartedText } from './homeText';
import { TotalsTiles } from './TotalsTiles';

/**
 * מסך הבית של מרחב אחד: עסק מסוים או משק הבית, לפי הנתיב.
 * כל הנתונים מתייחסים לחודש שנבחר בכותרת.
 *
 * מניעת ספירה כפולה: למשק הבית עובר רק נטו כל עסק (הכנסות פחות הוצאות),
 * כסכום נגזר, והכנסות העסקים הגולמיות אינן נכנסות להכנסות משק הבית.
 * רק עסקים שנספרים במכשיר הזה (מוצגים, או שסומן "הכל משתקף") נכנסים לחישוב.
 */
export function HomeScreen() {
  const navigate = useNavigate();
  const { user } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();
  const space = useSpace();
  const scope = space.scope;
  const { spaces, countedIds, nameOf } = useSpaces();

  const hasHousehold = spaces.some((s) => s.scope === 'household');
  const isBusiness = scope === 'business';
  const needBusiness = isBusiness || countedIds.length > 0 || spaces.some((s) => s.scope === 'business');

  // משק הבית זקוק גם לנתוני העסקים של החודש כדי לחשב את ההכנסה מהם.
  const business = useMonthTransactions(user.uid, 'business', month.selected, needBusiness);
  const household = useMonthTransactions(user.uid, 'household', month.selected, hasHousehold || !isBusiness);

  const ownBusinessItems = useMemo(
    () => (isBusiness ? business.items.filter((t) => businessIdOf(t) === space.businessId) : []),
    [isBusiness, business.items, space.businessId],
  );
  const businessTotals = useMemo(() => totalsOf(ownBusinessItems), [ownBusinessItems]);
  const transferAgorot = useMemo(() => {
    const counted = new Set(countedIds);
    return transferFromBusinesses(
      business.items.filter((t) => counted.has(businessIdOf(t))),
      settings.businessTransferMode,
    );
  }, [business.items, countedIds, settings.businessTransferMode]);
  const householdSummary = useMemo(
    () => householdTotals(household.items, transferAgorot),
    [household.items, transferAgorot],
  );

  // תקציר התקציב לכפתור (לפי המרחב שמוצג)
  const { budgets } = useBudgets(user.uid);
  const activeItems = isBusiness ? ownBusinessItems : household.items;
  const budgetSummary = useMemo(
    () =>
      summarizeBudget(
        splitBudgets(budgets, scope, space.businessId),
        totalsByCategory(activeItems, 'expense'),
      ),
    [budgets, scope, space.businessId, activeItems],
  );

  // יתרת מעשרות: רק במשק הבית, ורק בחודש שהתחיל
  const showTithe = scope === 'household' && month.status !== 'future';
  const tithe = useTitheRows(showTithe);
  const titheCurrent = tithe.rows[tithe.rows.length - 1];

  const next = neighborSpace(spaces, space.key, 1);
  const previous = neighborSpace(spaces, space.key, -1);
  const swipe = useSwipe(
    // החלקה ימינה: חושפת את מה שמשמאל (המרחב הבא ברשימה, בסוף משק הבית). שמאלה: הקודם.
    () => {
      if (next) navigate(`/${next.key}`, { replace: true });
    },
    () => {
      if (previous) navigate(`/${previous.key}`, { replace: true });
    },
  );

  const active = isBusiness ? business : household;
  const loading = isBusiness
    ? business.loading
    : household.loading || (countedIds.length > 0 && business.loading);
  const totals = isBusiness ? businessTotals : householdSummary;
  const title = nameOf(space);
  const manyBusinesses = countedIds.length > 1;
  const businessIncomeLabel = manyBusinesses ? 'הכנסה מהעסקים' : 'הכנסה מהעסק';
  const businessLossLabel = manyBusinesses ? 'הפסד מהעסקים' : 'הפסד מהעסק';

  return (
    <div className={`app-shell has-hero scope-${scope}`} {...swipe}>
      <AppHeader />

      <main className="content" aria-busy={loading}>
        <h1 className="scope-title">
          <Icon name={isBusiness ? 'business' : 'household'} /> {title}
        </h1>

        {active.error ? (
          <div className="card error-card" role="alert">
            <p>לא הצלחנו לטעון את הנתונים.</p>
            <button type="button" className="btn btn-secondary" onClick={active.retry}>
              ניסיון חוזר
            </button>
          </div>
        ) : month.status === 'future' ? (
          <div className="card notice-card" role="status">
            {notStartedText(month.selected, month.current)}
          </div>
        ) : loading ? (
          <div className="card notice-card" role="status">
            טוען נתונים…
          </div>
        ) : (
          <BalanceFrame
            incomeAgorot={totals.incomeAgorot}
            expenseAgorot={totals.expenseAgorot}
            balanceAgorot={totals.balanceAgorot}
            fromBusinessAgorot={isBusiness ? undefined : householdSummary.fromBusinessAgorot}
            status={month.status}
            yearMonth={month.selected}
            currentYearMonth={month.current}
          />
        )}

        <TotalsTiles
          incomeAgorot={totals.incomeAgorot}
          expenseAgorot={totals.expenseAgorot}
          loading={loading}
          onOpenIncome={() => navigate(`/${space.key}/list/income`)}
          onOpenExpense={() => navigate(`/${space.key}/list/expense`)}
        />

        {month.status !== 'future' && !active.error && (
          <div className="add-actions">
            <button
              type="button"
              className="btn btn-income"
              onClick={() => navigate(`/${space.key}/add/income`)}
            >
              <Icon name="plus" /> הכנסה
            </button>
            <button
              type="button"
              className="btn btn-expense"
              onClick={() => navigate(`/${space.key}/add/expense`)}
            >
              <Icon name="plus" /> הוצאה
            </button>
          </div>
        )}

        {!isBusiness && countedIds.length > 0 && !loading && (
          <section
            className="card business-income-card"
            aria-label={householdSummary.fromBusinessAgorot < 0 ? businessLossLabel : businessIncomeLabel}
          >
            <div className="row-between">
              <span>
                <Icon name="business" />{' '}
                {householdSummary.fromBusinessAgorot < 0
                  ? `${businessLossLabel} (נטו)`
                  : `${businessIncomeLabel} (נטו)`}
              </span>
              <Amount
                agorot={Math.abs(householdSummary.fromBusinessAgorot)}
                className={householdSummary.fromBusinessAgorot < 0 ? 'tone-expense' : 'tone-income'}
              />
            </div>
            <p className="muted small">
              {householdSummary.fromBusinessAgorot < 0
                ? 'העסקים הפסידו החודש, וההפסד מקטין את הכנסות משק הבית.'
                : 'רק נטו העסק (הכנסות פחות הוצאות) נחשב הכנסה של משק הבית, כדי שלא ייספר פעמיים.'}
            </p>
          </section>
        )}

        {month.status !== 'future' && (
          <div className="quick-links">
            <QuickLink
              icon="budget"
              title="תקציב"
              tone={budgetSummary.kind === 'set' && budgetSummary.overAgorot > 0 ? 'bad' : undefined}
              onClick={() => navigate(`/${space.key}/budget`)}
            >
              {active.loading ? (
                'טוען…'
              ) : budgetSummary.kind === 'none' ? (
                'לא הוגדר תקציב'
              ) : budgetSummary.overAgorot > 0 ? (
                <>
                  חרגת מהתקציב החודש ב-<Amount agorot={budgetSummary.overAgorot} />
                </>
              ) : (
                <>
                  נוצל <Amount agorot={budgetSummary.usedAgorot} /> מתוך{' '}
                  <Amount agorot={budgetSummary.budgetAgorot} />
                </>
              )}
            </QuickLink>

            {!isBusiness && (
              <QuickLink
                icon="tithe"
                title="מעשרות"
                tone={titheCurrent && titheCurrent.cumulative.remainingAgorot > 0 ? 'bad' : undefined}
                onClick={() => navigate('/tithes')}
              >
                {tithe.loading || !titheCurrent ? (
                  'טוען…'
                ) : titheCurrent.cumulative.remainingAgorot > 0 ? (
                  <>
                    יתרת מעשרות לתת: <Amount agorot={titheCurrent.cumulative.remainingAgorot} />
                  </>
                ) : titheCurrent.cumulative.surplusAgorot > 0 ? (
                  <>
                    ניתן מעבר לנדרש: <Amount agorot={titheCurrent.cumulative.surplusAgorot} />
                  </>
                ) : (
                  'המעשר מאוזן'
                )}
              </QuickLink>
            )}
          </div>
        )}
      </main>

      {spaces.length > 1 && <ScopeTabs active={space} />}
    </div>
  );
}
