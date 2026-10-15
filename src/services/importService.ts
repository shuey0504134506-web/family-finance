import { getDocs, query, where, writeBatch } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { looksLikeHtml, parseCsv, parseHtmlTables, type Sheet } from '../domain/import/text';
import type { ExistingTx } from '../domain/import/match';
import { businessIdOf, type Space } from '../domain/spaces';
import type { Transaction } from '../domain/types';
import { transactionsCollection } from './transactionService';

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export type ImportReadError = 'too-large' | 'pdf' | 'encrypted' | 'unreadable' | 'empty';

export class ImportReadFailure extends Error {
  constructor(readonly code: ImportReadError) {
    super(code);
  }
}

export const IMPORT_ERROR_TEXT: Record<ImportReadError, string> = {
  'too-large': 'הקובץ גדול מדי (עד 15MB).',
  pdf: 'קובצי PDF לא נתמכים. בבנק או באתר חברת האשראי יש לבחור ייצוא ל-Excel או ל-CSV.',
  encrypted: 'הקובץ מוגן בסיסמה. יש לפתוח אותו באקסל, לשמור עותק בלי סיסמה ולנסות שוב.',
  unreadable: 'לא הצלחנו לקרוא את הקובץ. אפשר לפתוח אותו באקסל ולשמור כ-xlsx או כ-CSV.',
  empty: 'לא נמצאו בקובץ תנועות.',
};

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // ייצוא ישן מהבנק בקידוד עברית של וינדוס
    return new TextDecoder('windows-1255').decode(bytes);
  }
}

/** קורא קובץ שהמשתמש בחר (xlsx, xls, csv, או "אקסל" שהוא בעצם HTML) לגיליונות גולמיים. */
export async function readImportFile(file: File): Promise<Sheet[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportReadFailure('too-large');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) throw new ImportReadFailure('empty');

  const head = String.fromCharCode(...bytes.slice(0, 5));
  if (head.startsWith('%PDF')) throw new ImportReadFailure('pdf');

  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf;
  let sheets: Sheet[];
  if (isZip || isOle) {
    try {
      const XLSX = await import('@e965/xlsx');
      const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
      sheets = workbook.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name]!, { header: 1, raw: true, defval: null, blankrows: false }) as Sheet['rows'],
      }));
    } catch (error) {
      if (/password|encrypt/i.test(String((error as Error)?.message))) throw new ImportReadFailure('encrypted');
      throw new ImportReadFailure('unreadable');
    }
  } else {
    const text = decodeText(bytes);
    sheets = looksLikeHtml(text) ? parseHtmlTables(text) : [{ name: file.name, rows: parseCsv(text) }];
  }
  sheets = sheets.filter((s) => s.rows.length > 0);
  if (sheets.length === 0) throw new ImportReadFailure('empty');
  return sheets;
}

export type ExistingForImport = (ExistingTx & { categoryId: string })[];

/** הפעולות הקיימות בטווח תאריכים במרחב, להשוואת כפילויות ולמידת קטגוריות. עובד גם מהמטמון בלי רשת. */
export async function loadExistingForImport(uid: string, space: Space, from: string, to: string): Promise<ExistingForImport> {
  const snapshot = await getDocs(query(transactionsCollection(uid, space.scope), where('date', '>=', from), where('date', '<=', to)));
  const out: ExistingForImport = [];
  for (const d of snapshot.docs) {
    const t = d.data() as Transaction;
    if (space.scope === 'business' && businessIdOf(t) !== space.businessId) continue;
    out.push({
      id: d.id,
      type: t.type,
      amountAgorot: t.amountAgorot,
      date: t.date,
      counterparty: t.counterparty,
      note: t.note,
      paymentMethod: t.paymentMethod,
      currency: t.currency,
      categoryId: t.categoryId,
    });
  }
  return out;
}

const BATCH_SIZE = 400;

/**
 * שומר את הפעולות בקבוצות. כל פעולה נכתבת תחת מזהה קבוע, ולכן הרצה חוזרת לא יוצרת כפילות.
 * בלי אינטרנט הכתיבה נשמרת במכשיר ומסונכרנת אחר כך: לכן ממתינים רק זמן קצר לאישור השרת.
 * מחזיר 'synced' כשהשרת אישר, 'queued' כשנשמר במכשיר וממתין לחיבור. `settled` מדווח על כישלון מאוחר.
 */
export async function commitImport(
  uid: string,
  space: Space,
  transactions: readonly Transaction[],
): Promise<{ outcome: 'synced' | 'queued'; settled: Promise<void> }> {
  const commits: Promise<void>[] = [];
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const t of transactions.slice(i, i + BATCH_SIZE)) {
      batch.set(doc(transactionsCollection(uid, space.scope), t.id), t);
    }
    commits.push(batch.commit());
  }
  const settled = Promise.all(commits).then(() => undefined);
  const outcome = await Promise.race([settled.then(() => 'synced' as const), new Promise<'queued'>((r) => setTimeout(() => r('queued'), 4000))]);
  return { outcome, settled };
}
