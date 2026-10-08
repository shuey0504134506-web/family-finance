import { afterEach, describe, expect, it } from 'vitest';
import { EN } from './en';
import { setLangForTest } from './lang';
import { translateText } from './translate';

afterEach(() => setLangForTest('he'));

describe('תרגום לאנגלית', () => {
  it('בעברית הטקסט נשאר כמות שהוא', () => {
    expect(translateText('הגדרות')).toBe('הגדרות');
  });

  it('באנגלית מתרגם טקסט מדויק ושומר רווחים בקצוות', () => {
    setLangForTest('en');
    expect(translateText('הגדרות')).toBe('Settings');
    expect(translateText(' הגדרות ')).toBe(' Settings ');
  });

  it('מתרגם תבניות עם ערכים דינמיים, כולל ערך שמתורגם בעצמו', () => {
    setLangForTest('en');
    expect(translateText('הקוד שגוי. נותרו 3 ניסיונות.')).toBe('Incorrect code. 3 attempts left.');
    expect(translateText('סיכום אוקטובר 2026')).toBe('Summary October 2026');
    expect(translateText('סכום (€)')).toBe('Amount (€)');
  });

  it('ביטוי שהורכב ממחרוזות מוכרות מתורגם, אבל רק אם כולו מוכר', () => {
    setLangForTest('en');
    expect(translateText('החודש אנחנו בפלוס')).toBe('This month we are in the black');
    expect(translateText('החודש אנחנו בשם כלשהו')).toBe('החודש אנחנו בשם כלשהו');
  });

  it('טקסט לא מוכר ללא עברית או עם עברית נשאר כמות שהוא', () => {
    setLangForTest('en');
    expect(translateText('Hello')).toBe('Hello');
    expect(translateText('טקסט שלא קיים במילון')).toBe('טקסט שלא קיים במילון');
  });

  it('לכל תבנית באנגלית אותם סימני {n} כמו בעברית', () => {
    for (const [he, en] of Object.entries(EN)) {
      const a = (he.match(/\{\d\}/g) ?? []).sort().join();
      const b = (en.match(/\{\d\}/g) ?? []).sort().join();
      expect(b, he).toBe(a);
    }
  });
});
