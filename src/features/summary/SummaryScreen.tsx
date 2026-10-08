import { useMemo, useState } from 'react';
import { Amount } from '../../components/Amount';
import { useLocation } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { MonthSwitcher } from '../../components/MonthSwitcher';
import { addMonths, formatMonthYear, parseYearMonth } from '../../domain/dates';
import { formatPercentChange, percentChange } from '../../domain/compare';
import { categoryBreakdown, monthsOfYear, periodTotals, type PeriodTotals } from '../../domain/periods';
import { scopesForMode, type Scope } from '../../domain/types';
import { useCategories } from '../../hooks/useCategories';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { IncomeExpenseChart } from './IncomeExpenseChart';
import { Icon } from '../../components/Icon';

type Period = 'month' | 'year';

/**
 * סיכום חודשי או שנתי, לעסק או למשק הבית: סכומים, גרף עמודות, פירוט לפי קטגוריות
 * והשוואה לתקופה הקודמת (חודש קודם, או שנה קודמת).
 * כל החישובים נעשים ב-src/domain/periods.ts ונבדקים שם.
 */
export function SummaryScreen() {
  const { user, profile } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();
  const scopes = scopesForMode(profile.accountMode);
  const fromState = (useLocation().state as { scope?: Scope } | null)?.scope;
  const [scope, setScope] = useState<Scope>(fromState && scopes.includes(fromState) ? fromState : scopes[0]);
  const [period, setPeriod] = useState<Period>('month');
  const { categories } = useCategories(user.uid);

  const { year } = parseYearMonth(month.selected);
  // נטענת ההיסטוריה עד סוף השנה הנבחרת: מספיקה לחודש, לחודש הקודם, לשנה ולשנה הקודמת.
  const upTo = `${year}-12`;
  const business = useTransactionsUpTo(user.uid, 'business', upTo, scopes.includes('business'));
  const household = useTransactionsUpTo(user.uid, 'household', upTo, scopes.includes('household'));
  const loading = business.loading || household.loading;
  const error = business.error ?? household.error;

  const mode = settings.businessTransferMode;
  const currentMonths = useMemo(
    () => (period === 'month' ? [month.selected] : monthsOfYear(year)),
    [period, month.selected, year],
  );
  const previousMonths = useMemo(
    () => (period === 'month' ? [addMonths(month.selected, -1)] : monthsOfYear(year - 1)),
    [period, month.selected, year],
  );

  const totals = useMemo(
    () => periodTotals(scope, household.items, business.items, currentMonths, mode),
    [scope, household.items, business.items, currentMonths, mode],
  );
  const previous = useMemo(
    () => periodTotals(scope, household.items, business.items, previousMonths, mode),
    [scope, household.items, business.items, previousMonths, mode],
  );

  const chartMonths = useMemo(
    () =>
      monthsOfYear(year).map((ym) => {
        const t = periodTotals(scope, household.items, business.items, [ym], mode);
        return { label: String(Number(ym.slice(5))), incomeAgorot: t.incomeAgorot, expenseAgorot: t.expenseAgorot };
      }),
    [scope, household.items, business.items, mode, year],
  );

  const scopeItems = scope === 'business' ? business.items : household.items;
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const nameOf = (id: string) => names.get(id) ?? scopeItems.find((t) => t.categoryId === id)?.categoryName ?? 'אחר';
  const expenseShares = useMemo(
    () => categoryBreakdown(scopeItems, currentMonths, 'expense'),
    [scopeItems, currentMonths],
  );
  const incomeShares = useMemo(
    () => categoryBreakdown(scopeItems, currentMonths, 'income'),
    [scopeItems, currentMonths],
  );

  const periodLabel = period === 'month' ? formatMonthYear(month.selected) : `שנת ${year}`;
  const previousLabel = period === 'month' ? formatMonthYear(previousMonths[0]) : `שנת ${year - 1}`;

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title="סיכומים" />
      <main className="content" aria-busy={loading}>
        <MonthSwitcher label={periodLabel} stepMonths={period === 'month' ? 1 : 12} unit={period === 'month' ? 'חודש' : 'שנה'} />

        {scopes.length > 1 && (
          <div className="segmented" role="group" aria-label="תחום">
            {scopes.map((s) => (
              <button key={s} type="button" className={s === scope ? 'is-active' : ''} aria-pressed={s === scope} onClick={() => setScope(s)}>
                <Icon name={s} /> {s === 'business' ? 'עסק' : 'משק בית'}
              </button>
            ))}
          </div>
        )}
        <div className="segmented" role="group" aria-label="תקופה">
          {(
            [
              ['month', 'חודשי'],
              ['year', 'שנתי'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" className={period === value ? 'is-active' : ''} aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="card error-card" role="alert">
            לא הצלחנו לטעון את הנתונים. יש לבדוק את החיבור ולנסות שוב.
          </div>
        ) : loading ? (
          <div className="card notice-card" role="status">
            טוען נתונים…
          </div>
        ) : (
          <>
            <section className="card" aria-label={`סיכום ${periodLabel}`}>
              <h2 className="card-title">{periodLabel}</h2>
              <dl className="detail-list">
                <div>
                  <dt>הכנסות</dt>
                  <dd>
                    <Amount agorot={totals.incomeAgorot} className="tone-income" />
                  </dd>
                </div>
                {scope === 'household' && scopes.includes('business') && totals.fromBusinessAgorot !== 0 && (
                  <div>
                    <dt className="small">מתוכן: {totals.fromBusinessAgorot < 0 ? 'הפסד' : 'נטו'} מהעסק</dt>
                    <dd className="small">
                      <Amount agorot={totals.fromBusinessAgorot} className={totals.fromBusinessAgorot < 0 ? 'tone-expense' : undefined} />
                    </dd>
                  </div>
                )}
                <div>
                  <dt>הוצאות</dt>
                  <dd>
                    <Amount agorot={totals.expenseAgorot} className="tone-expense" />
                  </dd>
                </div>
                <div>
                  <dt>{totals.balanceAgorot < 0 ? 'מינוס' : 'פלוס'}</dt>
                  <dd>
                    <Amount agorot={Math.abs(totals.balanceAgorot)} className={totals.balanceAgorot < 0 ? 'tone-expense' : 'tone-income'} />
                  </dd>
                </div>
              </dl>
            </section>

            <Comparison current={totals} previous={previous} previousLabel={previousLabel} />

            <section className="card">
              <h2 className="card-title">הכנסות והוצאות לפי חודש, {year}</h2>
              <IncomeExpenseChart months={chartMonths} title={`הכנסות והוצאות לפי חודש בשנת ${year}`} />
            </section>

            <Breakdown title="הוצאות לפי קטגוריה" shares={expenseShares} nameOf={nameOf} tone="expense" />
            <Breakdown title="הכנסות לפי קטגוריה" shares={incomeShares} nameOf={nameOf} tone="income" />
          </>
        )}
      </main>
    </div>
  );
}

function Comparison({ current, previous, previousLabel }: { current: PeriodTotals; previous: PeriodTotals; previousLabel: string }) {
  const rows = [
    { label: 'הכנסות', now: current.incomeAgorot, before: previous.incomeAgorot, goodWhenUp: true },
    { label: 'הוצאות', now: current.expenseAgorot, before: previous.expenseAgorot, goodWhenUp: false },
    { label: 'יתרה', now: current.balanceAgorot, before: previous.balanceAgorot, goodWhenUp: true },
  ];
  return (
    <section className="card">
      <h2 className="card-title">השוואה ל{previousLabel}</h2>
      <ul className="compare-list">
        {rows.map((row) => {
          const change = percentChange(row.before, row.now);
          const improved = change === null || change === 0 ? null : change > 0 === row.goodWhenUp;
          return (
            <li key={row.label}>
              <span>{row.label}</span>
              <span className="compare-values">
                <Amount agorot={row.before} /> ← <Amount agorot={row.now} />
              </span>
              <span className={`compare-change${improved === null ? '' : improved ? ' tone-income' : ' tone-expense'}`}>
                {formatPercentChange(change)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">"—" מוצג כשבתקופה הקודמת הסכום היה אפס, ולכן אי אפשר לחשב אחוז.</p>
    </section>
  );
}

function Breakdown({
  title,
  shares,
  nameOf,
  tone,
}: {
  title: string;
  shares: ReturnType<typeof categoryBreakdown>;
  nameOf: (id: string) => string;
  tone: 'income' | 'expense';
}) {
  if (shares.length === 0) return null;
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <ul className="share-list">
        {shares.map((s) => (
          <li key={s.categoryId}>
            <div className="row-between">
              <span>{nameOf(s.categoryId)}</span>
              <span>
                <Amount agorot={s.amountAgorot} /> · {s.percent}%
              </span>
            </div>
            <div className={`share-bar share-${tone}`} aria-hidden="true">
              <div style={{ width: `${Math.max(2, s.percent)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
