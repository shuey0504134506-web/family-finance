import { CURRENCY_NAMES, foreignTotals, isPrimaryCurrency } from '../../domain/currency';
import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { formatMonthYear } from '../../domain/dates';
import { MonthSwitcher } from '../../components/MonthSwitcher';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { businessIdOf } from '../../domain/spaces';
import { totalsOf, transferFromBusinesses } from '../../domain/summary';
import type { TransactionType } from '../../domain/types';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
import { TransactionList } from './TransactionList';

/**
 * רשימת ההכנסות או ההוצאות של החודש הנבחר, לעסק או למשק הבית.
 * נפתחת בלחיצה על משבצת הסכום במסך הבית, ובמעבר מתוצאת חיפוש.
 * במשק הבית, ההכנסה מהעסקים (נטו) מוצגת בראש רשימת ההכנסות כשורה נגזרת.
 */
export function TransactionListScreen() {
  const params = useParams();
  const type = params.type as TransactionType;
  if (type !== 'income' && type !== 'expense') return <Navigate to="/" replace />;
  return <Content type={type} />;
}

function Content({ type }: { type: TransactionType }) {
  const navigate = useNavigate();
  const location = useLocation();
  const highlightId = (location.state as { highlightId?: string } | null)?.highlightId;
  const { user } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();
  const space = useSpace();
  const scope = space.scope;
  const { countedIds, nameOf } = useSpaces();

  const needsBusinessNet = scope === 'household' && type === 'income' && countedIds.length > 0;

  const main = useMonthTransactions(user.uid, scope, month.selected, true);
  const business = useMonthTransactions(user.uid, 'business', month.selected, needsBusinessNet);

  const items = useMemo(
    () =>
      main.all.filter(
        (t) => t.type === type && (scope === 'household' || businessIdOf(t) === space.businessId),
      ),
    [main.all, type, scope, space.businessId],
  );
  const ownTotal = useMemo(() => totalsOf(items.filter(isPrimaryCurrency)), [items]);
  const foreign = useMemo(() => foreignTotals(items), [items]);
  const fromBusiness = useMemo(() => {
    if (!needsBusinessNet) return 0;
    const counted = new Set(countedIds);
    return transferFromBusinesses(
      business.items.filter((t) => counted.has(businessIdOf(t))),
      settings.businessTransferMode,
    );
  }, [needsBusinessNet, business.items, countedIds, settings.businessTransferMode]);

  const isIncome = type === 'income';
  const total = (isIncome ? ownTotal.incomeAgorot : ownTotal.expenseAgorot) + fromBusiness;
  const loading = main.loading || (needsBusinessNet && business.loading);

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title={`${isIncome ? 'הכנסות' : 'הוצאות'} · ${nameOf(space)}`} search />
      <main className="content" aria-busy={loading}>
        <MonthSwitcher label={formatMonthYear(month.selected)} />

        {main.error ? (
          <div className="card error-card" role="alert">
            <p>לא הצלחנו לטעון את הנתונים.</p>
            <button type="button" className="btn btn-secondary" onClick={main.retry}>
              ניסיון חוזר
            </button>
          </div>
        ) : loading ? (
          <div className="card notice-card" role="status">
            טוען נתונים…
          </div>
        ) : (
          <>
            <section className="card">
              <div className="row-between">
                <span>סך הכול</span>
                <Amount agorot={total} className={isIncome ? 'tone-income' : 'tone-expense'} />
              </div>
              {foreign.map((f) => (
                <div className="row-between" key={f.currency}>
                  <span className="muted">ובמטבע {CURRENCY_NAMES[f.currency]}</span>
                  <Amount
                    agorot={isIncome ? f.incomeAgorot : f.expenseAgorot}
                    currency={f.currency}
                    className={isIncome ? 'tone-income' : 'tone-expense'}
                  />
                </div>
              ))}
            </section>

            <button
              type="button"
              className={`btn btn-add ${isIncome ? 'btn-income' : 'btn-expense'}`}
              onClick={() => navigate(`/${space.key}/add/${type}`)}
            >
              {isIncome ? 'הוספת הכנסה' : 'הוספת הוצאה'}
            </button>

            {needsBusinessNet && fromBusiness !== 0 && (
              <section className="card business-income-card">
                <div className="row-between">
                  <span>
                    <Icon name="business" /> {fromBusiness < 0 ? 'הפסד מהעסקים (נטו)' : 'הכנסה מהעסקים (נטו)'}
                  </span>
                  <Amount agorot={Math.abs(fromBusiness)} className={fromBusiness < 0 ? 'tone-expense' : 'tone-income'} />
                </div>
                <p className="muted small">שורה נגזרת מנתוני העסק. אין לערוך אותה כאן.</p>
              </section>
            )}

            <TransactionList spaceKey={space.key} items={items} highlightId={highlightId} />
          </>
        )}
      </main>
    </div>
  );
}
