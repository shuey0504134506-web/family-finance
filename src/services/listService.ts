import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ShoppingItem, Task } from '../domain/tasks';

const tasksCollection = (uid: string) => collection(db, 'users', uid, 'tasks');
const itemsCollection = (uid: string) => collection(db, 'users', uid, 'shoppingItems');

/** שתי הרשימות (עסק ומשק בית) נטענות יחד. הן קטנות, והסינון לפי תחום נעשה במכשיר. */
function subscribe<T>(
  ref: ReturnType<typeof collection>,
  onChange: (items: T[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    ref,
    (snapshot) => onChange(snapshot.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)),
    onError,
  );
}

export const subscribeTasks = (uid: string, onChange: (t: Task[]) => void, onError: (e: Error) => void) =>
  subscribe<Task>(tasksCollection(uid), onChange, onError);

export const subscribeShoppingItems = (uid: string, onChange: (i: ShoppingItem[]) => void, onError: (e: Error) => void) =>
  subscribe<ShoppingItem>(itemsCollection(uid), onChange, onError);

export const saveTask = (uid: string, task: Task): Promise<void> => setDoc(doc(tasksCollection(uid), task.id), task);
export const deleteTask = (uid: string, id: string): Promise<void> => deleteDoc(doc(tasksCollection(uid), id));

export const saveShoppingItem = (uid: string, item: ShoppingItem): Promise<void> =>
  setDoc(doc(itemsCollection(uid), item.id), item);
export const deleteShoppingItem = (uid: string, id: string): Promise<void> => deleteDoc(doc(itemsCollection(uid), id));

/** מוחק את כל הפריטים שנקנו בתחום אחד. */
export async function deleteBoughtItems(uid: string, ids: readonly string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(itemsCollection(uid), id)));
  await batch.commit();
}
