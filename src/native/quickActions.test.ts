import { describe, expect, it } from 'vitest';
import { parseQuickUrl } from './quickActions';

describe('parseQuickUrl', () => {
  it('מזהה הכנסה והוצאה', () => {
    expect(parseQuickUrl('com.familyfinance.app://quick/income')).toBe('income');
    expect(parseQuickUrl('com.familyfinance.app://quick/expense/')).toBe('expense');
  });
  it('מתעלם מכל כתובת אחרת', () => {
    expect(parseQuickUrl('com.familyfinance.app://quick/other')).toBeNull();
    expect(parseQuickUrl('https://evil.com/quick/income')).toBeNull();
    expect(parseQuickUrl(undefined)).toBeNull();
  });
});
