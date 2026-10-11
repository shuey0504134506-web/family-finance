import { describe, expect, it } from 'vitest';
import { safeFileName } from './saveFile';

describe('safeFileName', () => {
  it('שומר שם תקין', () => {
    expect(safeFileName('finance-backup-2026-10-11.json')).toBe('finance-backup-2026-10-11.json');
  });
  it('מחליף תווים לא בטוחים ושומר סיומת', () => {
    expect(safeFileName('גיבוי ניהול כספים 2026.json')).toBe('2026.json');
    expect(safeFileName('a b/c.csv')).toBe('a-b-c.csv');
  });
  it('שם ריק לגמרי מקבל ברירת מחדל', () => {
    expect(safeFileName('גיבוי')).toBe('file');
  });
});
