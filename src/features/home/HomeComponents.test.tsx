import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BalanceFrame } from './BalanceFrame';
import { TotalsTiles } from './TotalsTiles';

/** מנקה תגיות ומחזיר את הטקסט הנראה (עם NBSP כרווח רגיל), לצורך השוואה. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('BalanceFrame', () => {
  it('חודש נוכחי בפלוס מציג "החודש אנחנו בפלוס 4,250 ₪"', () => {
    const html = renderToStaticMarkup(
      <BalanceFrame
        incomeAgorot={1_000_000}
        expenseAgorot={575_000}
        balanceAgorot={425_000}
        status="current"
        yearMonth="2026-10"
        currentYearMonth="2026-10"
      />,
    );
    expect(visibleText(html)).toContain('החודש אנחנו בפלוס 4,250 ₪');
    expect(html).toContain('tone-plus');
  });

  it('חודש נוכחי במינוס מציג "במינוס 1,350 ₪" בלי סימן מינוס כפול', () => {
    const html = renderToStaticMarkup(
      <BalanceFrame
        incomeAgorot={100_000}
        expenseAgorot={235_000}
        balanceAgorot={-135_000}
        status="current"
        yearMonth="2026-10"
        currentYearMonth="2026-10"
      />,
    );
    const text = visibleText(html);
    expect(text).toContain('החודש אנחנו במינוס 1,350 ₪');
    expect(text).not.toContain('-1,350');
    expect(html).toContain('tone-minus');
  });

  it('חודש שנגמר מציג "חודש ספטמבר נגמר בפלוס 2,800 ₪"', () => {
    const html = renderToStaticMarkup(
      <BalanceFrame
        incomeAgorot={1_000_000}
        expenseAgorot={720_000}
        balanceAgorot={280_000}
        status="past"
        yearMonth="2026-09"
        currentYearMonth="2026-10"
      />,
    );
    expect(visibleText(html)).toContain('חודש ספטמבר נגמר בפלוס 2,800 ₪');
  });

  it('הפירוט סגור כברירת מחדל ונפתח רק בלחיצה', () => {
    const html = renderToStaticMarkup(
      <BalanceFrame
        incomeAgorot={1}
        expenseAgorot={0}
        balanceAgorot={1}
        status="current"
        yearMonth="2026-10"
        currentYearMonth="2026-10"
      />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('שווה יתרה');
  });
});

describe('TotalsTiles', () => {
  it('מציג סך הכנסות וסך הוצאות', () => {
    const html = renderToStaticMarkup(
      <TotalsTiles incomeAgorot={3_000_000} expenseAgorot={1_200_000} loading={false} />,
    );
    const text = visibleText(html);
    expect(text).toContain('סך הכנסות 30,000 ₪');
    expect(text).toContain('סך הוצאות 12,000 ₪');
  });

  it('בזמן טעינה לא מציג 0 ₪ מטעה', () => {
    const html = renderToStaticMarkup(
      <TotalsTiles incomeAgorot={0} expenseAgorot={0} loading={true} />,
    );
    expect(visibleText(html)).not.toContain('0 ₪');
  });
});
