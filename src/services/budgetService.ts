import { collection, deleteDoc, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { DEFAULT_BUSINESS_ID } from '../domain/spaces';
import type { Budget, Scope } from '../domain/types';

export function subscribeBudgets(
  uid: string,
  onChange: (budgets: Budget[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'budgets'),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ ...(d.data() as Budget), id: d.id }))),
    onError,
  );
}

/** מזהה המסמך הוא מזהה הקטגוריה, ולכן יש לכל קטגוריה לכל היותר תקציב אחד. */
export function saveBudget(
  uid: string,
  scope: Scope,
  categoryId: string,
  amountAgorot: number,
  existingCreatedAt?: number,
  businessId?: string,
): Promise<void> {
  const now = Date.now();
  const budget: Budget = {
    id: categoryId,
    scope,
    categoryId,
    amountAgorot,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
    ...(scope === 'business' && businessId && businessId !== DEFAULT_BUSINESS_ID ? { businessId } : {}),
  };
  return setDoc(doc(db, 'users', uid, 'budgets', categoryId), budget);
}

export function deleteBudget(uid: string, categoryId: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'budgets', categoryId));
}
