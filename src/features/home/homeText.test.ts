import { describe, expect, it } from 'vitest';
import { balanceHeadline, monthLabel, notStartedText } from './homeText';

describe('balanceHeadline', () => {
  it('חודש נוכחי בפלוס: "החודש אנחנו בפלוס"', () => {
    expect(
      balanceHeadline({
        balanceAgorot: 425_000,
        status: 'current',
        yearMonth: '2026-10',
        currentYearMonth: '2026-10',
      }),
    ).toEqual({ text: 'החודש אנחנו בפלוס', amountAgorot: 425_000, tone: 'plus' });
  });

  it('חודש נוכחי במינוס: הסכום מוצג כערך מוחלט', () => {
    expect(
      balanceHeadline({
        balanceAgorot: -135_000,
        status: 'current',
        yearMonth: '2026-10',
        currentYearMonth: '2026-10',
      }),
    ).toEqual({ text: 'החודש אנחנו במינוס', amountAgorot: 135_000, tone: 'minus' });
  });

  it('חודש שהסתיים: "חודש ספטמבר נגמר בפלוס"', () => {
    expect(
      balanceHeadline({
        balanceAgorot: 280_000,
        status: 'past',
        yearMonth: '2026-09',
        currentYearMonth: '2026-10',
      }).text,
    ).toBe('חודש ספטמבר נגמר בפלוס');
    expect(
      balanceHeadline({
        balanceAgorot: -135_000,
        status: 'past',
        yearMonth: '2026-09',
        currentYearMonth: '2026-10',
      }).text,
    ).toBe('חודש ספטמבר נגמר במינוס');
  });

  it('חודש משנה קודמת כולל את השנה', () => {
    expect(
      balanceHeadline({
        balanceAgorot: 100,
        status: 'past',
        yearMonth: '2025-12',
        currentYearMonth: '2026-01',
      }).text,
    ).toBe('חודש דצמבר 2025 נגמר בפלוס');
  });

  it('יתרה אפס אינה מוצגת כפלוס או מינוס', () => {
    const result = balanceHeadline({
      balanceAgorot: 0,
      status: 'current',
      yearMonth: '2026-10',
      currentYearMonth: '2026-10',
    });
    expect(result.tone).toBe('zero');
    expect(result.amountAgorot).toBeNull();
    expect(result.text).toBe('החודש אנחנו על אפס');
  });
});

describe('notStartedText', () => {
  it('חודש עתידי באותה שנה', () => {
    expect(notStartedText('2026-11', '2026-10')).toBe('חודש נובמבר עדיין לא התחיל');
  });

  it('חודש עתידי בשנה הבאה כולל שנה', () => {
    expect(notStartedText('2027-01', '2026-10')).toBe('חודש ינואר 2027 עדיין לא התחיל');
  });
});

describe('monthLabel', () => {
  it('מסתיר שנה נוכחית ומציג שנה אחרת', () => {
    expect(monthLabel('2026-03', '2026-10')).toBe('מרץ');
    expect(monthLabel('2024-03', '2026-10')).toBe('מרץ 2024');
  });
});
