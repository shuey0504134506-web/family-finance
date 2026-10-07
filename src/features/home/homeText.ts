import { hebrewMonthName, parseYearMonth, type MonthStatus, type YearMonth } from '../../domain/dates';

/**
 * ניסוח הטקסטים של מסך הבית. פונקציות טהורות כדי שאפשר יהיה לבדוק אותן.
 * הסכום עצמו מוצג בנפרד (ברכיב Amount) כדי שסימן המינוס והשקל יוצגו נכון ב-RTL.
 */

export type BalanceTone = 'plus' | 'minus' | 'zero';

export interface BalanceHeadline {
  /** הטקסט שלפני הסכום, למשל "החודש אנחנו בפלוס" */
  text: string;
  /** הסכום להצגה (ערך מוחלט), או null כשהיתרה אפס */
  amountAgorot: number | null;
  tone: BalanceTone;
}

/** שם החודש, עם שנה רק כשהיא שונה מהשנה הנוכחית. */
export function monthLabel(ym: YearMonth, currentYm: YearMonth): string {
  const { year } = parseYearMonth(ym);
  const currentYear = parseYearMonth(currentYm).year;
  return year === currentYear ? hebrewMonthName(ym) : `${hebrewMonthName(ym)} ${year}`;
}

export function balanceHeadline(args: {
  balanceAgorot: number;
  status: Exclude<MonthStatus, 'future'>;
  yearMonth: YearMonth;
  currentYearMonth: YearMonth;
}): BalanceHeadline {
  const { balanceAgorot, status, yearMonth, currentYearMonth } = args;
  const tone: BalanceTone = balanceAgorot > 0 ? 'plus' : balanceAgorot < 0 ? 'minus' : 'zero';
  const subject =
    status === 'current' ? 'החודש אנחנו' : `חודש ${monthLabel(yearMonth, currentYearMonth)} נגמר`;

  if (tone === 'zero') {
    return { text: `${subject} על אפס`, amountAgorot: null, tone };
  }
  const direction = tone === 'plus' ? 'בפלוס' : 'במינוס';
  return { text: `${subject} ${direction}`, amountAgorot: Math.abs(balanceAgorot), tone };
}

export function notStartedText(ym: YearMonth, currentYm: YearMonth): string {
  return `חודש ${monthLabel(ym, currentYm)} עדיין לא התחיל`;
}
