import { choiceKey, parseChoiceKey, type PaymentChoice } from '../payment';
import { buildTransaction, MAX_COUNTERPARTY_LENGTH, MAX_NOTE_LENGTH } from '../transactionInput';
import type { Transaction } from '../types';
import { learnCategories, suggestCategory, type CategoryOption } from './categorize';
import { importedTransactionId } from './ids';
import { findMatches, type ExistingTx, type Match } from './match';
import type { ImportRow } from './parse';

export interface PlannedRow {
  row: ImportRow;
  /** מזהה המסמך שיישמר */
  id: string;
  match: Match;
  /** הקטגוריה המוצעת, או null אם צריך לשאול */
  suggested: { categoryId: string; source: 'history' | 'issuer' } | null;
}

export interface RowChoice {
  selected: boolean;
  categoryId: string;
  /** מפתח אמצעי תשלום (choiceKey) */
  paymentKey: string;
}

/** משלב כל שורה עם זיהוי הכפילות והצעת הקטגוריה. */
export function planRows(
  rows: readonly ImportRow[],
  spaceKey: string,
  existing: readonly (ExistingTx & { categoryId: string })[],
  categories: readonly CategoryOption[],
): PlannedRow[] {
  const withIds = rows.map((row) => ({ row, id: importedTransactionId(spaceKey, row.key) }));
  const matches = findMatches(
    withIds.map(({ row, id }) => ({ id, type: row.type, amountAgorot: row.amountAgorot, date: row.date, name: row.name, payment: row.payment })),
    existing,
  );
  const learned = learnCategories(existing);
  return withIds.map(({ row, id }, i) => ({
    row,
    id,
    match: matches[i]!,
    suggested: suggestCategory(row, learned, categories),
  }));
}

/** ברירת המחדל: האם לסמן את השורה לייבוא. */
export function defaultSelected(p: PlannedRow): boolean {
  if (p.row.currency === null) return false;
  if (p.row.cardLumpSum || p.row.pending) return false;
  return p.match.level === 'none' || p.match.level === 'possible';
}

export function defaultChoice(p: PlannedRow): RowChoice {
  return {
    selected: defaultSelected(p),
    categoryId: p.suggested?.categoryId ?? '',
    paymentKey: choiceKey({ method: p.row.payment }),
  };
}

/** למה שורה מסומנת אינה מוכנה לשמירה, או null אם היא מוכנה. */
export function rowProblem(p: PlannedRow, choice: RowChoice, categoryIds: ReadonlySet<string>): string | null {
  if (p.row.currency === null) return 'מטבע שאינו נתמך';
  if (!choice.categoryId || !categoryIds.has(choice.categoryId)) return 'חסרה קטגוריה';
  return null;
}

export function noteOf(row: ImportRow): string {
  const parts = [row.details, row.card ? `כרטיס ${row.card}` : '', row.refund ? 'זיכוי' : ''].filter(Boolean);
  return parts.join(' · ').slice(0, MAX_NOTE_LENGTH);
}

/** הופך את השורות המסומנות והמוכנות לפעולות לשמירה. */
export function buildImportTransactions(
  items: readonly { planned: PlannedRow; choice: RowChoice }[],
  context: { categories: readonly CategoryOption[]; now: number; businessId?: string; customLabels?: readonly string[] },
): Transaction[] {
  const names = new Map(context.categories.map((c) => [c.id, c.name]));
  const out: Transaction[] = [];
  for (const { planned, choice } of items) {
    const { row } = planned;
    if (!choice.selected || row.currency === null || !names.has(choice.categoryId)) continue;
    const payment: PaymentChoice = parseChoiceKey(choice.paymentKey);
    const shekels = Math.floor(row.amountAgorot / 100);
    const agorot = String(row.amountAgorot % 100).padStart(2, '0');
    out.push(
      buildTransaction(
        {
          type: row.type,
          amountText: `${shekels}.${agorot}`,
          date: row.date,
          counterparty: row.name.slice(0, MAX_COUNTERPARTY_LENGTH),
          categoryId: choice.categoryId,
          paymentMethod: payment.method,
          paymentLabel: payment.label ?? '',
          note: noteOf(row),
          titheStatus: 'liable',
          isTithePayment: false,
          currency: row.currency,
        },
        { id: planned.id, categoryName: names.get(choice.categoryId)!, now: context.now, businessId: context.businessId },
      ),
    );
  }
  return out;
}
