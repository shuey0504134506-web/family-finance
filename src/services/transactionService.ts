import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
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

/**
 * שומר פעולה (חדשה או קיימת) תחת מזהה קבוע. כתיבה חוזרת לאותו מזהה אינה יוצרת כפילות.
 *
 * ההבטחה מתממשת רק כשהשרת מאשר. בלי אינטרנט הפעולה נשמרת במכשיר ומסונכרנת מאוחר יותר,
 * ולכן הקוד הקורא אינו ממתין לתוצאה כדי להמשיך, אלא מדווח על כישלון אם הוא מגיע.
 */
export function saveTransaction(uid: string, scope: Scope, transaction: Transaction): Promise<void> {
  return setDoc(doc(transactionsCollection(uid, scope), transaction.id), transaction);
}

export function deleteTransaction(uid: string, scope: Scope, id: string): Promise<void> {
  return deleteDoc(doc(transactionsCollection(uid, scope), id));
}

/** פעולה בודדת לעריכה. עובד גם בלי חיבור, מתוך המטמון המקומי. */
export async function getTransaction(
  uid: string,
  scope: Scope,
  id: string,
): Promise<Transaction | null> {
  const snapshot = await getDoc(doc(transactionsCollection(uid, scope), id));
  return snapshot.exists() ? { ...(snapshot.data() as Transaction), id: snapshot.id } : null;
}
