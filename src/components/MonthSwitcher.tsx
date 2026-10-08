import { addMonths } from '../domain/dates';
import { useMonth } from '../features/month/MonthContext';
import { ChevronLeft, ChevronRight } from './icons';

/**
 * מעבר בין חודשים (או שנים) מתחת לכותרת מסך. הסדר הפיזי קבוע: קודם מימין, הבא משמאל.
 * stepMonths=12 מעביר שנה שלמה.
 */
export function MonthSwitcher({
  label,
  stepMonths = 1,
  unit = 'חודש',
}: {
  label: string;
  stepMonths?: number;
  unit?: 'חודש' | 'שנה';
}) {
  const month = useMonth();
  const next = unit === 'חודש' ? 'לחודש הבא' : 'לשנה הבאה';
  const previous = unit === 'חודש' ? 'לחודש הקודם' : 'לשנה הקודמת';
  return (
    <div className="period-nav">
      <div className="month-nav">
        <button type="button" className="icon-btn" aria-label={next} onClick={() => month.setMonth(addMonths(month.selected, stepMonths))}>
          <ChevronLeft />
        </button>
        <div className="month-label" aria-live="polite">
          {label}
        </div>
        <button type="button" className="icon-btn" aria-label={previous} onClick={() => month.setMonth(addMonths(month.selected, -stepMonths))}>
          <ChevronRight />
        </button>
      </div>
      {month.status !== 'current' && (
        <button type="button" className="chip-btn" onClick={month.backToCurrent}>
          חזרה לחודש הנוכחי
        </button>
      )}
    </div>
  );
}
