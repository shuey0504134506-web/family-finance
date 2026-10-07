import { PAYMENT_METHOD_LABELS, type Scope, type Transaction } from './types';

export type ExportTransaction = Transaction & { scope: Scope };

/**
 * תא CSV בטוח. טקסט שמתחיל ב-= + - @ (או בתו בקרה) נפתח באקסל כנוסחה, ולכן מקדימים לו גרש.
 * מספרים אינם עוברים כאן (הם נכתבים ישירות).
 */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** 125050 -> "1250.50" (בלי סימן מטבע ובלי פסיקים, כדי שאקסל יזהה מספר). */
export function agorotToPlain(agorot: number): string {
  const sign = agorot < 0 ? '-' : '';
  const abs = Math.abs(agorot);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const HEADER = ['תחום', 'סוג', 'תאריך', 'סכום (₪)', 'ספק / לקוח', 'קטגוריה', 'אמצעי תשלום', 'הערה', 'מעשר'];

/** כל הפעולות כ-CSV, מהישן לחדש. השורה הראשונה היא כותרות. */
export function transactionsToCsv(transactions: readonly ExportTransaction[]): string {
  const sorted = [...transactions].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1,
  );
  const lines = [HEADER.map(csvCell).join(',')];
  for (const t of sorted) {
    const tithe = t.type === 'expense' ? (t.isTithePayment ? 'תשלום מעשר' : '') : t.titheStatus === 'exempt' ? 'פטור' : '';
    lines.push(
      [
        csvCell(t.scope === 'business' ? 'עסק' : 'משק בית'),
        csvCell(t.type === 'income' ? 'הכנסה' : 'הוצאה'),
        t.date,
        agorotToPlain(t.amountAgorot),
        csvCell(t.counterparty),
        csvCell(t.categoryName),
        csvCell(PAYMENT_METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod),
        csvCell(t.note),
        csvCell(tithe),
      ].join(','),
    );
  }
  return lines.join('\r\n');
}

export const BACKUP_FORMAT = 'family-finance-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function buildBackup(data: Record<string, unknown>, now: Date = new Date()): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}
