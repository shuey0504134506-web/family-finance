import { useMemo, useState } from 'react';
import { Amount } from '../../components/Amount';
import { useLocation } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { MonthSwitcher } from '../../components/MonthSwitcher';
import { previousAnnualPeriod, type AnnualPeriod } from '../../domain/annual';
import { addMonths, formatMonthYear } from '../../domain/dates';
import { formatPercentChange, percentChange } from '../../domain/compare';
import { categoryBreakdown, periodTotals, type PeriodTotals } from '../../domain/periods';
import { businessIdOf } from '../../domain/spaces';
import { useAnnualPeriod } from '../../hooks/useAnnualPeriod';
import { useCategories } from '../../hooks/useCategories';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useSpaces } from '../spaces/SpacesContext';
import { PeriodComparison, type ComparisonColumn } from './PeriodComparison';
import { Icon } from '../../components/Icon';
import { SpaceLabel } from '../../components/SpaceLabel';

type Period = 'month' | 'year';

/**
 * סיכום חודשי או שנתי, לעסק או למשק הבית: סכומים, גרף עמודות, פירוט לפי קטגוריות
 * והשוואה לתקופה הקודמת (חודש קודם, או שנה קודמת).
 * כל החישובים נעשים ב-src/domain/periods.ts ונבדקים שם.
 */
export function SummaryScreen() {
  const { user } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();
  const { spaces, countedIds, nameOf: spaceLabel } = useSpaces();
  const fromState = (useLocation().state as { spaceKey?: string } | null)?.spaceKey;
  const [chosenKey, setChosenKey] = useState<string | null>(
    fromState && spaces.some((s) => s.key === fromState) ? fromState : null,
  );
  const space = spaces.find((s) => s.key === chosenKey) ?? spaces[0];
  const scope = space.scope;
  const [period, setPeriod] = useState<Period>('month');
  const { categories } = useCategories(user.uid);

  const { period: annual, ready: annualReady } = useAnnualPeriod(user.uid, scope, month.selected, settings.annualMode);
  const previousAnnual = useMemo(() => previousAnnualPeriod(annual, settings.annualMode), [annual, settings.annualMode]);
  // נטענת ההיסטוריה עד סוף התקופה השנתית הנבחרת: מספיקה לחודש, לחודש הקודם, לשנה ולשנה הקודמת.
  const upTo = annual.endYm;
  const hasBusinessSpace = spaces.some((s) => s.scope === 'business');
  const business = useTransactionsUpTo(user.uid, 'business', upTo, annualReady && (hasBusinessSpace || countedIds.length > 0));
  const household = useTransactionsUpTo(user.uid, 'household', upTo, annualReady && spaces.some((s) => s.scope === 'household'));
  const loading = business.loading || household.loading || !annualReady;
  const error = business.error ?? household.error;

  const mode = settings.businessTransferMode;
  const currentMonths = useMemo(
    () => (period === 'month' ? [month.selected] : annual.months),
    [period, month.selected, annual],
  );
  const previousMonths = useMemo(
    () => (period === 'month' ? [addMonths(month.selected, -1)] : previousAnnual.months),
    [period, month.selected, previousAnnual],
  );

  // בעסק: רק הפעולות של העסק הנבחר. בבית: רק העסקים שנספרים במכשיר הזה.
  const businessForCalc = useMemo(() => {
    if (scope === 'business') return business.items.filter((t) => businessIdOf(t) === space.businessId);
    const counted = new Set(countedIds);
    return business.items.filter((t) => counted.has(businessIdOf(t)));
  }, [scope, space.businessId, business.items, countedIds]);

  const totals = useMemo(
    () => periodTotals(scope, household.items, businessForCalc, currentMonths, mode),
    [scope, household.items, businessForCalc, currentMonths, mode],
  );
  const previous = useMemo(
    () => periodTotals(scope, household.items, businessForCalc, previousMonths, mode),
    [scope, household.items, businessForCalc, previousMonths, mode],
  );

  const scopeItems = scope === 'business' ? businessForCalc : household.items;
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryName = (id: string) => names.get(id) ?? scopeItems.find((t) => t.categoryId === id)?.categoryName ?? 'אחר';
  const expenseShares = useMemo(
    () => categoryBreakdown(scopeItems, currentMonths, 'expense'),
    [scopeItems, currentMonths],
  );
  const incomeShares = useMemo(
    () => categoryBreakdown(scopeItems, currentMonths, 'income'),
    [scopeItems, currentMonths],
  );

  const [monthCount, setMonthCount] = useState(6);
  const [yearCount, setYearCount] = useState(3);
  const columns = useMemo<ComparisonColumn[]>(() => {
    if (period === 'month') {
      return Array.from({ length: monthCount }, (_, i) => addMonths(month.selected, i - (monthCount - 1))).map((ym) => ({
        key: ym,
        label: formatMonthYear(ym),
        short: `${Number(ym.slice(5))}/${ym.slice(2, 4)}`,
        months: [ym],
      }));
    }
    const periods: AnnualPeriod[] = [annual];
    while (periods.length < yearCount) periods.unshift(previousAnnualPeriod(periods[0], settings.annualMode));
    return periods.map((p) => ({
      key: p.id,
      label: p.label,
      short: settings.annualMode === 'calendar' ? p.id : `${Number(p.startYm.slice(5))}/${p.startYm.slice(2, 4)}`,
      months: p.months,
    }));
  }, [period, monthCount, yearCount, month.selected, annual, settings.annualMode]);

  const periodLabel = period === 'month' ? formatMonthYear(month.selected) : annual.label;
  const previousLabel = period === 'month' ? formatMonthYear(previousMonths[0]) : previousAnnual.label;

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title="סיכומים" />
      <main className="content" aria-busy={loading}>
        <MonthSwitcher label={periodLabel} stepMonths={period === 'month' ? 1 : 12} unit={period === 'month' ? 'חודש' : 'שנה'} />

        {spaces.length > 1 && (
          <div className="segmented segmented-spaces" role="group" aria-label="מרחב">
            {spaces.map((s) => (
              <button key={s.key} type="button" className={s.key === space.key ? 'is-active' : ''} aria-pressed={s.key === space.key} onClick={() => setChosenKey(s.key)}>
                <Icon name={s.scope} /> <SpaceLabel name={spaceLabel(s)} />
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
                {scope === 'household' && countedIds.length > 0 && totals.fromBusinessAgorot !== 0 && (
                  <div>
                    <dt className="small">מתוכן: {totals.fromBusinessAgorot < 0 ? 'הפסד' : 'נטו'} {countedIds.length > 1 ? 'מהעסקים' : 'מהעסק'}</dt>
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

            <Breakdown title="הוצאות לפי קטגוריה" shares={expenseShares} nameOf={categoryName} tone="expense" />
            <Breakdown title="הכנסות לפי קטגוריה" shares={incomeShares} nameOf={categoryName} tone="income" />

            <Comparison current={totals} previous={previous} previousLabel={previousLabel} />

            <PeriodComparison
              title={period === 'month' ? 'השוואה בין חודשים' : 'השוואה בין שנים'}
              unitLabel={period === 'month' ? 'חודשים' : 'שנים'}
              columns={columns}
              items={scopeItems}
              nameOf={categoryName}
              counts={period === 'month' ? [3, 6, 12] : [2, 3, 5]}
              count={period === 'month' ? monthCount : yearCount}
              onCount={period === 'month' ? setMonthCount : setYearCount}
            />
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
