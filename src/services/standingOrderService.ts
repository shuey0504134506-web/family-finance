import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { onSnapshot } from '../firebase/cacheFirst';
import { db } from '../firebase/config';
import { dueDatesUpTo, firstDueDate, nextDueAfter, transactionFromOrder } from '../domain/standingOrder';
import { monthDateRange, yearMonthOfDate, type IsoDate } from '../domain/dates';
import type { Scope, StandingOrder, Transaction } from '../domain/types';
import { transactionsCollection } from './transactionService';

const ordersCollection = (uid: string) => collection(db, 'users', uid, 'standingOrders');

/** כל הוראות הקבע של המשתמש (מעטות), לפי שם. */
export function subscribeStandingOrders(
  uid: string,
  onChange: (orders: StandingOrder[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    ordersCollection(uid),
    (snapshot) => {
      const orders = snapshot.docs.map((d) => ({ ...(d.data() as StandingOrder), id: d.id }));
      orders.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      onChange(orders);
    },
    onError,
  );
}

export function saveStandingOrder(uid: string, order: StandingOrder): Promise<void> {
  return setDoc(doc(ordersCollection(uid), order.id), order);
}

/** מחיקת ההוראה. הפעולות שכבר נוצרו נשארות כפעולות רגילות (הקישור להוראה נשאר ריק). */
export function deleteStandingOrder(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(ordersCollection(uid), id));
}

/** פעולות מאוחרות מחודש מסוים (לא כולל), לחיפוש פעולות דומות להוראה חדשה. */
export async function loadTransactionsAfter(uid: string, scope: Scope, date: IsoDate): Promise<Transaction[]> {
  const { end } = monthDateRange(yearMonthOfDate(date));
  const snapshot = await getDocs(query(transactionsCollection(uid, scope), where('date', '>', end)));
  return snapshot.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id }));
}

/**
 * מקשר פעולות קיימות להוראה, ונותן לכולן את שם הוראת הקבע והקטגוריה שלה.
 * ההוראה נשמרת באותה קבוצה כדי שהחיבור יהיה עקבי גם אם נקטע באמצע.
 */
export function linkTransactionsToOrder(
  uid: string,
  scope: Scope,
  transactions: readonly Transaction[],
  order: StandingOrder,
  now: number,
): Promise<void> {
  const batch = writeBatch(db);
  for (const t of transactions) {
    batch.set(doc(transactionsCollection(uid, scope), t.id), {
      ...t,
      counterparty: order.name,
      categoryId: order.categoryId,
      categoryName: order.categoryName,
      standingOrderId: order.id,
      updatedAt: now,
    });
  }
  batch.set(doc(ordersCollection(uid), order.id), order);
  return batch.commit();
}

/** נבחרה סדרה קיימת: ההוראה ממשיכה מהחיוב שאחרי האחרונה בסדרה. */
export function orderContinuingAfter(order: StandingOrder, lastDate: IsoDate, today: IsoDate, now: number): StandingOrder {
  return { ...order, nextDue: firstDueDate(order.dayOfMonth, lastDate, today), updatedAt: now };
}

/**
 * יוצר את כל הפעולות שהגיע זמנן ומקדם את תאריך החיוב הבא, בכתיבה אחת.
 * מזהי הפעולות קבועים (הוראה + תאריך), ולכן מכשיר נוסף שמריץ את אותו חיוב לא יוצר כפילות.
 * מחזיר כמה פעולות נוצרו.
 */
export async function runDueOrders(uid: string, orders: readonly StandingOrder[], today: IsoDate, now: number): Promise<number> {
  let created = 0;
  for (const order of orders) {
    const dates = dueDatesUpTo(order, today);
    if (dates.length === 0) continue;
    const batch = writeBatch(db);
    for (const date of dates) {
      const tx = transactionFromOrder(order, date, now);
      batch.set(doc(transactionsCollection(uid, order.scope), tx.id), tx);
    }
    // אם נותרו חיובים שעוד לא נוצרו (תקרת ההשלמה), הם ייווצרו בהרצה הבאה
    const last = dates[dates.length - 1];
    batch.set(doc(ordersCollection(uid), order.id), { ...order, nextDue: nextDueAfter(order.dayOfMonth, last), updatedAt: now });
    await batch.commit();
    created += dates.length;
  }
  return created;
}

/** כל הפעולות של הוראת קבע אחת, בזמן אמת. */
export function subscribeOrderTransactions(
  uid: string,
  scope: Scope,
  orderId: string,
  onChange: (transactions: Transaction[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(transactionsCollection(uid, scope), where('standingOrderId', '==', orderId)),
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id }));
      list.sort((a, b) => (a.date < b.date ? 1 : -1));
      onChange(list);
    },
    onError,
  );
}

/** הפעולות מתאריך מסוים והלאה, לזיהוי פעולות שחוזרות על עצמן. */
export function subscribeTransactionsSince(
  uid: string,
  scope: Scope,
  startDate: IsoDate,
  onChange: (transactions: Transaction[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(transactionsCollection(uid, scope), where('date', '>=', startDate)),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id }))),
    onError,
  );
}
