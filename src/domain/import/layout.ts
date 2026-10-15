import { cleanText, parseAmountAgorot, parseDateCell } from './values';
import type { Table } from './text';

/** התפקידים שעמודה בקובץ יכולה למלא. */
export type ColumnRole =
  | 'date'
  | 'chargeDate'
  | 'description'
  | 'details'
  | 'amount' // סכום בודד (חיוב בשקלים, או סכום עם סימן)
  | 'txnAmount' // סכום העסקה המקורי (כשיש גם סכום חיוב)
  | 'debit'
  | 'credit'
  | 'currency' // מטבע החיוב
  | 'txnCurrency'
  | 'card'
  | 'category'
  | 'type'
  | 'reference'
  | 'installments'
  | 'balance';

export const ROLE_LABELS: Record<ColumnRole, string> = {
  date: 'תאריך העסקה',
  chargeDate: 'תאריך חיוב',
  description: 'שם בית העסק / תיאור',
  details: 'פרטים נוספים',
  amount: 'סכום',
  txnAmount: 'סכום עסקה מקורי',
  debit: 'חובה (הוצאה)',
  credit: 'זכות (הכנסה)',
  currency: 'מטבע החיוב',
  txnCurrency: 'מטבע העסקה',
  card: 'כרטיס (4 ספרות)',
  category: 'קטגוריה של חברת האשראי',
  type: 'סוג עסקה',
  reference: 'אסמכתא / שובר',
  installments: 'תשלומים',
  balance: 'יתרה',
};

export interface Layout {
  /** אינדקס שורת הכותרות. -1 = אין כותרות (ניחוש לפי התוכן). */
  headerRow: number;
  columns: Partial<Record<ColumnRole, number>>;
  /** האם הסכום בעמודה אחת עם סימן (מינוס = הוצאה), בניגוד לחובה/זכות נפרדות. */
  signedAmount: boolean;
  kind: 'card' | 'bank';
  /** 'high' = כותרות מוכרות; 'guess' = נוחש לפי תוכן העמודות, ויש לבקש מהמשתמש לאשר. */
  confidence: 'high' | 'guess';
}

/** משאיר אותיות ומספרים בלבד. */
export function norm(s: string): string {
  return cleanText(s)
    .toLowerCase()
    .replace(/[^0-9a-zא-ת]/g, '');
}

/**
 * הכותרות הידועות. הסדר חשוב: הכלל הראשון שמתאים קובע, ולכל תפקיד נבחרת העמודה השמאלית ביותר... הראשונה בקובץ.
 * הכותרות נאספו מתיעוד פומבי ומהניסיון המוכר של פורמטי הייצוא, ומתעדכנות כשמגיע קובץ אמיתי חדש.
 */
const HEADER_RULES: [ColumnRole, RegExp][] = [
  ['chargeDate', /^(תאריך|מועד|יום)החיוב|^תאריךחיוב/],
  ['date', /^(יום|תאריך)(ה)?(עסקה|רכישה|פעולה)?$|^מועדהעסקה|^date$|^תאריךוזמן/],
  ['description', /^(שם)?ביתה?עסק|^תיאור(ה)?(פעולה|תנועה)?$|^פעולה$|^שםהעסק|^בעלהעסק|^לטובת|^מוטב|^description/],
  ['details', /^(פרטים|פירוטנוסף|הערות|פירוט|פרטיהפעולה|מידענוסף)$/],
  ['txnAmount', /^סכוםעסקה|^סכוםמקורי|^סכוםהעסקה/],
  ['amount', /^(סכום)?(ה)?חיוב(בשח|בש|₪)?$|^סכוםחיוב|^סכוםה?חיוב|^סכום(בשח|הפעולה)?$|^שח$|^amount$|^זכותחובה$|^חובהזכות$/],
  ['debit', /^(ב)?חובה(בשח)?$/],
  ['credit', /^(ב)?זכות(בשח)?$|^זיכוי$/],
  ['currency', /^מטבעחיוב|^מטבעהחיוב/],
  ['txnCurrency', /^מטבע(עסקה)?(מקורי)?$|^מטבעעסקה/],
  ['card', /ספרותאחרונות|^(מספר)?כרטיס|^כרטיס/],
  ['category', /^(קטגוריה|ענף|סיווג)/],
  ['type', /^סוג(ה)?(עסקה|פעולה)/],
  ['reference', /^(אסמכת|מסשובר|מספרשובר|שובר|מסאסמכתא)/],
  ['installments', /^(מספר)?תשלומים|^פירוטתשלומים/],
  ['balance', /^(ה)?יתרה/],
];

function roleOfHeader(text: string): ColumnRole | null {
  const n = norm(text);
  if (!n) return null;
  for (const [role, re] of HEADER_RULES) if (re.test(n)) return role;
  return null;
}

/** "זכות/חובה" בעמודה אחת = סכום עם סימן (בדיסקונט). */
function isSignedHeader(text: string): boolean {
  return /^(זכותחובה|חובהזכות)$/.test(norm(text));
}

function buildFromHeader(row: Table[number]): { columns: Partial<Record<ColumnRole, number>>; signed: boolean } {
  const columns: Partial<Record<ColumnRole, number>> = {};
  let signed = false;
  row.forEach((cell, index) => {
    const text = cleanText(cell as never);
    const role = roleOfHeader(text);
    if (!role || columns[role] !== undefined) return;
    columns[role] = index;
    if (role === 'amount' && isSignedHeader(text)) signed = true;
  });
  return { columns, signed };
}

function isLayoutUsable(columns: Partial<Record<ColumnRole, number>>): boolean {
  const hasDate = columns.date !== undefined;
  const hasMoney = columns.amount !== undefined || columns.txnAmount !== undefined || columns.debit !== undefined || columns.credit !== undefined;
  return hasDate && hasMoney;
}

/** מוצא את שורת הכותרות ואת תפקידי העמודות. מחזיר null אם הגיליון אינו נראה כרשימת תנועות. */
export function detectLayout(rows: Table): Layout | null {
  let best: { index: number; columns: Partial<Record<ColumnRole, number>>; signed: boolean; score: number } | null = null;
  const limit = Math.min(rows.length, 60);
  for (let i = 0; i < limit; i++) {
    const { columns, signed } = buildFromHeader(rows[i]!);
    const score = Object.keys(columns).length;
    if (isLayoutUsable(columns) && (!best || score > best.score)) best = { index: i, columns, signed, score };
  }
  if (best) return finalize(best.index, best.columns, best.signed, 'high');
  return guessLayout(rows);
}

function finalize(headerRow: number, columns: Partial<Record<ColumnRole, number>>, signed: boolean, confidence: Layout['confidence']): Layout {
  const cols = { ...columns };
  // כשיש רק "סכום עסקה" בלי סכום חיוב, זה הסכום.
  if (cols.amount === undefined && cols.debit === undefined && cols.credit === undefined && cols.txnAmount !== undefined) {
    cols.amount = cols.txnAmount;
    delete cols.txnAmount;
  }
  const kind: Layout['kind'] = cols.debit !== undefined || cols.credit !== undefined || cols.balance !== undefined ? 'bank' : 'card';
  // בדף בנק עמודת סכום בודדת היא תמיד עם סימן (מינוס = הוצאה)
  return { headerRow, columns: cols, signedAmount: signed || (kind === 'bank' && cols.amount !== undefined), kind, confidence };
}

/** בלי כותרות מוכרות: מנחשים עמודת תאריכים, עמודת סכום ועמודת טקסט לפי התוכן. */
function guessLayout(rows: Table): Layout | null {
  const sample = rows.slice(0, 200);
  const width = Math.max(0, ...sample.map((r) => r.length));
  if (width < 3 || sample.length < 3) return null;
  const stats = Array.from({ length: width }, (_, c) => {
    let dates = 0;
    let numbers = 0;
    let texts = 0;
    let textLength = 0;
    let filled = 0;
    for (const r of sample) {
      const v = r[c];
      if (v === null || v === undefined || cleanText(v as never) === '') continue;
      filled++;
      if (parseDateCell(v as never)) dates++;
      else if (parseAmountAgorot(v as never) !== null) numbers++;
      else {
        texts++;
        textLength += cleanText(v as never).length;
      }
    }
    return { dates, numbers, texts, avgText: texts ? textLength / texts : 0, filled };
  });
  const dateCol = stats.reduce((best, s, i) => (s.dates > (stats[best]?.dates ?? -1) ? i : best), 0);
  if ((stats[dateCol]?.dates ?? 0) < 3) return null;
  const numeric = stats.map((s, i) => ({ s, i })).filter(({ s, i }) => i !== dateCol && s.numbers >= 3 && s.numbers >= s.filled * 0.6);
  const textCols = stats.map((s, i) => ({ s, i })).filter(({ s, i }) => i !== dateCol && s.texts >= 3 && s.texts >= s.filled * 0.6);
  if (!numeric.length || !textCols.length) return null;
  const text = textCols.reduce((a, b) => (b.s.avgText > a.s.avgText ? b : a));
  const amount = numeric[0]!;
  return {
    headerRow: -1,
    columns: { date: dateCol, description: text.i, amount: amount.i },
    signedAmount: true,
    kind: 'bank',
    confidence: 'guess',
  };
}

/** בונה פריסה מחדש לפי בחירת המשתמש (תפקיד -> אינדקס עמודה, או -1 להסרה). */
export function withColumn(layout: Layout, role: ColumnRole, index: number): Layout {
  const columns = { ...layout.columns };
  if (index < 0) delete columns[role];
  else columns[role] = index;
  const next = { ...layout, columns, confidence: 'high' as const };
  next.kind = columns.debit !== undefined || columns.credit !== undefined || columns.balance !== undefined ? 'bank' : 'card';
  if (role === 'debit' || role === 'credit') next.signedAmount = false;
  return next;
}
