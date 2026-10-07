import { useId, useState } from 'react';
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
}

/**
 * מסגרת הפלוס/מינוס החודשי. בלחיצה נפתח פירוט החישוב:
 * הכנסות, פחות הוצאות, שווה יתרה.
 */
export function BalanceFrame(props: Props) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const headline = balanceHeadline({
    balanceAgorot: props.balanceAgorot,
    status: props.status,
    yearMonth: props.yearMonth,
    currentYearMonth: props.currentYearMonth,
  });

  return (
    <section className={`balance-frame tone-${headline.tone}`}>
      <button
        type="button"
        className="balance-button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="balance-text">
          {headline.text}
          {headline.amountAgorot !== null && (
            <>
              {' '}
              <Amount agorot={headline.amountAgorot} className="balance-amount" />
            </>
          )}
        </span>
        <span className="balance-hint">{open ? 'הסתרת הפירוט' : 'לחיצה להצגת הפירוט'}</span>
      </button>

      {open && (
        <dl id={detailsId} className="balance-details">
          <div>
            <dt>הכנסות</dt>
            <dd>
              <Amount agorot={props.incomeAgorot} className="tone-income" />
            </dd>
          </div>
          {props.fromBusinessAgorot !== undefined && props.fromBusinessAgorot !== 0 && (
            <div className="balance-subrow">
              {props.fromBusinessAgorot > 0 ? (
                <>
                  <dt>מתוכן: הכנסה מהעסק</dt>
                  <dd>
                    <Amount agorot={props.fromBusinessAgorot} />
                  </dd>
                </>
              ) : (
                <>
                  <dt>מתוכן: הפסד מהעסק (מקטין את ההכנסות)</dt>
                  <dd>
                    <Amount agorot={Math.abs(props.fromBusinessAgorot)} className="tone-expense" />
                  </dd>
                </>
              )}
            </div>
          )}
          <div>
            <dt>פחות הוצאות</dt>
            <dd>
              <Amount agorot={props.expenseAgorot} className="tone-expense" />
            </dd>
          </div>
          <div className="balance-total">
            <dt>שווה יתרה</dt>
            <dd>
              <Amount agorot={props.balanceAgorot} className={`tone-${headline.tone}`} />
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
