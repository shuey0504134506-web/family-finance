import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { cleanAttachments } from '../domain/attachment';

const ref = (uid: string, transactionId: string) => doc(db, 'users', uid, 'attachments', transactionId);

/** התמונות של פעולה (קבלה, תלוש). רשימה ריקה אם אין. עובד גם בלי חיבור, מתוך המטמון. */
export async function getAttachments(uid: string, transactionId: string): Promise<string[]> {
  const snapshot = await getDoc(ref(uid, transactionId));
  return cleanAttachments((snapshot.data() as { images?: unknown } | undefined)?.images);
}

/** שומר את התמונות של פעולה. רשימה ריקה מוחקת את המסמך. */
export function saveAttachments(uid: string, transactionId: string, images: string[]): Promise<void> {
  if (images.length === 0) return deleteDoc(ref(uid, transactionId));
  return setDoc(ref(uid, transactionId), { images, updatedAt: Date.now() });
}

export function deleteAttachments(uid: string, transactionId: string): Promise<void> {
  return deleteDoc(ref(uid, transactionId));
}
