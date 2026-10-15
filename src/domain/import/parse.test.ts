import { describe, expect, it } from 'vitest';
import { detectLayout } from './layout';
import { isCardLumpSum, parseWorkbook } from './parse';

// הפריסות כאן בנויות לפי כותרות הייצוא המוכרות של כל מוסד. אין בהן נתונים אמיתיים.

describe('כרטיס אשראי בסגנון מקס (כמה גיליונות, מט"ח וטרם נקלט)', () => {
  const header = ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב', 'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות'];
  const sheets = [
    {
      name: 'עסקאות במועד החיוב',
      rows: [
        ['כרטיס 1234'],
        header,
        ['05/10/2026', 'שופרסל דיל', 'מזון וצריכה', '1234', 'רגילה', 120.5, 'ש"ח', 120.5, 'ש"ח', '10/11/2026', ''],
        ['06/10/2026', 'בית קפה "ארומה"', 'מסעדות', '1234', 'רגילה', '32.00', 'ש"ח', '32.00', 'ש"ח', '10/11/2026', ''],
        ['07/10/2026', 'החזר מחנות', 'קניות', '1234', 'זיכוי', -50, 'ש"ח', -50, 'ש"ח', '10/11/2026', ''],
        ['סה"כ', '', '', '', '', 102.5],
      ],
    },
    {
      name: 'עסקאות חו"ל ומט"ח',
      rows: [header, ['08/10/2026', 'AMAZON', 'קניות', '1234', 'רגילה', 367.2, 'ש"ח', 100, 'USD', '10/11/2026', '']],
    },
    { name: 'עסקאות שאושרו וטרם נקלטו', rows: [header, ['09/10/2026', 'WOLT', 'מסעדות', '1234', 'רגילה', 80, 'ש"ח', 80, 'ש"ח', '', '']] },
  ];
  const { parsed, skipped } = parseWorkbook(sheets);
  const rows = parsed.flatMap((p) => p.rows);

  it('קורא את כל הגיליונות ודולג על שורת סיכום וכותרת עליונה', () => {
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(5);
    expect(parsed[0]!.layout).toMatchObject({ headerRow: 1, kind: 'card', confidence: 'high' });
  });
  it('הוצאה והחזר', () => {
    expect(rows[0]).toMatchObject({ date: '2026-10-05', type: 'expense', amountAgorot: 12050, name: 'שופרסל דיל', card: '1234', issuerCategory: 'מזון וצריכה', payment: 'credit', currency: 'ILS' });
    expect(rows[2]).toMatchObject({ type: 'income', amountAgorot: 5000, refund: true });
  });
  it('מט"ח: מחויב בשקלים ומקור הסכום בפרטים', () => {
    expect(rows[3]).toMatchObject({ amountAgorot: 36720, currency: 'ILS' });
    expect(rows[3]!.details).toContain('100.00 USD');
  });
  it('גיליון "טרם נקלטו" מסומן כממתין', () => {
    expect(rows[4]!.pending).toBe(true);
    expect(rows[0]!.pending).toBe(false);
  });
});

describe('כרטיס אשראי בסגנון ישראכרט (שורות פתיחה לפני הכותרות)', () => {
  const rows = [
    ['פירוט עסקאות', ''],
    ['מועד חיוב: 10/11/2026'],
    ['תאריך רכישה', 'שם בית עסק', 'סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב', "מס' שובר", 'פירוט נוסף'],
    ['01/10/2026', 'רמי לוי שיווק', '250.00', '₪', '250.00', '₪', '123456', ''],
    ['02/10/2026', 'NETFLIX', '15.99', '$', '58.00', '₪', '7788', 'עסקה בחו"ל'],
  ];
  const result = parseWorkbook([{ name: 'Sheet1', rows }]);
  it('מוצא כותרות בשורה 3', () => {
    expect(result.parsed[0]!.layout.headerRow).toBe(2);
    expect(result.parsed[0]!.rows).toHaveLength(2);
  });
  it('סכום חיוב בשקלים, מקור במט"ח בפרטים', () => {
    expect(result.parsed[0]!.rows[1]).toMatchObject({ amountAgorot: 5800, currency: 'ILS' });
    expect(result.parsed[0]!.rows[1]!.details).toContain('15.99 $');
  });
});

describe('דף עו"ש בסגנון הפועלים (חובה וזכות)', () => {
  const rows = [
    ['תאריך', 'תיאור הפעולה', 'פרטים', 'אסמכתא', 'תאריך ערך', 'חובה', 'זכות', 'יתרה'],
    ['05/10/2026', 'משכורת', '', '1001', '05/10/2026', '', '9,500.00', '12,000.00'],
    ['06/10/2026', 'ארנונה', 'הוראת קבע', '1002', '06/10/2026', '850.00', '', '11,150.00'],
    ['07/10/2026', 'ישראכרט בע"מ', 'חיוב כרטיס', '1003', '07/10/2026', '2,300.40', '', '8,849.60'],
    ['08/10/2026', 'שיק 4411', '', '1004', '08/10/2026', '400', '', '8,449.60'],
  ];
  const { parsed } = parseWorkbook([{ name: 'עובר ושב', rows }]);
  const r = parsed[0]!.rows;
  it('זיהוי כיוון וסכום', () => {
    expect(parsed[0]!.layout.kind).toBe('bank');
    expect(r.map((x) => [x.type, x.amountAgorot])).toEqual([['income', 950000], ['expense', 85000], ['expense', 230040], ['expense', 40000]]);
  });
  it('חיוב כרטיס מסכם מסומן, ושיק מזוהה', () => {
    expect(r[2]!.cardLumpSum).toBe(true);
    expect(r[1]!.cardLumpSum).toBe(false);
    expect(r[3]!.payment).toBe('check');
    expect(r[1]!.payment).toBe('direct');
  });
});

describe('דף עו"ש עם סכום בודד עם סימן (סגנון דיסקונט)', () => {
  const rows = [
    ['תאריך', 'יום ערך', 'תיאור', '₪ זכות/חובה', '₪ יתרה', 'אסמכתא'],
    ['05/10/2026', '05/10/2026', 'העברה מדני', '300.00', '5000', '1'],
    ['06/10/2026', '06/10/2026', 'סופר', '-120.50', '4879.5', '2'],
  ];
  const { parsed } = parseWorkbook([{ name: 'a', rows }]);
  it('מינוס = הוצאה', () => {
    expect(parsed[0]!.rows.map((x) => [x.type, x.amountAgorot])).toEqual([['income', 30000], ['expense', 12050]]);
    expect(parsed[0]!.rows[0]!.payment).toBe('transfer');
  });
});

describe('בלי כותרות מוכרות: ניחוש לפי תוכן', () => {
  const rows = [
    ['05/10/2026', 'סופר שוק העיר', '-120.50'],
    ['06/10/2026', 'משכורת', '9000'],
    ['07/10/2026', 'דלק פז', '-300'],
    ['08/10/2026', 'מכולת', '-45'],
  ];
  it('מציע פריסה ומסמן שהיא ניחוש', () => {
    const layout = detectLayout(rows)!;
    expect(layout).toMatchObject({ confidence: 'guess', headerRow: -1, columns: { date: 0, description: 1, amount: 2 } });
    const { parsed } = parseWorkbook([{ name: 'x', rows }]);
    expect(parsed[0]!.rows).toHaveLength(4);
    expect(parsed[0]!.rows[1]).toMatchObject({ type: 'income', amountAgorot: 900000 });
  });
  it('גיליון שאינו רשימת תנועות מדולג', () => {
    expect(parseWorkbook([{ name: 'ריק', rows: [['שלום'], ['עולם']] }]).skipped).toEqual(['ריק']);
  });
});

describe('isCardLumpSum', () => {
  it.each([
    ['ישראכרט בע"מ', true],
    ['חיוב כרטיס אשראי', true],
    ['כאל חיוב', true],
    ['מקס איט פיננסים בע"מ', true],
    ['שופרסל', false],
    ['משכורת', false],
  ])('%s', (name, expected) => expect(isCardLumpSum(name)).toBe(expected));
});
