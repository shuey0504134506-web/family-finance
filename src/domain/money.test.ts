import { describe, expect, it } from 'vitest';
import {
  applyBasisPoints,
  formatAgorotNumber,
  formatShekels,
  mulDivRound,
  parseShekelsToAgorot,
  sumAgorot,
} from './money';

describe('parseShekelsToAgorot', () => {
  it('מזהה מספרים שלמים ועשרוניים', () => {
    expect(parseShekelsToAgorot('100')).toBe(10000);
    expect(parseShekelsToAgorot('100.50')).toBe(10050);
    expect(parseShekelsToAgorot('0.05')).toBe(5);
    expect(parseShekelsToAgorot('7.5')).toBe(750);
  });

  it('מתעלם מסימן שקל, רווחים ו"ש"ח"', () => {
    expect(parseShekelsToAgorot(' 1,250.50 ₪ ')).toBe(125050);
    expect(parseShekelsToAgorot('₪300')).toBe(30000);
    expect(parseShekelsToAgorot('300 ש"ח')).toBe(30000);
  });

  it('מבדיל בין מפריד אלפים לפסיק עשרוני', () => {
    expect(parseShekelsToAgorot('1,500')).toBe(150000);
    expect(parseShekelsToAgorot('1,000,000')).toBe(100000000);
    expect(parseShekelsToAgorot('1,50')).toBe(150);
  });

  it('דוחה קלט עמום או שגוי במקום לנחש', () => {
    expect(parseShekelsToAgorot('')).toBeNull();
    expect(parseShekelsToAgorot('abc')).toBeNull();
    expect(parseShekelsToAgorot('1.500')).toBeNull();
    expect(parseShekelsToAgorot('12,34,56')).toBeNull();
    expect(parseShekelsToAgorot('1.2.3')).toBeNull();
    expect(parseShekelsToAgorot('.5')).toBeNull();
    expect(parseShekelsToAgorot('5.')).toBeNull();
  });

  it('דוחה מספרים שאי אפשר לייצג בבטחה', () => {
    expect(parseShekelsToAgorot('99999999999999999999')).toBeNull();
  });

  it('תומך בסכום שלילי ולא מחזיר מינוס אפס', () => {
    expect(parseShekelsToAgorot('-5.25')).toBe(-525);
    expect(Object.is(parseShekelsToAgorot('-0'), 0)).toBe(true);
  });
});

describe('formatShekels', () => {
  it('מציג מפרידי אלפים ומסתיר אגורות כשאין', () => {
    expect(formatAgorotNumber(1800000)).toBe('18,000');
    expect(formatShekels(1800000)).toBe('18,000\u00A0₪');
  });

  it('מציג אגורות כשיש', () => {
    expect(formatAgorotNumber(10050)).toBe('100.50');
    expect(formatAgorotNumber(5)).toBe('0.05');
  });

  it('תומך בערכים שליליים ובתצוגת אגורות קבועה', () => {
    expect(formatAgorotNumber(-135000)).toBe('-1,350');
    expect(formatAgorotNumber(10000, { fraction: 'always' })).toBe('100.00');
  });

  it('זורק שגיאה על ערך שאינו מספר שלם', () => {
    expect(() => formatAgorotNumber(10.5)).toThrow();
    expect(() => formatAgorotNumber(Number.NaN)).toThrow();
  });
});

describe('sumAgorot', () => {
  it('מסכם במדויק, בלי שגיאות floating point', () => {
    // 0.1 + 0.2 הוא הדוגמה הקלאסית לבעיה ב-floating point. באגורות: 10 + 20.
    expect(sumAgorot([10, 20])).toBe(30);
    expect(sumAgorot([])).toBe(0);
  });

  it('זורק שגיאה אם אחד הערכים אינו שלם', () => {
    expect(() => sumAgorot([100, 0.5])).toThrow();
  });
});

describe('mulDivRound / applyBasisPoints', () => {
  it('מחשב 10% בדיוק', () => {
    expect(applyBasisPoints(1800000, 1000)).toBe(180000);
  });

  it('מעגל חצי כלפי מעלה', () => {
    expect(mulDivRound(5, 1, 2)).toBe(3);
    expect(mulDivRound(4, 1, 2)).toBe(2);
    expect(applyBasisPoints(15, 1000)).toBe(2); // 1.5 אגורות -> 2
    expect(applyBasisPoints(14, 1000)).toBe(1); // 1.4 אגורות -> 1
  });

  it('מעגל ערכים שליליים באופן סימטרי', () => {
    expect(mulDivRound(-5, 1, 2)).toBe(-3);
    expect(mulDivRound(-4, 1, 2)).toBe(-2);
  });

  it('בטוח לסכומים גדולים', () => {
    expect(applyBasisPoints(100_000_000_000, 1000)).toBe(10_000_000_000);
  });

  it('זורק שגיאה בחלוקה באפס', () => {
    expect(() => mulDivRound(1, 1, 0)).toThrow();
  });
});
