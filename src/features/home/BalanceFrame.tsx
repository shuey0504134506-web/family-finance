import type { ReactNode } from 'react';
import { Amount } from '../../components/Amount';
import type { MonthStatus, YearMonth } from '../../domain/dates';
import { balanceHeadline } from './homeText';

interface Props {
  incomeAgorot: number;
  expenseAgorot: number;
  balanceAgorot: number;
  /** רק במשק הבית: כמה מההכנסה הגיע מהעסק (נטו) */
  fromBusinessAgorot?: number;
  status: Exclude<MonthStatus, 'future'>;
  yearMonth: YearMonth;
  currentYearMonth: YearMonth;
  /** שורת ההתקדמות ליעד החיסכון, מתחת ליתרה */
  savings?: ReactNode;
}

/**
 * מסגרת הפלוס/מינוס החודשי, ומתחתיה (אם הוגדר) שורת ההתקדמות ליעד החיסכון.
 */
export function BalanceFrame(props: Props) {
  const headline = balanceHeadline({
    balanceAgorot: props.balanceAgorot,
    status: props.status,
    yearMonth: props.yearMonth,
    currentYearMonth: props.currentYearMonth,
  });

  return (
    <section className={`balance-frame tone-${headline.tone}`}>
      <div className="balance-button">
        <span className="balance-text">
          {headline.text}
          {headline.amountAgorot !== null && (
            <>
              {' '}
              <Amount agorot={headline.amountAgorot} className="balance-amount" />
            </>
          )}
        </span>
      </div>

      {props.savings}

    </section>
  );
}
