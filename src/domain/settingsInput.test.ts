import { describe, expect, it } from 'vitest';
import { formatBpsAsPercent, parsePercentToBps } from './settingsInput';

describe('parsePercentToBps', () => {
  it('ממיר אחוזים לנקודות בסיס', () => {
    expect(parsePercentToBps('10')).toBe(1000);
    expect(parsePercentToBps('7.5')).toBe(750);
    expect(parsePercentToBps('8.25%')).toBe(825);
    expect(parsePercentToBps('0')).toBe(0);
    expect(parsePercentToBps('100')).toBe(10_000);
  });

  it('דוחה ערכים לא תקינים או מחוץ לטווח', () => {
    for (const text of ['', 'abc', '-1', '100.01', '101', '1.555', '1.500']) {
      expect(parsePercentToBps(text), text).toBeNull();
    }
  });
});

describe('formatBpsAsPercent', () => {
  it('מציג אחוזים קריאים', () => {
    expect(formatBpsAsPercent(1000)).toBe('10');
    expect(formatBpsAsPercent(750)).toBe('7.5');
    expect(formatBpsAsPercent(825)).toBe('8.25');
    expect(formatBpsAsPercent(0)).toBe('0');
  });

  it('הפיכה: פענוח של פורמט מחזיר את אותו ערך', () => {
    for (const bps of [0, 1, 50, 750, 825, 1000, 10_000]) {
      expect(parsePercentToBps(formatBpsAsPercent(bps))).toBe(bps);
    }
  });
});
