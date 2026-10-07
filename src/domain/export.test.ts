import { describe, expect, it } from 'vitest';
import { agorotToPlain, buildBackup, csvCell, transactionsToCsv, type ExportTransaction } from './export';

const tx = (over: Partial<ExportTransaction> = {}): ExportTransaction => ({
  scope: 'household',
  id: '1',
  type: 'expense',
  amountAgorot: 125_050,
  date: '2026-10-07',
  yearMonth: '2026-10',
  year: 2026,
  month: 10,
  counterparty: 'סופר',
  categoryId: 'c',
  categoryName: 'מזון',
  paymentMethod: 'credit',
  note: '',
  titheStatus: 'liable',
  isTithePayment: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('csvCell', () => {
  it('עוטף במרכאות כשיש פסיק, מרכאות או שורה חדשה', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('שורה\nשנייה')).toBe('"שורה\nשנייה"');
  });

  it('מונע הזרקת נוסחאות באקסל', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-5 הנחה')).toBe("'-5 הנחה");
  });

  it('טקסט רגיל נשאר כמו שהוא', () => {
    expect(csvCell('סופר')).toBe('סופר');
  });
});

describe('agorotToPlain', () => {
  it('מעצב כמספר עשרוני', () => {
    expect(agorotToPlain(125_050)).toBe('1250.50');
    expect(agorotToPlain(5)).toBe('0.05');
    expect(agorotToPlain(100)).toBe('1.00');
    expect(agorotToPlain(-250)).toBe('-2.50');
  });
});

describe('transactionsToCsv', () => {
  it('כותרות, שורה לפעולה, ומיון מהישן לחדש', () => {
    const csv = transactionsToCsv([tx({ date: '2026-10-08', id: '2' }), tx({ counterparty: 'ספק, בע"מ' })]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith('תחום,סוג,תאריך')).toBe(true);
    expect(lines[1]).toContain('2026-10-07');
    expect(lines[1]).toContain('"ספק, בע""מ"');
    expect(lines[1]).toContain('1250.50');
    expect(lines[2]).toContain('2026-10-08');
  });

  it('מסמן תשלום מעשר והכנסה פטורה', () => {
    const csv = transactionsToCsv([
      tx({ isTithePayment: true }),
      tx({ type: 'income', titheStatus: 'exempt', date: '2026-10-09' }),
    ]);
    expect(csv).toContain('תשלום מעשר');
    expect(csv).toContain('פטור');
  });
});

describe('buildBackup', () => {
  it('מוסיף פורמט, גרסה וזמן יצוא', () => {
    const backup = buildBackup({ a: 1 }, new Date('2026-10-07T10:00:00Z'));
    expect(backup).toEqual({
      format: 'family-finance-backup',
      version: 1,
      exportedAt: '2026-10-07T10:00:00.000Z',
      data: { a: 1 },
    });
  });
});
