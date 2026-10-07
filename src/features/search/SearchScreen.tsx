import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { ScreenHeader } from '../../components/ScreenHeader';
import { formatMonthYear } from '../../domain/dates';
import { searchTransactions } from '../../domain/search';
import { scopesForMode, type Scope, type TransactionRecord } from '../../domain/types';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { Icon } from '../../components/Icon';

const MAX_RESULTS = 200;
// החיפוש טוען את כל ההיסטוריה (עד חודש רחוק בעתיד).
const FAR_FUTURE = '9999-12';

type ScopedTx = TransactionRecord & { scope: Scope };

/**
 * חיפוש בכל הפעולות, בעסק ובמשק הבית. לחיצה על תוצאה מעבירה לחודש שבו הפעולה נמצאת.
 * Firestore אינו תומך בחיפוש טקסט חופשי, ולכן הפעולות נטענות למכשיר והחיפוש מתבצע שם.
 */
export function SearchScreen() {
  const navigate = useNavigate();
  const month = useMonth();
  const { user, profile } = useReadyAuth();
  const scopes = scopesForMode(profile.accountMode);

  const business = useTransactionsUpTo(user.uid, 'business', FAR_FUTURE, scopes.includes('business'));
  const household = useTransactionsUpTo(user.uid, 'household', FAR_FUTURE, scopes.includes('household'));

  const [text, setText] = useState('');
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | Scope>('all');
  const deferred = useDeferredValue(text);

  const all = useMemo<ScopedTx[]>(
    () => [
      ...business.items.map((t) => ({ ...t, scope: 'business' as const })),
      ...household.items.map((t) => ({ ...t, scope: 'household' as const })),
    ],
    [business.items, household.items],
  );

  const results = useMemo(
    () =>
      searchTransactions(
        all.filter((t) => scopeFilter === 'all' || t.scope === scopeFilter),
        { text: deferred, type },
      ),
    [all, deferred, type, scopeFilter],
  );

  const loading = business.loading || household.loading;
  const error = business.error ?? household.error;
  const shown = results.slice(0, MAX_RESULTS);

  const open = (item: ScopedTx) => {
    // עוברים לרשימה של אותו חודש וסוג, והפעולה מוגללת ומודגשת לכמה רגעים.
    month.setMonth(item.yearMonth);
    navigate(`/${item.scope}/list/${item.type}`, { state: { highlightId: item.id } });
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="חיפוש" />
      <main className="content" aria-busy={loading}>
        <div className="field">
          <label htmlFor="search-text">חיפוש לפי שם, קטגוריה, הערה, סכום או תאריך</label>
          <input
            id="search-text"
            type="search"
            className="input"
            autoFocus
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="segmented" role="group" aria-label="סוג פעולה">
          {(
            [
              ['all', 'הכול'],
              ['expense', 'הוצאות'],
              ['income', 'הכנסות'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={type === value ? 'is-active' : ''}
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {scopes.length > 1 && (
          <div className="segmented" role="group" aria-label="תחום">
            {(
              [
                ['all', 'עסק ומשק בית'],
                ['business', 'עסק'],
                ['household', 'משק בית'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={scopeFilter === value ? 'is-active' : ''}
                aria-pressed={scopeFilter === value}
                onClick={() => setScopeFilter(value)}
              >
                {value !== 'all' && (
                  <>
                    <Icon name={value} />{' '}
                  </>
                )}
                {label}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <div className="card error-card" role="alert">
            לא הצלחנו לטעון את הנתונים. יש לבדוק את החיבור ולנסות שוב.
          </div>
        ) : loading ? (
          <div className="card notice-card" role="status">
            טוען נתונים…
          </div>
        ) : results.length === 0 ? (
          <div className="card notice-card" role="status">
            לא נמצאו פעולות.
          </div>
        ) : (
          <>
            <p className="muted small" role="status">
              נמצאו {results.length} פעולות
              {results.length > MAX_RESULTS ? ` (מוצגות ${MAX_RESULTS} הראשונות, יש לדייק את החיפוש)` : ''}.
            </p>
            <ul className="tx-list" aria-label="תוצאות חיפוש">
              {shown.map((item) => {
                const isIncome = item.type === 'income';
                return (
                  <li key={`${item.scope}-${item.id}`}>
                    <button
                      type="button"
                      className="tx-row"
                      onClick={() => open(item)}
                      aria-label={`הצגה ב${formatMonthYear(item.yearMonth)}`}
                    >
                      <span className="tx-date">
                        {item.date.slice(8, 10)}/{item.date.slice(5, 7)}
                        <br />
                        <span className="small">{item.date.slice(0, 4)}</span>
                      </span>
                      <span className="tx-main">
                        <span className="tx-title">{item.counterparty || item.categoryName}</span>
                        <span className="tx-sub">
                          {scopes.length > 1 && (<><Icon name={item.scope} />{' '}</>)}
                          {item.categoryName}
                          {item.note ? ` · ${item.note}` : ''}
                        </span>
                      </span>
                      <Amount agorot={item.amountAgorot} className={isIncome ? 'tone-income' : 'tone-expense'} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
