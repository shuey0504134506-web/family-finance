import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { Icon } from '../../components/Icon';
import { AppHeader } from '../../components/AppHeader';
import { ScopeTabs } from '../../components/ScopeTabs';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { useSwipe } from '../../hooks/useSwipe';
import { splitBudgets, summarizeBudget } from '../../domain/budget';
import {
  businessNet,
  businessTransferToHousehold,
  householdTotals,
  totalsByCategory,
  totalsOf,
} from '../../domain/summary';
import { scopesForMode, type Scope } from '../../domain/types';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useBudgets } from '../../hooks/useBudgets';
import { useTitheRows } from '../tithes/useTitheRows';
import { QuickLink } from './QuickLink';
import { BalanceFrame } from './BalanceFrame';
import { notStartedText } from './homeText';
import { TotalsTiles } from './TotalsTiles';

/**
 * מסך הבית: עסק או משק בית, לפי הנתיב. כל הנתונים מתייחסים לחודש שנבחר בכותרת.
 *
 * מניעת ספירה כפולה: למשק הבית עובר רק נטו העסק (הכנסות פחות הוצאות),
 * כסכום נגזר אחד. הכנסות העסק הגולמיות אינן נכנסות להכנסות משק הבית.
 */
export function HomeScreen({ scope }: { scope: Scope }) {
  const navigate = useNavigate();
  const { user, profile } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();

  const scopes = scopesForMode(profile.accountMode);
  const hasBusiness = scopes.includes('business');
  const hasHousehold = scopes.includes('household');

  // משק הבית זקוק גם לנתוני העסק של החודש כדי לחשב את ההכנסה מהעסק.
  const business = useMonthTransactions(user.uid, 'business', month.selected, hasBusiness);
  const household = useMonthTransactions(user.uid, 'household', month.selected, hasHousehold);

  const businessTotals = useMemo(() => totalsOf(business.items), [business.items]);
  const transferAgorot = useMemo(
    () =>
      hasBusiness
        ? businessTransferToHousehold(businessNet(businessTotals), settings.businessTransferMode)
        : 0,
    [hasBusiness, businessTotals, settings.businessTransferMode],
  );
  const householdSummary = useMemo(
    () => householdTotals(household.items, transferAgorot),
    [household.items, transferAgorot],
  );

  // תקציר התקציב לכפתור (לפי התחום שמוצג)
  const { budgets } = useBudgets(user.uid);
  const budgetSummary = useMemo(
    () =>
      summarizeBudget(
        splitBudgets(budgets, scope),
        totalsByCategory(scope === 'business' ? business.items : household.items, 'expense'),
      ),
    [budgets, scope, business.items, household.items],
  );

  // יתרת מעשרות: רק במשק הבית, ורק בחודש שהתחיל
  const showTithe = scope === 'household' && month.status !== 'future';
  const tithe = useTitheRows(showTithe);
  const titheCurrent = tithe.rows[tithe.rows.length - 1];

  const swipe = useSwipe(
    // החלקה ימינה: חושפת את מה שמשמאל (משק בית). שמאלה: העסק.
    () => {
      if (scope === 'business' && hasHousehold) navigate('/household', { replace: true });
    },
    () => {
      if (scope === 'household' && hasBusiness) navigate('/business', { replace: true });
    },
  );

  const isBusiness = scope === 'business';
  const active = isBusiness ? business : household;
  const loading = isBusiness
    ? business.loading
    : household.loading || (hasBusiness && business.loading);
  const totals = isBusiness ? businessTotals : householdSummary;
  const title = isBusiness ? profile.businessName : 'משק הבית';

  return (
    <div className={`app-shell scope-${scope}`} {...swipe}>
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
          onOpenIncome={() => navigate(`/${scope}/list/income`)}
          onOpenExpense={() => navigate(`/${scope}/list/expense`)}
        />

        {month.status !== 'future' && !active.error && (
          <div className="add-actions">
            <button
              type="button"
              className="btn btn-income"
              onClick={() => navigate(`/${scope}/add/income`)}
            >
              <Icon name="plus" /> הכנסה
            </button>
            <button
              type="button"
              className="btn btn-expense"
              onClick={() => navigate(`/${scope}/add/expense`)}
            >
              <Icon name="plus" /> הוצאה
            </button>
          </div>
        )}

        {!isBusiness && hasBusiness && !loading && (
          <section
            className="card business-income-card"
            aria-label={householdSummary.fromBusinessAgorot < 0 ? 'הפסד מהעסק' : 'הכנסה מהעסק'}
          >
            <div className="row-between">
              <span>
                <Icon name="business" />{' '}
                {householdSummary.fromBusinessAgorot < 0
                  ? 'הפסד מהעסק (נטו)'
                  : 'הכנסה מהעסק (נטו)'}
              </span>
              <Amount
                agorot={Math.abs(householdSummary.fromBusinessAgorot)}
                className={householdSummary.fromBusinessAgorot < 0 ? 'tone-expense' : 'tone-income'}
              />
            </div>
            <p className="muted small">
              {householdSummary.fromBusinessAgorot < 0
                ? 'העסק הפסיד החודש, וההפסד מקטין את הכנסות משק הבית.'
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
              onClick={() => navigate(`/${scope}/budget`)}
            >
              {active.loading || business.loading ? (
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

      {hasBusiness && hasHousehold && <ScopeTabs active={scope} />}
    </div>
  );
}
