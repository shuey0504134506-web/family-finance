import { useState } from 'react';
import { formatShekels } from '../../domain/money';

export interface ChartMonth {
  label: string;
  incomeAgorot: number;
  expenseAgorot: number;
}

const WIDTH = 360;
const HEIGHT = 190;
const PAD = { top: 12, bottom: 26, left: 6, right: 6 };

/**
 * גרף עמודות: הכנסות (ירוק, בצד שמאל של כל זוג) והוצאות (אדום, מימין), לכל חודש.
 * הזהות אינה תלויה בצבע בלבד: יש מקרא, מיקום קבוע בזוג, ותצוגת טבלה מתחת.
 * לחיצה או מעבר עם העכבר על חודש מציג את הערכים המדויקים.
 */
export function IncomeExpenseChart({ months, title }: { months: readonly ChartMonth[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...months.flatMap((m) => [m.incomeAgorot, m.expenseAgorot]));
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = (WIDTH - PAD.left - PAD.right) / months.length;
  const barWidth = Math.min(11, slot / 2 - 1.5);
  const barHeight = (value: number) => (value <= 0 ? 0 : Math.max(2, plotHeight * (value / max)));

  const current = active === null ? null : months[active];

  return (
    <figure className="chart" aria-label={title}>
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="swatch swatch-income" /> הכנסות
        </span>
        <span>
          <i className="swatch swatch-expense" /> הוצאות
        </span>
      </div>

      <div className="chart-readout" role="status" aria-live="polite">
        {current ? (
          <>
            <strong>{current.label}</strong> · הכנסות {formatShekels(current.incomeAgorot)} · הוצאות{' '}
            {formatShekels(current.expenseAgorot)}
          </>
        ) : (
          <span className="muted">לחיצה על חודש מציגה את הסכומים</span>
        )}
      </div>

      {/* הגרף מצויר משמאל לימין (ינואר משמאל), כמו ציר זמן. הטקסט שבתוכו נשאר קריא. */}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" role="img" aria-label={title} style={{ direction: 'ltr' }}>
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotHeight}
          y2={PAD.top + plotHeight}
          className="chart-axis"
        />
        {months.map((m, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          return (
            <g key={m.label} onClick={() => setActive(i === active ? null : i)} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
              <rect x={PAD.left + slot * i} y={0} width={slot} height={HEIGHT} className="chart-hit" />
              {active === i && (
                <rect x={PAD.left + slot * i} y={PAD.top - 4} width={slot} height={plotHeight + 4} className="chart-focus" />
              )}
              <rect
                x={cx - barWidth - 1}
                y={PAD.top + plotHeight - barHeight(m.incomeAgorot)}
                width={barWidth}
                height={barHeight(m.incomeAgorot)}
                rx={3}
                className="bar-income"
              />
              <rect
                x={cx + 1}
                y={PAD.top + plotHeight - barHeight(m.expenseAgorot)}
                width={barWidth}
                height={barHeight(m.expenseAgorot)}
                rx={3}
                className="bar-expense"
              />
              <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="chart-tick">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>

      <details className="chart-table">
        <summary>תצוגת טבלה</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">חודש</th>
              <th scope="col">הכנסות</th>
              <th scope="col">הוצאות</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.label}>
                <th scope="row">{m.label}</th>
                <td>{formatShekels(m.incomeAgorot)}</td>
                <td>{formatShekels(m.expenseAgorot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
