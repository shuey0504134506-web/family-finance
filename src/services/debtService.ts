import { collection, deleteDoc, doc, setDoc, type Unsubscribe } from 'firebase/firestore';
import { onSnapshot } from '../firebase/cacheFirst';
import { db } from '../firebase/config';
import type { Debt } from '../domain/debt';

/** כל החובות של המשתמש (מעטים), מהחדש לישן. */
export function subscribeDebts(
  uid: string,
  onChange: (debts: Debt[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'debts'),
    (snapshot) => {
      const debts = snapshot.docs.map((d) => ({ ...(d.data() as Debt), id: d.id }));
      debts.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
      onChange(debts);
    },
    onError,
  );
}

export function saveDebt(uid: string, debt: Debt): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'debts', debt.id), debt);
}

export function deleteDebt(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'debts', id));
}
