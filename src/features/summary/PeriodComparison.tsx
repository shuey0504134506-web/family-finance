import { useMemo, useState } from 'react';
import { formatShekels } from '../../domain/money';
import type { Transaction } from '../../domain/types';

export interface ComparisonColumn {
  key: string;
  /** תווית מלאה (כותרת בטבלה) */
  label: string;
  /** תווית קצרה לציר הגרף */
  short: string;
  months: readonly string[];
}

type Tx = Pick<Transaction, 'type' | 'amountAgorot' | 'categoryId' | 'yearMonth'>;

const PALETTE = ['#0f2a47', '#2f7d6b', '#c9973b', '#b5472f', '#5b7fa6', '#8a6bb0', '#7aa35a', '#d27f5c', '#4c9aa6'];
const OTHER_COLOR = '#a9a79d';
const OTHER_ID = '__other__';
const MAX_SERIES = PALETTE.length;

const WIDTH = 360;
const HEIGHT = 210;
const PAD = { top: 10, bottom: 26, left: 6, right: 6 };

/**
 * השוואה בין תקופות (חודשים או שנים): גרף עמודות מוערם לפי קטגוריה, מקרא וטבלה
 * (שורה לכל קטגוריה, עמודה לכל תקופה). בחירה בין הוצאות להכנסות ובין מספר התקופות.
 * הטבלה היא הנתון המלא; בגרף הקטגוריות הקטנות מאוחדות ל"אחר" כדי שיישאר קריא.
 */
export function PeriodComparison({
  title,
  unitLabel,
  columns,
  items,
  nameOf,
  counts,
  count,
  onCount,
}: {
  title: string;
  /** "חודשים" או "שנים" */
  unitLabel: string;
  columns: readonly ComparisonColumn[];
  items: readonly Tx[];
  nameOf: (categoryId: string) => string;
  counts: readonly number[];
  count: number;
  onCount: (n: number) => void;
}) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [active, setActive] = useState<number | null>(null);

  const { rows, columnTotals } = useMemo(() => {
    const byCategory = new Map<string, number[]>();
    const totals = columns.map(() => 0);
    columns.forEach((col, ci) => {
      const months = new Set(col.months);
      for (const t of items) {
        if (t.type !== type || !months.has(t.yearMonth)) continue;
        const row = byCategory.get(t.categoryId) ?? columns.map(() => 0);
        row[ci] += t.amountAgorot;
        byCategory.set(t.categoryId, row);
        totals[ci] += t.amountAgorot;
      }
    });
    const list = [...byCategory.entries()]
      .map(([id, values]) => ({ id, values, total: values.reduce((a, b) => a + b, 0) }))
      .filter((r) => r.total !== 0)
      .sort((a, b) => b.total - a.total);
    return { rows: list, columnTotals: totals };
  }, [columns, items, type]);

  // סדרות הגרף: הגדולות בנפרד, והשאר מאוחדות ל"אחר".
  const series = useMemo(() => {
    const top = rows.slice(0, rows.length > MAX_SERIES ? MAX_SERIES - 1 : MAX_SERIES).map((r, i) => ({
      id: r.id,
      name: nameOf(r.id),
      color: PALETTE[i],
      values: r.values,
    }));
    const rest = rows.slice(top.length);
    if (rest.length > 0) {
      top.push({
        id: OTHER_ID,
        name: 'אחר',
        color: OTHER_COLOR,
        values: columns.map((_, ci) => rest.reduce((sum, r) => sum + r.values[ci], 0)),
      });
    }
    return top;
  }, [rows, columns, nameOf]);

  const max = Math.max(1, ...columnTotals);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = (WIDTH - PAD.left - PAD.right) / Math.max(1, columns.length);
  const barWidth = Math.min(38, slot - 8);
  const scale = (v: number) => (v <= 0 ? 0 : plotHeight * (v / max));
  const current = active === null ? null : columns[active];

  return (
    <section className="card cmp" aria-label={title}>
      <div className="cmp-head">
        <h2 className="card-title">{title}</h2>
        <select
          className="input cmp-select"
          aria-label={`מספר ${unitLabel} להשוואה`}
          value={count}
          onChange={(e) => onCount(Number(e.target.value))}
        >
          {counts.map((n) => (
            <option key={n} value={n}>
              {n} {unitLabel} אחרונים
            </option>
          ))}
        </select>
      </div>
      <div className="segmented" role="group" aria-label="סוג">
        {(
          [
            ['expense', 'הוצאות'],
            ['income', 'הכנסות'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" className={type === value ? 'is-active' : ''} aria-pressed={type === value} onClick={() => setType(value)}>
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="muted">אין {type === 'expense' ? 'הוצאות' : 'הכנסות'} בתקופה הזו.</p>
      ) : (
        <>
          <div className="chart-readout" role="status" aria-live="polite">
            {current ? (
              <>
                <strong>{current.label}</strong> · {formatShekels(columnTotals[active as number])}
              </>
            ) : (
              <span className="muted">לחיצה על עמודה מציגה את הסכום</span>
            )}
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" role="img" aria-label={title} style={{ direction: 'ltr' }}>
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + plotHeight * (1 - f)} y2={PAD.top + plotHeight * (1 - f)} className={f === 0 ? 'chart-axis' : 'cmp-grid'} />
            ))}
            {columns.map((col, ci) => {
              const cx = PAD.left + slot * ci + slot / 2;
              let y = PAD.top + plotHeight;
              return (
                <g key={col.key} onClick={() => setActive(ci === active ? null : ci)}>
                  <rect x={PAD.left + slot * ci} y={0} width={slot} height={HEIGHT} className="chart-hit" />
                  {series.map((s) => {
                    const h = scale(s.values[ci]);
                    if (h <= 0) return null;
                    y -= h;
                    return <rect key={s.id} x={cx - barWidth / 2} y={y} width={barWidth} height={h} fill={s.color} stroke="#fff" strokeWidth={0.6} opacity={active === null || active === ci ? 1 : 0.55} />;
                  })}
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="chart-tick">
                    {col.short}
                  </text>
                </g>
              );
            })}
          </svg>

          <ul className="cmp-legend" aria-label="מקרא">
            {series.map((s) => (
              <li key={s.id}>
                <i className="cmp-dot" style={{ background: s.color }} /> {s.name}
              </li>
            ))}
          </ul>

          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col">קטגוריה</th>
                  {[...columns].reverse().map((c) => (
                    <th scope="col" key={c.key}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{nameOf(r.id)}</th>
                    {[...r.values].reverse().map((v, i) => (
                      <td key={columns[columns.length - 1 - i].key} className={v === 0 ? 'is-zero' : ''}>
                        {formatShekels(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">סך הכול</th>
                  {[...columnTotals].reverse().map((v, i) => (
                    <td key={columns[columns.length - 1 - i].key}>{formatShekels(v)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
