import { detectLayout, type ColumnRole, type Layout } from './layout';
import type { Sheet, Table } from './text';
import { cleanText, parseAmountAgorot, parseDateCell, type Cell } from './values';
import type { PaymentMethod, TransactionType } from '../types';

/** שורה מוכנה לייבוא (עדיין לא נשמרה). */
export interface ImportRow {
  /** מזהה יציב לשורה בקובץ: מבטיח שייבוא חוזר של אותו קובץ לא ייצור כפילות. */
  key: string;
  sheet: string;
  /** מספר השורה בקובץ (מ-1), להצגה */
  line: number;
  date: string;
  type: TransactionType;
  amountAgorot: number;
  /** ILS / USD / EUR / GBP; null = מטבע שאינו נתמך באפליקציה */
  currency: 'ILS' | 'USD' | 'EUR' | 'GBP' | null;
  name: string;
  /** פרטים נוספים מהקובץ (הערות, פירוט, מקור הסכום במט"ח) */
  details: string;
  /** 4 ספרות אחרונות של הכרטיס, אם קיימות */
  card: string;
  /** הקטגוריה כפי שחברת האשראי סיווגה, אם קיימת */
  issuerCategory: string;
  payment: PaymentMethod;
  /** חיוב מסכם של כרטיס אשראי בדף הבנק (כבר מופיע בפירוט הכרטיס) */
  cardLumpSum: boolean;
  /** עסקה שטרם נקלטה/אושרה */
  pending: boolean;
  /** זיכוי (החזר) בכרטיס אשראי */
  refund: boolean;
}

const CURRENCY_SIGNS: [RegExp, NonNullable<ImportRow['currency']>][] = [
  [/^(₪|ש"?ח|שח|ils|nis|שקל|שקלים)$/i, 'ILS'],
  [/^(\$|usd|דולר|דולר אמריקאי)$/i, 'USD'],
  [/^(€|eur|אירו|יורו)$/i, 'EUR'],
  [/^(£|gbp|לירה שטרלינג|פאונד)$/i, 'GBP'],
];

export function currencyFromText(text: string): ImportRow['currency'] | undefined {
  const t = cleanText(text as never);
  if (!t) return undefined;
  for (const [re, code] of CURRENCY_SIGNS) if (re.test(t)) return code;
  return null;
}

const CARD_COMPANIES = /ויזה|ישראכרט|מקס|כאל|דיינרס|אמריקן|אמקס|לאומי ?קארד|ישראקארט|visa|isracard|cal\b|max\b|diners|amex/i;

/** חיוב מסכם של כרטיס אשראי בדף הבנק. */
export function isCardLumpSum(description: string): boolean {
  const d = cleanText(description as never);
  if (!d) return false;
  if (/חיוב.{0,12}כרטיס|כרטיס.{0,12}אשראי|כ\.? ?אשראי|הוראת? ?קבע.{0,20}אשראי/.test(d)) return true;
  return CARD_COMPANIES.test(d) && /חיוב|פירעון|תשלום|בע"?מ|כרטיסי/.test(d);
}

function paymentFor(layout: Layout, description: string, typeText: string): PaymentMethod {
  if (layout.kind === 'card') return 'credit';
  const d = `${description} ${typeText}`;
  if (/שיק|צ'?ק|check|cheque/i.test(d)) return 'check';
  if (/העברה|העב'|bit|ביט|paybox|פייבוקס|משיכה|הפקדה/i.test(d)) return /משיכה|הפקדה/.test(d) ? 'cash' : 'transfer';
  return 'direct';
}

/** כל המילים שבשם, בלי פיסוק, לצורך מפתח יציב. */
export function stableText(s: string): string {
  return cleanText(s as never).toLowerCase().replace(/[^0-9a-zא-ת]+/g, ' ').trim();
}

function get(row: Cell[], col: number | undefined): Cell {
  return col === undefined ? null : (row[col] ?? null);
}

function textAt(row: Cell[], col: number | undefined): string {
  const v = get(row, col);
  return v instanceof Date ? '' : cleanText(v);
}

/** שורות הפעולות של גיליון אחד לפי פריסה. שורות שאינן פעולה (סיכומים, כותרות חוזרות) מדולגות. */
export function parseSheet(sheet: Sheet, layout: Layout): ImportRow[] {
  const out: ImportRow[] = [];
  const seen = new Map<string, number>();
  const { columns } = layout;
  const pendingSheet = /טרם|ממתינ|בהמתנה|pending/i.test(sheet.name);

  for (let i = layout.headerRow + 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]!;
    const date = parseDateCell(get(row, columns.date));
    if (!date) continue;

    const name = textAt(row, columns.description);
    const typeText = textAt(row, columns.type);

    // סכום ומטבע
    let signed: number | null = null;
    let currency: ImportRow['currency'] = 'ILS';
    let foreignNote = '';
    if (columns.debit !== undefined || columns.credit !== undefined) {
      const debit = parseAmountAgorot(get(row, columns.debit));
      const credit = parseAmountAgorot(get(row, columns.credit));
      if (debit && debit !== 0) signed = -Math.abs(debit);
      else if (credit && credit !== 0) signed = Math.abs(credit);
    } else if (columns.amount !== undefined) {
      const charge = parseAmountAgorot(get(row, columns.amount));
      const chargeCur = currencyFromText(textAt(row, columns.currency));
      if (charge !== null && charge !== 0) {
        signed = layout.signedAmount ? charge : -charge; // בכרטיס אשראי סכום חיובי = הוצאה
        if (chargeCur !== undefined) currency = chargeCur;
      }
      if (columns.txnAmount !== undefined) {
        const orig = parseAmountAgorot(get(row, columns.txnAmount));
        const origCur = currencyFromText(textAt(row, columns.txnCurrency));
        if (orig !== null && orig !== 0 && origCur !== undefined && origCur !== currency && origCur !== 'ILS') {
          foreignNote = `מקור: ${(Math.abs(orig) / 100).toFixed(2)} ${textAt(row, columns.txnCurrency)}`;
        }
        if (signed === null && orig !== null && orig !== 0) {
          signed = layout.signedAmount ? orig : -orig;
          if (origCur !== undefined) currency = origCur;
        }
      }
    }
    if (signed === null || signed === 0) continue;
    if (!name && !textAt(row, columns.details)) continue;

    const type: TransactionType = signed < 0 ? 'expense' : 'income';
    const details = [textAt(row, columns.details), foreignNote].filter(Boolean).join(' · ');
    const card = textAt(row, columns.card).replace(/\D/g, '').slice(-4);
    const baseKey = [date, Math.abs(signed), currency ?? '?', stableText(name), card, stableText(textAt(row, columns.reference))].join('|');
    const occurrence = (seen.get(baseKey) ?? 0) + 1;
    seen.set(baseKey, occurrence);

    out.push({
      key: `${baseKey}|${occurrence}`,
      sheet: sheet.name,
      line: i + 1,
      date,
      type,
      amountAgorot: Math.abs(signed),
      currency,
      name,
      details,
      card,
      issuerCategory: textAt(row, columns.category),
      payment: paymentFor(layout, name, typeText),
      cardLumpSum: layout.kind === 'bank' && isCardLumpSum(name),
      pending: pendingSheet || /טרם|ממתינ|בהמתנה/.test(typeText),
      refund: layout.kind === 'card' && type === 'income',
    });
  }
  return out;
}

export interface ParsedSheet {
  sheet: Sheet;
  layout: Layout;
  rows: ImportRow[];
}

/** מזהה פריסה לכל גיליון שנראה כרשימת תנועות ומפרק אותו. גיליונות אחרים מדולגים. */
export function parseWorkbook(sheets: readonly Sheet[]): { parsed: ParsedSheet[]; skipped: string[] } {
  const parsed: ParsedSheet[] = [];
  const skipped: string[] = [];
  for (const sheet of sheets) {
    const layout = detectLayout(sheet.rows);
    if (!layout) {
      skipped.push(sheet.name);
      continue;
    }
    const rows = parseSheet(sheet, layout);
    if (rows.length === 0 && layout.confidence === 'guess') {
      skipped.push(sheet.name);
      continue;
    }
    parsed.push({ sheet, layout, rows });
  }
  return { parsed, skipped };
}

export type { Layout, ColumnRole, Table };
