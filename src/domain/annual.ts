import { addMonths, formatMonthYear, parseYearMonth, toYearMonth, type YearMonth } from './dates';

/**
 * שיטת חישוב "שנה" בסיכום השנתי ובתקציב השנתי:
 * calendar = שנה קלנדרית (ינואר עד דצמבר).
 * from-start = תקופות של 12 חודשים שנספרות מהחודש הראשון שבו יש תיעוד.
 */
export type AnnualMode = 'calendar' | 'from-start';
export const DEFAULT_ANNUAL_MODE: AnnualMode = 'calendar';

export function isAnnualMode(value: unknown): value is AnnualMode {
  return value === 'calendar' || value === 'from-start';
}

export interface AnnualPeriod {
  /** מזהה התקופה לשמירת תקציב: 'YYYY' (קלנדרי) או 'YYYY-MMy' (12 חודשים שמתחילים בחודש הזה) */
  id: string;
  startYm: YearMonth;
  endYm: YearMonth;
  months: YearMonth[];
  label: string;
}

function monthIndex(ym: YearMonth): number {
  const { year, month } = parseYearMonth(ym);
  return year * 12 + (month - 1);
}

function build(startYm: YearMonth, mode: AnnualMode): AnnualPeriod {
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startYm, i));
  const endYm = months[11];
  if (mode === 'calendar') {
    const { year } = parseYearMonth(startYm);
    return { id: String(year), startYm, endYm, months, label: `שנת ${year}` };
  }
  return {
    id: `${startYm}y`,
    startYm,
    endYm,
    months,
    label: `${formatMonthYear(startYm)} עד ${formatMonthYear(endYm)}`,
  };
}

/**
 * התקופה השנתית שהחודש הנבחר שייך אליה.
 * firstYm = החודש הראשון עם תיעוד (נדרש רק ב-from-start; אם חסר, התקופה מתחילה בחודש הנבחר).
 */
export function annualPeriodOf(selected: YearMonth, mode: AnnualMode, firstYm?: YearMonth | null): AnnualPeriod {
  if (mode === 'calendar') return build(toYearMonth(parseYearMonth(selected).year, 1), 'calendar');
  const first = firstYm ?? selected;
  const k = Math.floor((monthIndex(selected) - monthIndex(first)) / 12);
  return build(addMonths(first, 12 * k), 'from-start');
}

/** התקופה השנתית שלפני זו. */
export function previousAnnualPeriod(period: AnnualPeriod, mode: AnnualMode): AnnualPeriod {
  return build(addMonths(period.startYm, -12), mode);
}
