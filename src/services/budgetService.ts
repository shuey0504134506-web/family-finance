import { collection, deleteDoc, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { budgetDocId } from '../domain/budget';
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

/**
 * מזהה המסמך הוא מזהה הקטגוריה (תקציב קבוע) או `${מזהה}@${תקופה}` (חודש או שנה),
 * ולכן לכל קטגוריה יש לכל היותר תקציב אחד בכל תקופה.
 */
export function saveBudget(
  uid: string,
  scope: Scope,
  categoryId: string,
  amountAgorot: number,
  existingCreatedAt?: number,
  businessId?: string,
  period?: string,
): Promise<void> {
  const now = Date.now();
  const docId = budgetDocId(categoryId, period);
  const budget: Budget = {
    id: docId,
    scope,
    categoryId,
    amountAgorot,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
    ...(period ? { period } : {}),
    ...(scope === 'business' && businessId && businessId !== DEFAULT_BUSINESS_ID ? { businessId } : {}),
  };
  return setDoc(doc(db, 'users', uid, 'budgets', docId), budget);
}

export function deleteBudget(uid: string, categoryId: string, period?: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'budgets', budgetDocId(categoryId, period)));
}
