import { collection, deleteDoc, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Category, Scope, TransactionType } from '../domain/types';
import { newId } from './ids';

/** כל הקטגוריות של המשתמש (עשרות בודדות), ממוינות לפי סדר התצוגה. */
export function subscribeCategories(
  uid: string,
  onChange: (categories: Category[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'categories'),
    (snapshot) => {
      const categories = snapshot.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
      categories.sort((a, b) => a.sortOrder - b.sortOrder);
      onChange(categories);
    },
    onError,
  );
}

export function createCategory(
  uid: string,
  scope: Scope,
  type: TransactionType,
  name: string,
  sortOrder: number,
): { id: string; saved: Promise<void> } {
  const now = Date.now();
  const id = newId();
  const category: Category = {
    id,
    scope,
    type,
    name: name.trim(),
    active: true,
    isDefault: false,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
  return { id, saved: setDoc(doc(db, 'users', uid, 'categories', id), category) };
}

/** שינוי שם או הפעלה/השבתה. קטגוריות לא נמחקות, כדי לא לאבד היסטוריה. */
export function updateCategory(
  uid: string,
  category: Category,
  changes: Partial<Pick<Category, 'name' | 'active'>>,
): Promise<void> {
  const updated: Category = {
    ...category,
    ...changes,
    name: (changes.name ?? category.name).trim(),
    updatedAt: Date.now(),
  };
  return setDoc(doc(db, 'users', uid, 'categories', category.id), updated);
}

/**
 * מחיקת קטגוריה (מההגדרות בלבד). פעולות קיימות שלה שומרות את שם הקטגוריה שנשמר בהן,
 * ולכן ההיסטוריה והסיכומים לא נפגעים. התקציב של הקטגוריה נמחק יחד איתה.
 */
export async function deleteCategory(uid: string, categoryId: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, 'users', uid, 'categories', categoryId)),
    deleteDoc(doc(db, 'users', uid, 'budgets', categoryId)),
  ]);
}
