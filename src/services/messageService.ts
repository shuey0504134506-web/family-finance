import { addDoc, collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * הודעות ממשתמש מחובר למנהל האפליקציה. נשמרות ב-messages (המנהל קורא ועונה דרך פונקציות השרת).
 * תשובת המנהל נשמרת באותה הודעה, וגם קופצת למשתמש כהודעה כשהוא פותח את האפליקציה.
 */
export const MAX_MESSAGE_LENGTH = 2000;

export interface UserMessage {
  id: string;
  text: string;
  createdAt: number;
  reply: string;
  repliedAt: number | null;
}

export async function sendMessageToAdmin(uid: string, text: string): Promise<void> {
  await addDoc(collection(db, 'messages'), {
    uid,
    text: text.trim().slice(0, MAX_MESSAGE_LENGTH),
    createdAt: Date.now(),
  });
}

/** ההודעות שלי ותשובות המנהל, בזמן אמת, מהחדשה לישנה. */
export function subscribeMyMessages(
  uid: string,
  onData: (messages: UserMessage[]) => void,
  onError: () => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'messages'), where('uid', '==', uid)),
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          text: typeof data.text === 'string' ? data.text : '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
          reply: typeof data.reply === 'string' ? data.reply : '',
          repliedAt: typeof data.repliedAt === 'number' ? data.repliedAt : null,
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
    },
    () => onError(),
  );
}
