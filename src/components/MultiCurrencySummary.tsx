import { useMemo, useState } from 'react';
import {
  CURRENCY_CODES,
  CURRENCY_NAMES,
  CURRENCY_SYMBOLS,
  convertAgorot,
  foreignTotals,
  getCurrency,
  type CurrencyCode,
  type Rates,
} from '../domain/currency';
import { loadRates, type RatesSnapshot } from '../services/exchangeRates';
import { Amount } from './Amount';

type Item = { currency?: CurrencyCode; type: 'income' | 'expense'; amountAgorot: number };

/**
 * סיכום לפי מטבע: מוצג רק כשיש בתקופה פעולות במטבע שאינו הראשי.
 * כפתור "המרה" מביא שער עדכני וממיר את כל הסיכום למטבע אחד, לתצוגה בלבד (שום דבר לא נשמר).
 */
export function MultiCurrencySummary({
  items,
  primaryIncomeAgorot,
  primaryExpenseAgorot,
}: {
  /** כל הפעולות של התקופה והמרחב, בכל מטבע. */
  items: readonly Item[];
  primaryIncomeAgorot: number;
  primaryExpenseAgorot: number;
}) {
  const primary = getCurrency();
  const foreign = useMemo(() => foreignTotals(items), [items]);
  const [target, setTarget] = useState<CurrencyCode>(primary);
  const [snapshot, setSnapshot] = useState<RatesSnapshot | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  if (foreign.length === 0) return null;

  const rows = [
    { currency: primary, incomeAgorot: primaryIncomeAgorot, expenseAgorot: primaryExpenseAgorot },
    ...foreign,
  ];

  const convert = async (to: CurrencyCode) => {
    setTarget(to);
    setState('loading');
    const result = await loadRates();
    setSnapshot(result);
    setState(result ? 'done' : 'error');
  };

  const sum = (pick: 'incomeAgorot' | 'expenseAgorot', rates: Rates) =>
    rows.reduce((total, r) => total + convertAgorot(r[pick], r.currency, target, rates), 0);

  return (
    <section className="card multi-currency" aria-label="סיכום לפי מטבע">
      <h2 className="card-title">סיכום לפי מטבע</h2>
      <ul className="mc-list">
        {rows.map((r) => (
          <li key={r.currency}>
            <span className="mc-name">
              {CURRENCY_SYMBOLS[r.currency]} {CURRENCY_NAMES[r.currency]}
            </span>
            <span className="mc-values">
              <Amount agorot={r.incomeAgorot} currency={r.currency} className="tone-income" />
              <Amount agorot={r.expenseAgorot} currency={r.currency} className="tone-expense" />
              <Amount agorot={r.incomeAgorot - r.expenseAgorot} currency={r.currency} />
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small mc-legend">לכל שורה: הכנסות, הוצאות, יתרה.</p>

      <div className="mc-convert">
        <span className="field-label" id="mc-target-label">
          המרת הכול למטבע אחד
        </span>
        <div className="chip-group" role="radiogroup" aria-labelledby="mc-target-label">
          {CURRENCY_CODES.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={state === 'done' && target === code}
              className={`chip-option${state === 'done' && target === code ? ' is-active' : ''}`}
              disabled={state === 'loading'}
              onClick={() => void convert(code)}
            >
              {CURRENCY_SYMBOLS[code]} {code}
            </button>
          ))}
        </div>
      </div>

      {state === 'loading' && (
        <p className="muted small" role="status">
          מביא שער עדכני…
        </p>
      )}
      {state === 'error' && (
        <p className="form-error" role="alert">
          לא הצלחנו להביא שער המרה. יש לבדוק חיבור לאינטרנט ולנסות שוב.
        </p>
      )}
      {state === 'done' && snapshot && (
        <div className="mc-result" role="status">
          <h3 className="subhead">
            בהמרה ל{CURRENCY_NAMES[target]}
          </h3>
          <dl className="detail-list">
            <div>
              <dt>הכנסות</dt>
              <dd>
                <Amount agorot={sum('incomeAgorot', snapshot.rates)} currency={target} className="tone-income" />
              </dd>
            </div>
            <div>
              <dt>הוצאות</dt>
              <dd>
                <Amount agorot={sum('expenseAgorot', snapshot.rates)} currency={target} className="tone-expense" />
              </dd>
            </div>
            <div>
              <dt>יתרה</dt>
              <dd>
                <Amount
                  agorot={sum('incomeAgorot', snapshot.rates) - sum('expenseAgorot', snapshot.rates)}
                  currency={target}
                />
              </dd>
            </div>
          </dl>
          <p className="muted small">
            לפי שער רשמי מתאריך {snapshot.date}
            {snapshot.stale ? ' (השער האחרון ששמרנו, כי אין חיבור כרגע)' : ''}. ההמרה לתצוגה בלבד, ולא משנה את הנתונים השמורים.
          </p>
        </div>
      )}
    </section>
  );
}
