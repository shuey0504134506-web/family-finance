import { describe, expect, it } from 'vitest';
import { fuzzyMatchAll, normalizeText } from './fuzzy';

describe('fuzzyMatchAll', () => {
  it('מתאים התאמה מדויקת וחלקית', () => {
    expect(fuzzyMatchAll('איך מחשבים מעשרות', 'מעשר')).toBe(true);
  });
  it('סובל כתיב חסר ומלא', () => {
    expect(fuzzyMatchAll('הוראות קבע', 'הוראת קבע')).toBe(true);
    expect(fuzzyMatchAll('מעשרות', 'מעשרוט')).toBe(true);
  });
  it('סובל אות חסרה, מיותרת, מוחלפת והיפוך', () => {
    expect(fuzzyMatchAll('ייבוא נתונים מהבנק', 'ייבוה')).toBe(true);
    expect(fuzzyMatchAll('תקציב חודשי', 'תקציבב')).toBe(true);
    expect(fuzzyMatchAll('תקציב חודשי', 'תקצבי')).toBe(true);
    expect(fuzzyMatchAll('סיסמה ושחזור', 'סיסמא')).toBe(true);
  });
  it('לא מתאים מילים שונות', () => {
    expect(fuzzyMatchAll('תקציב חודשי', 'מעשרות')).toBe(false);
    expect(fuzzyMatchAll('אב', 'גד')).toBe(false);
  });
  it('מספרים מדויקים בלבד', () => {
    expect(fuzzyMatchAll('סכום 1250', '1251')).toBe(false);
    expect(fuzzyMatchAll('סכום 1250', '1250')).toBe(true);
  });
  it('מאחד אותיות סופיות וניקוד', () => {
    expect(normalizeText('שָׁלוֹם')).toBe('שלומ');
  });
});
