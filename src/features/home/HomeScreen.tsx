import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { AppHeader } from '../../components/AppHeader';
import { ScopeTabs } from '../../components/ScopeTabs';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { useSwipe } from '../../hooks/useSwipe';
import {
  businessNet,
  businessTransferToHousehold,
  householdTotals,
  totalsOf,
} from '../../domain/summary';
import { scopesForMode, type Scope } from '../../domain/types';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { TransactionList } from '../transactions/TransactionList';
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
          <span aria-hidden="true">{isBusiness ? '💼' : '🏠'}</span> {title}
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
        />

        {month.status !== 'future' && !active.error && (
          <div className="add-actions">
            <button
              type="button"
              className="btn btn-income"
              onClick={() => navigate(`/${scope}/add/income`)}
            >
              ＋ הכנסה
            </button>
            <button
              type="button"
              className="btn btn-expense"
              onClick={() => navigate(`/${scope}/add/expense`)}
            >
              ＋ הוצאה
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
                <span aria-hidden="true">💼</span>{' '}
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

        {!isBusiness && month.status !== 'future' && (
          <button type="button" className="btn btn-secondary tithe-link" onClick={() => navigate('/tithes')}>
            🙏 מעשרות
          </button>
        )}

        {month.status !== 'future' && !active.error && !active.loading && (
          <TransactionList scope={scope} items={active.items} />
        )}
      </main>

      {hasBusiness && hasHousehold && <ScopeTabs active={scope} />}
    </div>
  );
}
