import { describe, expect, it } from 'vitest';
import { formatPercentChange, percentChange } from './compare';

describe('percentChange (דוגמת הרכב מהמסמך)', () => {
  it('2025 -> 2026: 14,200 -> 16,800 הוא +18.3%', () => {
    expect(percentChange(1_420_000, 1_680_000)).toBe(18.3);
  });

  it('2024 -> 2025: 12,500 -> 14,200 הוא +13.6%', () => {
    expect(percentChange(1_250_000, 1_420_000)).toBe(13.6);
  });

  it('ירידה מוצגת כשלילית', () => {
    expect(percentChange(200_000, 190_000)).toBe(-5);
  });

  it('אין שינוי כשהסכומים שווים', () => {
    expect(percentChange(100_000, 100_000)).toBe(0);
  });

  it('אי אפשר לחשב כשהסכום הקודם הוא אפס', () => {
    expect(percentChange(0, 100_000)).toBeNull();
  });
});

describe('formatPercentChange', () => {
  it('מעצב עם סימן', () => {
    expect(formatPercentChange(18.3)).toBe('+18.3%');
    expect(formatPercentChange(-5)).toBe('-5.0%');
    expect(formatPercentChange(0)).toBe('0.0%');
    expect(formatPercentChange(null)).toBe('—');
  });
});
