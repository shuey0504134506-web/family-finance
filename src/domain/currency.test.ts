import { afterEach, describe, expect, it } from 'vitest';
import { isCurrencyCode, setCurrency } from './currency';
import { formatShekels, parseShekelsToAgorot } from './money';

afterEach(() => setCurrency('ILS'));

describe('מטבע', () => {
  it('שקל אחרי המספר, שאר המטבעות לפניו, ומינוס תמיד ראשון', () => {
    expect(formatShekels(123450)).toBe('1,234.50 ₪');
    setCurrency('USD');
    expect(formatShekels(123450)).toBe('$1,234.50');
    expect(formatShekels(-5000)).toBe('-$50');
    setCurrency('EUR');
    expect(formatShekels(100)).toBe('€1');
  });

  it('קורא סכום עם כל סימן מטבע נתמך', () => {
    expect(parseShekelsToAgorot('$1,250.50')).toBe(125050);
    expect(parseShekelsToAgorot('€ 10')).toBe(1000);
    expect(parseShekelsToAgorot('100 ₪')).toBe(10000);
  });

  it('מזהה קודי מטבע תקינים בלבד', () => {
    expect(isCurrencyCode('GBP')).toBe(true);
    expect(isCurrencyCode('XXX')).toBe(false);
    expect(isCurrencyCode(5)).toBe(false);
  });
});
