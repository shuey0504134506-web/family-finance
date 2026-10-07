import { describe, expect, it } from 'vitest';
import {
  addMonths,
  currentYearMonth,
  formatDisplayDate,
  formatMonthYear,
  isValidIsoDate,
  lastMonths,
  monthDateRange,
  monthStatus,
  todayIso,
  yearMonthOfDate,
} from './dates';

describe('addMonths', () => {
  it('עובר בין חודשים וגם בין שנים', () => {
    expect(addMonths('2026-10', -1)).toBe('2026-09');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-10', 14)).toBe('2027-12');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
  });
});

describe('monthStatus', () => {
  it('מזהה חודש עבר, נוכחי ועתידי', () => {
    expect(monthStatus('2026-09', '2026-10')).toBe('past');
    expect(monthStatus('2026-10', '2026-10')).toBe('current');
    expect(monthStatus('2026-11', '2026-10')).toBe('future');
    expect(monthStatus('2027-01', '2026-10')).toBe('future');
    expect(monthStatus('2025-12', '2026-01')).toBe('past');
  });
});

describe('תאריכים', () => {
  it('מאמת תאריכים אמיתיים בלבד', () => {
    expect(isValidIsoDate('2026-10-07')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-10-7')).toBe(false);
    expect(isValidIsoDate('hello')).toBe(false);
  });

  it('מחשב חודש מתאריך ומעצב לתצוגה', () => {
    expect(yearMonthOfDate('2026-10-07')).toBe('2026-10');
    expect(formatDisplayDate('2026-10-07')).toBe('07/10/2026');
    expect(formatMonthYear('2026-10')).toBe('אוקטובר 2026');
  });

  it('מחזיר את התאריך המקומי בלי הסטת אזור זמן', () => {
    // 1 בינואר 00:30 בזמן מקומי חייב להישאר 1 בינואר
    const earlyMorning = new Date(2026, 0, 1, 0, 30);
    expect(todayIso(earlyMorning)).toBe('2026-01-01');
    expect(currentYearMonth(earlyMorning)).toBe('2026-01');
    const lateNight = new Date(2026, 11, 31, 23, 59);
    expect(todayIso(lateNight)).toBe('2026-12-31');
  });

  it('טווח חודש כולל את כל ימי החודש ורק אותם', () => {
    const { start, end } = monthDateRange('2026-02');
    expect('2026-02-01' >= start && '2026-02-28' <= end).toBe(true);
    expect('2026-01-31' >= start).toBe(false);
    expect('2026-03-01' <= end).toBe(false);
  });

  it('lastMonths מחזיר 12 חודשים אחרונים מהישן לחדש', () => {
    const months = lastMonths('2026-10', 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-11');
    expect(months[11]).toBe('2026-10');
  });
});
