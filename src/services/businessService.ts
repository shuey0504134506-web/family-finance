import { collection, doc, onSnapshot, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { buildBusinessCategories } from '../data/defaultCategories';
import type { Business } from '../domain/spaces';
import { newId } from './ids';

/** כל העסקים של המשתמש (מעטים), ממוינים לפי סדר התצוגה. */
export function subscribeBusinesses(
  uid: string,
  onChange: (businesses: Business[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'businesses'),
    (snapshot) => {
      const businesses = snapshot.docs.map((d) => ({ ...(d.data() as Business), id: d.id }));
      businesses.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
      onChange(businesses);
    },
    onError,
  );
}

/** שמירת עסק (שינוי שם, או יצירת מסמך לעסק הראשון הישן). */
export function saveBusiness(uid: string, business: Business): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'businesses', business.id), {
    id: business.id,
    name: business.name.trim(),
    sortOrder: business.sortOrder,
    createdAt: business.createdAt,
    updatedAt: Date.now(),
  });
}

/**
 * מוסיף עסק חדש יחד עם קטגוריות ברירת המחדל שלו, בכתיבה אחת (הכול או כלום).
 * לכל עסק קטגוריות ותקציב משלו.
 */
export function addBusiness(uid: string, name: string, sortOrder: number): { id: string; saved: Promise<void> } {
  const now = Date.now();
  const id = newId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'businesses', id), {
    id,
    name: name.trim(),
    sortOrder,
    createdAt: now,
    updatedAt: now,
  });
  for (const category of buildBusinessCategories(now, id)) {
    batch.set(doc(db, 'users', uid, 'categories', category.id), category);
  }
  return { id, saved: batch.commit() };
}

// ---------- שם משק הבית ----------

export function subscribeHouseholdName(
  uid: string,
  onChange: (name: string | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'householdProfile', 'main'),
    (snapshot) => {
      const name = snapshot.exists() ? (snapshot.data() as { name?: unknown }).name : null;
      onChange(typeof name === 'string' && name.trim() ? name : null);
    },
    onError,
  );
}

export function saveHouseholdName(uid: string, name: string, createdAt: number): Promise<void> {
  return setDoc(doc(db, 'users', uid, 'householdProfile', 'main'), {
    name: name.trim(),
    createdAt,
    updatedAt: Date.now(),
  });
}
