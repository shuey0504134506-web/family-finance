import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Category } from '../domain/types';

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
