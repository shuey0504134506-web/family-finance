import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { ScreenHeader } from '../../components/ScreenHeader';
import { formatMonthYear } from '../../domain/dates';
import { searchTransactions } from '../../domain/search';
import { HOUSEHOLD_SPACE, businessSpace } from '../../domain/spaces';
import type { Scope, TransactionRecord } from '../../domain/types';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSpaces } from '../spaces/SpacesContext';
import { Icon } from '../../components/Icon';

const MAX_RESULTS = 200;
// החיפוש טוען את כל ההיסטוריה (עד חודש רחוק בעתיד).
const FAR_FUTURE = '9999-12';

type ScopedTx = TransactionRecord & { scope: Scope; spaceKey: string };

/**
 * חיפוש בכל הפעולות, בעסק ובמשק הבית. לחיצה על תוצאה מעבירה לחודש שבו הפעולה נמצאת.
 * Firestore אינו תומך בחיפוש טקסט חופשי, ולכן הפעולות נטענות למכשיר והחיפוש מתבצע שם.
 */
export function SearchScreen() {
  const navigate = useNavigate();
  const month = useMonth();
  const { user } = useReadyAuth();
  const { spaces, nameOf } = useSpaces();

  const business = useTransactionsUpTo(user.uid, 'business', FAR_FUTURE, spaces.some((s) => s.scope === 'business'));
  const household = useTransactionsUpTo(user.uid, 'household', FAR_FUTURE, spaces.some((s) => s.scope === 'household'));

  const [text, setText] = useState('');
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const deferred = useDeferredValue(text);

  // רק פעולות של מרחבים שמוצגים במכשיר הזה.
  const all = useMemo<ScopedTx[]>(() => {
    const visible = new Set(spaces.map((s) => s.key));
    return [
      ...business.items.map((t) => ({
        ...t,
        scope: 'business' as const,
        spaceKey: businessSpace(t.businessId ?? '').key,
      })),
      ...household.items.map((t) => ({ ...t, scope: 'household' as const, spaceKey: HOUSEHOLD_SPACE.key })),
    ].filter((t) => visible.has(t.spaceKey));
  }, [business.items, household.items, spaces]);

  const results = useMemo(
    () =>
      searchTransactions(
        all.filter((t) => scopeFilter === 'all' || t.spaceKey === scopeFilter),
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
    navigate(`/${item.spaceKey}/list/${item.type}`, { state: { highlightId: item.id } });
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

        {spaces.length > 1 && (
          <div className="segmented segmented-spaces" role="group" aria-label="מרחב">
            {[{ key: 'all', label: 'הכול', icon: null as Scope | null }, ...spaces.map((sp) => ({ key: sp.key, label: nameOf(sp), icon: sp.scope as Scope | null }))].map(
              ({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  className={scopeFilter === key ? 'is-active' : ''}
                  aria-pressed={scopeFilter === key}
                  onClick={() => setScopeFilter(key)}
                >
                  {icon && (
                    <>
                      <Icon name={icon} />{' '}
                    </>
                  )}
                  <span className="seg-label">{label}</span>
                </button>
              ),
            )}
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
                  <li key={`${item.spaceKey}-${item.id}`}>
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
                          {spaces.length > 1 && (<><Icon name={item.scope} />{' '}</>)}
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
