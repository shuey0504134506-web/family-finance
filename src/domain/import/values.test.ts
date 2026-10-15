import { describe, expect, it } from 'vitest';
import { parseAmountAgorot, parseDateCell } from './values';

describe('parseAmountAgorot', () => {
  it.each([
    [1234.5, 123450],
    ['1,234.50', 123450],
    ['₪ 1,234.50', 123450],
    ['(123.40)', -12340],
    ['-123.4', -12340],
    ['123.40-', -12340],
    ['12,50', 1250],
    ['1,250', 125000],
    ['1.234.567', 123456700],
    ['1.234,56', 123456],
    ['0', 0],
    ['‏45.00 ש"ח', 4500],
  ])('%s -> %s', (input, expected) => expect(parseAmountAgorot(input)).toBe(expected));

  it.each(['', 'abc', null, undefined, 'סה"כ', '12/05/2026'])('לא סכום: %s', (input) =>
    expect(parseAmountAgorot(input as never)).toBeNull(),
  );
});

describe('parseDateCell', () => {
  it.each([
    ['05/10/2026', '2026-10-05'],
    ['5.10.26', '2026-10-05'],
    ['05-10-2026', '2026-10-05'],
    ['2026-10-05', '2026-10-05'],
    ['05/10/2026 14:30', '2026-10-05'],
    [46300, '2026-10-05'],
  ])('%s -> %s', (input, expected) => expect(parseDateCell(input)).toBe(expected));

  it('מתעלם מ-Date מקומי כפי שהוא', () => expect(parseDateCell(new Date(2026, 9, 5))).toBe('2026-10-05'));
  it.each(['31/02/2026', '13/13/2026', 'שלום', '', 5, null])('לא תאריך: %s', (input) =>
    expect(parseDateCell(input as never)).toBeNull(),
  );
});
