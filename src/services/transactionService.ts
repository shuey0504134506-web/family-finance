import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { monthDateRange, type YearMonth } from '../domain/dates';
import type { Scope, Transaction, TransactionRecord } from '../domain/types';

/** שם האוסף לפי תחום. עסק ומשק בית נשמרים באוספים נפרדים לגמרי. */
export function transactionsCollectionName(scope: Scope): string {
  return scope === 'business' ? 'businessTransactions' : 'householdTransactions';
}

export function transactionsCollection(uid: string, scope: Scope) {
  return collection(db, 'users', uid, transactionsCollectionName(scope));
}

/**
 * מאזין בזמן אמת לפעולות של חודש אחד, מהחדשה לישנה.
 *
 * השאילתה היא טווח על שדה אחד (date), ולכן לא נדרש אינדקס מורכב, והיא טוענת
 * רק את החודש המבוקש ולא את כל ההיסטוריה.
 *
 * includeMetadataChanges נדרש כדי לקבל גם את המעבר "ממתין לסנכרון" -> "סונכרן".
 */
export function subscribeMonthTransactions(
  uid: string,
  scope: Scope,
  yearMonth: YearMonth,
  onChange: (records: TransactionRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { start, end } = monthDateRange(yearMonth);
  const q = query(
    transactionsCollection(uid, scope),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'desc'),
  );

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const records = snapshot.docs.map((document) => ({
        ...(document.data() as Transaction),
        id: document.id,
        pendingSync: document.metadata.hasPendingWrites,
      }));
      // באותו תאריך: החדשה שנוספה אחרונה מופיעה ראשונה.
      records.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : 0));
      onChange(records);
    },
    onError,
  );
}
