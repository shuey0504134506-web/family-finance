import { MultiCurrencySummary } from '../../components/MultiCurrencySummary';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { Icon } from '../../components/Icon';
import { AppHeader } from '../../components/AppHeader';
import { ScopeTabs } from '../../components/ScopeTabs';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { useSwipe } from '../../hooks/useSwipe';
import { neighborSpace } from '../../domain/display';
import { addMonths, formatDisplayDate, todayIso } from '../../domain/dates';
import { currencyOf } from '../../domain/currency';
import { businessIdOf } from '../../domain/spaces';
import { useBusinessLogo } from '../../hooks/useBusinessLogo';
import {
  householdTotals,
  totalsOf,
  transferFromBusinesses,
} from '../../domain/summary';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { SpendingCard } from './SpendingCard';
import { BalanceFrame } from './BalanceFrame';
import { earliestDate, notStartedText, previousStageHeadline, sinceStartText, uptoDayOfMonth } from './homeText';
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

  // השוואה לחודש הקודם באותו שלב (רק בחודש הנוכחי)
  const compare = month.status === 'current';
  const prevMonth = addMonths(month.selected, -1);
  const prevBusiness = useMonthTransactions(user.uid, 'business', prevMonth, month.status !== 'future' && needBusiness);
  const prevHousehold = useMonthTransactions(user.uid, 'household', prevMonth, month.status !== 'future' && (hasHousehold || !isBusiness));

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

  const previousStage = useMemo(() => {
    if (!compare || prevBusiness.loading || prevHousehold.loading) return null;
    if (prevBusiness.error || prevHousehold.error) return null;
    const day = Number(todayIso().slice(8, 10));
    const bizAll = uptoDayOfMonth(prevBusiness.items, day);
    if (isBusiness) {
      const own = bizAll.filter((t) => businessIdOf(t) === space.businessId);
      return own.length === 0 ? null : totalsOf(own).balanceAgorot;
    }
    const hh = uptoDayOfMonth(prevHousehold.items, day);
    const counted = new Set(countedIds);
    const prevTransfer = transferFromBusinesses(
      bizAll.filter((t) => counted.has(businessIdOf(t))),
      settings.businessTransferMode,
    );
    if (hh.length === 0 && prevTransfer === 0) return null;
    return householdTotals(hh, prevTransfer).balanceAgorot;
  }, [compare, prevBusiness, prevHousehold, isBusiness, space.businessId, countedIds, settings.businessTransferMode]);
  // הוצאות החודש הקודם להשוואה בכרטיס "לאן הלך הכסף": במלואו, ועד אותו יום בחודש הנוכחי
  const prevScopeItems = useMemo(
    () => (isBusiness ? prevBusiness.items.filter((t) => businessIdOf(t) === space.businessId) : prevHousehold.items),
    [isBusiness, prevBusiness.items, prevHousehold.items, space.businessId],
  );
  const prevStageScopeItems = useMemo(
    () => (compare ? uptoDayOfMonth(prevScopeItems, Number(todayIso().slice(8, 10))) : undefined),
    [compare, prevScopeItems],
  );
  const previousHeadline = previousStage === null ? null : previousStageHeadline(previousStage);

  // שלוש הפעולות האחרונות של המרחב והחודש שמוצגים, במטבע המקורי
  const recent = useMemo(() => {
    const list = isBusiness ? business.all.filter((t) => businessIdOf(t) === space.businessId) : household.all;
    return [...list]
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
      .slice(0, 3);
  }, [isBusiness, business.all, household.all, space.businessId]);

  const activeItems = isBusiness ? ownBusinessItems : household.items;

  // מאז תחילת התיעוד: כל ההיסטוריה עד סוף החודש הנוכחי, לפי אותם כללים כמו בסיכום החודשי
  const allBusiness = useTransactionsUpTo(user.uid, 'business', month.current, needBusiness);
  const allHousehold = useTransactionsUpTo(user.uid, 'household', month.current, !isBusiness && hasHousehold);
  const sinceStart = useMemo(() => {
    if (allBusiness.loading || allHousehold.loading || allBusiness.error || allHousehold.error) return null;
    if (isBusiness) {
      const own = allBusiness.items.filter((t) => businessIdOf(t) === space.businessId);
      if (own.length === 0) return null;
      return { balanceAgorot: totalsOf(own).balanceAgorot, since: earliestDate(own) };
    }
    const counted = new Set(countedIds);
    const transfer = transferFromBusinesses(
      allBusiness.items.filter((t) => counted.has(businessIdOf(t))),
      settings.businessTransferMode,
    );
    if (allHousehold.items.length === 0 && transfer === 0) return null;
    return {
      balanceAgorot: householdTotals(allHousehold.items, transfer).balanceAgorot,
      since: earliestDate([...allHousehold.items, ...allBusiness.items.filter((t) => counted.has(businessIdOf(t)))]),
    };
  }, [allBusiness, allHousehold, isBusiness, space.businessId, countedIds, settings.businessTransferMode]);
  const sinceStartHeadline = sinceStart === null ? null : sinceStartText(sinceStart.balanceAgorot);

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
  const logo = useBusinessLogo(user.uid, isBusiness ? space.businessId : '');
  const manyBusinesses = countedIds.length > 1;
  const businessIncomeLabel = manyBusinesses ? 'הכנסה מהעסקים' : 'הכנסה מהעסק';
  const businessLossLabel = manyBusinesses ? 'הפסד מהעסקים' : 'הפסד מהעסק';

  return (
    <div className={`app-shell has-hero home-clean scope-${scope}`} {...swipe}>
      <AppHeader />

      <main className="content" aria-busy={loading}>
        <h1 className="scope-title">
          {logo ? <img className="scope-logo" src={logo} alt="" width={36} height={36} /> : <Icon name={isBusiness ? 'business' : 'household'} />} {title}
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

        {!loading && !active.error && previousHeadline && (
          <p className="previous-stage">
            <span className="previous-stage-text">{previousHeadline.text}</span>
            {previousHeadline.amountAgorot !== null && (
              <span className="previous-stage-amount">
                <Amount
                  agorot={previousHeadline.amountAgorot}
                  className={previousStage !== null && previousStage < 0 ? 'tone-expense' : 'tone-income'}
                />
              </span>
            )}
          </p>
        )}

        <TotalsTiles
          incomeAgorot={totals.incomeAgorot}
          expenseAgorot={totals.expenseAgorot}
          loading={loading}
          onOpenIncome={() => navigate(`/${space.key}/list/income`)}
          onOpenExpense={() => navigate(`/${space.key}/list/expense`)}
        />

        {!active.error && (
          <div className="add-actions">
            <button
              type="button"
              className="btn btn-income"
              onClick={() => navigate(`/${space.key}/add/income`)}
            >
              הוספת הכנסה
            </button>
            <button
              type="button"
              className="btn btn-expense"
              onClick={() => navigate(`/${space.key}/add/expense`)}
            >
              הוספת הוצאה
            </button>
          </div>
        )}

        {!loading && !active.error && (
          <MultiCurrencySummary
            items={isBusiness ? business.all.filter((t) => businessIdOf(t) === space.businessId) : household.all}
            primaryIncomeAgorot={totals.incomeAgorot}
            primaryExpenseAgorot={totals.expenseAgorot}
          />
        )}

        {!loading && !active.error && month.status !== 'future' && (
          <SpendingCard
            key={`${space.key}|${month.selected}`}
            scope={scope}
            businessId={space.businessId}
            selected={month.selected}
            monthItems={activeItems}
            prevItems={prevScopeItems}
            prevStageItems={prevStageScopeItems}
            onOpenBreakdown={() => navigate(`/${space.key}/budget`)}
          />
        )}

        {!loading && !active.error && recent.length > 0 && (
          <section className="card recent-card" aria-labelledby="recent-title">
            <h2 id="recent-title" className="recent-title">
              פעולות אחרונות
            </h2>
            <ul className="recent-list">
              {recent.map((t) => (
                <li key={t.id} className="recent-row">
                  <span className="recent-name">
                    {t.counterparty || t.categoryName}
                    <span className="recent-date">{formatDisplayDate(t.date)}</span>
                  </span>
                  <Amount
                    agorot={t.amountAgorot}
                    currency={currencyOf(t)}
                    className={t.type === 'income' ? 'tone-income' : 'tone-expense'}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {sinceStart && sinceStartHeadline && (
          <section className="card since-card" aria-label="מתחילת התיעוד">
            <div className="since-text">{sinceStartHeadline.text}</div>
            {sinceStartHeadline.amountAgorot !== null && (
              <Amount
                agorot={sinceStartHeadline.amountAgorot}
                className={`since-amount ${sinceStartHeadline.tone === 'minus' ? 'tone-expense' : 'tone-income'}`}
              />
            )}
            {sinceStart.since && <div className="since-note">{`מאז ${formatDisplayDate(sinceStart.since)}`}</div>}
          </section>
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
      </main>

      {spaces.length > 1 && <ScopeTabs active={space} />}
    </div>
  );
}
