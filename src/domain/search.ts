import { fuzzyMatchAll } from './fuzzy';
import { formatAgorotNumber } from './money';
import type { Transaction, TransactionType } from './types';

export interface SearchFilters {
  text: string;
  type: 'all' | TransactionType;
}

type SearchableTx = Pick<
  Transaction,
  'type' | 'amountAgorot' | 'date' | 'counterparty' | 'categoryName' | 'note' | 'createdAt'
>;

/** מנרמל להשוואה: רווחים מיותרים, אותיות לועזיות קטנות. עברית אינה מושפעת. */
function normalize(text: string): string {
  return text.trim().toLocaleLowerCase('he').replace(/\s+/g, ' ');
}

/**
 * חיפוש חופשי בפעולות: שם הספק/הלקוח, קטגוריה, הערה, סכום ותאריך.
 * כל מילה בחיפוש חייבת להופיע באחד השדות (AND בין מילים).
 * סכום מותאם גם בלי פסיקים ובלי אגורות עגולות: "1250" מוצא 1,250.00.
 */
export function searchTransactions<T extends SearchableTx>(
  transactions: readonly T[],
  filters: SearchFilters,
): T[] {
  const words = normalize(filters.text).split(' ').filter(Boolean);
  const haystackOf = (t: T): string => {
    const fullAmount = formatAgorotNumber(t.amountAgorot);
    return normalize(
      [
        t.counterparty,
        t.categoryName,
        t.note,
        fullAmount,
        fullAmount.replace(/,/g, ''),
        t.amountAgorot % 100 === 0 ? String(t.amountAgorot / 100) : '',
        t.date,
        `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}/${t.date.slice(0, 4)}`,
      ].join(' '),
    );
  };
  const byType = transactions.filter((t) => filters.type === 'all' || t.type === filters.type);
  let matches = byType.filter((t) => {
    if (words.length === 0) return true;
    const haystack = haystackOf(t);
    return words.every((word) => haystack.includes(word));
  });
  // אין התאמה מדויקת: מחפשים בקירוב (טעות כתיב), על שם, קטגוריה והערה בלבד
  if (matches.length === 0 && words.length > 0) {
    const text = filters.text;
    matches = byType.filter((t) => fuzzyMatchAll([t.counterparty, t.categoryName, t.note].join(' '), text));
  }
  // החדש ביותר קודם. באותו תאריך: האחרון שנוסף.
  return [...matches].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
}
