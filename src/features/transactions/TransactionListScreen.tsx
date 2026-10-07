import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../components/Icon';
import { businessNet, businessTransferToHousehold, totalsOf } from '../../domain/summary';
import { scopesForMode, type Scope, type TransactionType } from '../../domain/types';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { notStartedText } from '../home/homeText';
import { ScreenBack } from '../tithes/ScreenBack';
import { TransactionList } from './TransactionList';

/**
 * רשימת ההכנסות או ההוצאות של החודש הנבחר, לעסק או למשק הבית.
 * נפתחת בלחיצה על משבצת הסכום במסך הבית, ובמעבר מתוצאת חיפוש.
 * במשק הבית, ההכנסה מהעסק (נטו) מוצגת בראש רשימת ההכנסות כשורה נגזרת.
 */
export function TransactionListScreen() {
  const params = useParams();
  const { profile } = useReadyAuth();
  const scope = params.scope as Scope;
  const type = params.type as TransactionType;
  if (
    (scope !== 'business' && scope !== 'household') ||
    (type !== 'income' && type !== 'expense') ||
    !scopesForMode(profile.accountMode).includes(scope)
  ) {
    return <Navigate to="/" replace />;
  }
  return <Content scope={scope} type={type} />;
}

function Content({ scope, type }: { scope: Scope; type: TransactionType }) {
  const navigate = useNavigate();
  const location = useLocation();
  const highlightId = (location.state as { highlightId?: string } | null)?.highlightId;
  const { user, profile } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();

  const hasBusiness = scopesForMode(profile.accountMode).includes('business');
  const needsBusinessNet = scope === 'household' && type === 'income' && hasBusiness;

  const main = useMonthTransactions(user.uid, scope, month.selected, true);
  const business = useMonthTransactions(user.uid, 'business', month.selected, needsBusinessNet);

  const items = useMemo(() => main.items.filter((t) => t.type === type), [main.items, type]);
  const ownTotal = useMemo(() => totalsOf(items), [items]);
  const fromBusiness = useMemo(
    () =>
      needsBusinessNet
        ? businessTransferToHousehold(businessNet(totalsOf(business.items)), settings.businessTransferMode)
        : 0,
    [needsBusinessNet, business.items, settings.businessTransferMode],
  );

  const isIncome = type === 'income';
  const total = (isIncome ? ownTotal.incomeAgorot : ownTotal.expenseAgorot) + fromBusiness;
  const loading = main.loading || (needsBusinessNet && business.loading);
  const scopeName = scope === 'business' ? profile.businessName : 'משק הבית';

  return (
    <div className={`app-shell scope-${scope}`}>
      <AppHeader />
      <main className="content" aria-busy={loading}>
        <ScreenBack to={`/${scope}`} label="חזרה" />
        <h1 className="scope-title">
          <Icon name={isIncome ? 'income' : 'expense'} /> {isIncome ? 'הכנסות' : 'הוצאות'} · {scopeName}
        </h1>

        {main.error ? (
          <div className="card error-card" role="alert">
            <p>לא הצלחנו לטעון את הנתונים.</p>
            <button type="button" className="btn btn-secondary" onClick={main.retry}>
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
          <>
            <section className="card">
              <div className="row-between">
                <span>סך הכול</span>
                <Amount agorot={total} className={isIncome ? 'tone-income' : 'tone-expense'} />
              </div>
            </section>

            <button
              type="button"
              className={`btn btn-add ${isIncome ? 'btn-income' : 'btn-expense'}`}
              onClick={() => navigate(`/${scope}/add/${type}`)}
            >
              <Icon name="plus" /> {isIncome ? 'הוספת הכנסה' : 'הוספת הוצאה'}
            </button>

            {needsBusinessNet && fromBusiness !== 0 && (
              <section className="card business-income-card">
                <div className="row-between">
                  <span>
                    <Icon name="business" /> {fromBusiness < 0 ? 'הפסד מהעסק (נטו)' : 'הכנסה מהעסק (נטו)'}
                  </span>
                  <Amount agorot={Math.abs(fromBusiness)} className={fromBusiness < 0 ? 'tone-expense' : 'tone-income'} />
                </div>
                <p className="muted small">שורה נגזרת מנתוני העסק. אין לערוך אותה כאן.</p>
              </section>
            )}

            <TransactionList scope={scope} items={items} highlightId={highlightId} />
          </>
        )}
      </main>
    </div>
  );
}
