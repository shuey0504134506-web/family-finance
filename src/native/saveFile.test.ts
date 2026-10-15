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

import { parseImageDataUrl } from './saveFile';

describe('parseImageDataUrl', () => {
  it('מפרק תמונת jpeg', () => {
    expect(parseImageDataUrl('data:image/jpeg;base64,QUJD')).toEqual({ mime: 'image/jpeg', ext: 'jpg', base64: 'QUJD' });
  });
  it('דוחה תוכן שאינו תמונה', () => {
    expect(parseImageDataUrl('data:text/html;base64,QUJD')).toBeNull();
    expect(parseImageDataUrl('https://x/y.png')).toBeNull();
  });
});
