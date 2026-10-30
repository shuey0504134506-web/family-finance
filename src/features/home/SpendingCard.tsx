import { useMemo, useState } from 'react';
import { Amount } from '../../components/Amount';
import { formatShekels } from '../../domain/money';
import { hebrewMonthName, type YearMonth } from '../../domain/dates';
import { businessIdOf } from '../../domain/spaces';
import type { Scope, TransactionRecord } from '../../domain/types';
import { useAnnualPeriod } from '../../hooks/useAnnualPeriod';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useReadyAuth } from '../auth/AuthContext';
import { useSettings } from '../settings/SettingsContext';
import { spendingBreakdown, spendingChangePercent } from './spending';

type Tab = 'month' | 'prev' | 'year';

/** צבעי הפרוסות, בסדר הגודל. "אחר" תמיד אפור-חמים. */
const COLORS = ['#0f2a47', '#4f56b3', '#15803d', '#c9a24b'];
const OTHER_COLOR = '#b9b09a';

interface Props {
  scope: Scope;
  /** רק לעסק: מסנן את הפעולות של העסק שמוצג */
  businessId?: string;
  selected: YearMonth;
  /** הוצאות החודש שנבחר (אחרי המרה למטבע הראשי) */
  monthItems: readonly TransactionRecord[];
  /** הוצאות החודש הקודם במלואו */
  prevItems: readonly TransactionRecord[];
  /** הוצאות החודש הקודם עד אותו יום בחודש, להשוואה בחודש הנוכחי. חסר = להשוות לחודש הקודם במלואו */
  prevStageItems?: readonly TransactionRecord[];
  onOpenBreakdown: () => void;
}

/** "לאן הלך הכסף": עוגה של הקטגוריות הגדולות, עם מעבר בין החודש, החודש הקודם והשנה. */
export function SpendingCard({ scope, businessId, selected, monthItems, prevItems, prevStageItems, onOpenBreakdown }: Props) {
  const { user } = useReadyAuth();
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>('month');

  const { period: annual, ready } = useAnnualPeriod(user.uid, scope, selected, settings.annualMode);
  const year = useTransactionsUpTo(user.uid, scope, annual.endYm, tab === 'year' && ready);
  const yearItems = useMemo(() => {
    const own = year.items.filter((t) => scope === 'household' || businessIdOf(t) === businessId);
    return own.filter((t) => annual.months.includes(t.yearMonth));
  }, [year.items, annual.months, scope, businessId]);

  const items = tab === 'month' ? monthItems : tab === 'prev' ? prevItems : yearItems;
  const breakdown = useMemo(() => spendingBreakdown(items), [items]);
  const loadingYear = tab === 'year' && (!ready || year.loading);

  const change = useMemo(() => {
    if (tab !== 'month') return null;
    const previous = spendingBreakdown(prevStageItems ?? prevItems).totalAgorot;
    return spendingChangePercent(breakdown.totalAgorot, previous);
  }, [tab, breakdown.totalAgorot, prevStageItems, prevItems]);

  const tabs: Array<[Tab, string]> = [
    ['month', hebrewMonthName(selected)],
    ['prev', 'חודש קודם'],
    ['year', 'השנה'],
  ];
  const total = breakdown.totalAgorot;
  const colorOf = (id: string, index: number) => (id === 'other' ? OTHER_COLOR : COLORS[index % COLORS.length]);

  // עוגה: היקף העיגול ב-viewBox של 42 הוא כ-100, ולכן האורכים הם אחוזים ישירות.
  let offset = 0;
  const arcs = breakdown.slices.map((s, i) => {
    const share = total > 0 ? (s.agorot / total) * 100 : 0;
    const length = Math.max(share - 1.4, 0.4);
    const arc = { id: s.id, color: colorOf(s.id, i), length, offset };
    offset += share;
    return arc;
  });

  return (
    <section className="card spend-card" aria-labelledby="spend-title">
      <h2 id="spend-title" className="spend-title">
        {tab === 'month' ? 'לאן הלך הכסף החודש' : tab === 'prev' ? 'לאן הלך הכסף בחודש הקודם' : 'לאן הלך הכסף השנה'}
      </h2>
      <div className="spend-tabs" role="group" aria-label="תקופה">
        {tabs.map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? 'is-active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>

      {loadingYear ? (
        <p className="muted small" role="status">
          טוען נתונים…
        </p>
      ) : total === 0 ? (
        <p className="muted small">אין הוצאות בתקופה הזאת.</p>
      ) : (
        <>
          <div className="spend-body">
            <div className="spend-donut">
              <svg viewBox="0 0 42 42" aria-hidden="true" focusable="false">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#efe9da" strokeWidth="5.2" />
                {arcs.map((a) => (
                  <circle
                    key={a.id}
                    cx="21"
                    cy="21"
                    r="15.9"
                    fill="none"
                    stroke={a.color}
                    strokeWidth="5.2"
                    strokeDasharray={`${a.length.toFixed(3)} ${(100 - a.length).toFixed(3)}`}
                    strokeDashoffset={(-a.offset).toFixed(3)}
                    transform="rotate(-90 21 21)"
                  />
                ))}
              </svg>
              <div className="spend-center" style={{ ['--len' as string]: formatShekels(total).length }}>
                <span className="spend-center-label">סך הוצאות</span>
                <Amount agorot={total} className="spend-total" />
                {change !== null && change !== 0 && (
                  <span className={`spend-change ${change < 0 ? 'tone-income' : 'tone-expense'}`}>
                    {`${change < 0 ? '▼' : '▲'} ${Math.abs(change)}% מקודם`}
                  </span>
                )}
              </div>
            </div>
            <ul className="spend-legend">
              {breakdown.slices.map((s, i) => (
                <li key={s.id}>
                  <span className="spend-dot" style={{ background: colorOf(s.id, i) }} aria-hidden="true" />
                  <span className="spend-name">{s.name}</span>
                  <Amount agorot={s.agorot} />
                </li>
              ))}
            </ul>
          </div>
          <div className="spend-stack" aria-hidden="true">
            {breakdown.slices.map((s, i) => (
              <i key={s.id} style={{ width: `${(s.agorot / total) * 100}%`, background: colorOf(s.id, i) }} />
            ))}
          </div>
          <button type="button" className="link-btn spend-more" onClick={onOpenBreakdown}>
            הצגת ההוצאות לפי קטגוריה ›
          </button>
        </>
      )}
    </section>
  );
}
