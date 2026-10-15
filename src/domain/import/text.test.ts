import { describe, expect, it } from 'vitest';
import { looksLikeHtml, parseCsv, parseHtmlTables } from './text';

describe('parseCsv', () => {
  it('פסיקים, מרכאות ושורות ריקות', () => {
    const t = parseCsv('﻿תאריך,תיאור,סכום\n05/10/2026,"שופרסל, סניף ""א""",120.5\n\n06/10/2026,קפה,15\n');
    expect(t).toEqual([
      ['תאריך', 'תיאור', 'סכום'],
      ['05/10/2026', 'שופרסל, סניף "א"', '120.5'],
      ['06/10/2026', 'קפה', '15'],
    ]);
  });
  it('מזהה נקודה-פסיק וטאב', () => {
    expect(parseCsv('a;b;c\n1;2;3')[1]).toEqual(['1', '2', '3']);
    expect(parseCsv('a\tb\tc\n1\t2\t3')[1]).toEqual(['1', '2', '3']);
  });
  it('מרכאה באמצע שדה לא מוקף (בע"מ) אינה פותחת ציטוט', () => {
    expect(parseCsv('a,b\nישראכרט בע"מ,5\nשורה,6')).toEqual([['a', 'b'], ['ישראכרט בע"מ', '5'], ['שורה', '6']]);
  });
  it('שורת CRLF', () => expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]));
});

describe('html', () => {
  it('מזהה HTML', () => {
    expect(looksLikeHtml('\n<html><body>')).toBe(true);
    expect(looksLikeHtml('תאריך,סכום')).toBe(false);
  });
  it('מוציא טבלה עם ישויות', () => {
    const html = '<table><tr><th>תאריך</th><th>תיאור</th></tr><tr><td>05/10/2026</td><td>ח&amp;מ&nbsp;<b>בע"מ</b></td></tr></table>';
    expect(parseHtmlTables(html)).toEqual([{ name: 'טבלה 1', rows: [['תאריך', 'תיאור'], ['05/10/2026', 'ח&מ בע"מ']] }]);
  });
});
