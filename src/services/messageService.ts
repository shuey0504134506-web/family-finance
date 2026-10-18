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
  /** נשמרה במכשיר וממתינה לחיבור כדי להישלח */
  pending: boolean;
}

/** כמה זמן ממתינים לאישור השרת לפני שמודיעים שההודעה נשמרה ותישלח כשיהיה חיבור. */
const QUEUE_AFTER_MS = 3500;

/**
 * שולח הודעה. Firestore שומר כתיבה שלא הגיעה לשרת בזיכרון המכשיר (גם אחרי סגירת האפליקציה)
 * ושולח אותה אוטומטית כשהחיבור חוזר, ולכן בלי רשת לא תקועים: אחרי רגע מחזירים 'queued'.
 */
export async function sendMessageToAdmin(
  uid: string,
  email: string | null,
  text: string,
): Promise<'sent' | 'queued'> {
  const write = addDoc(collection(db, 'messages'), {
    uid,
    ...(email ? { email } : {}),
    text: text.trim().slice(0, MAX_MESSAGE_LENGTH),
    createdAt: Date.now(),
  }).then(() => 'sent' as const);
  // אם הכתיבה תיכשל מאוחר יותר (למשל חסימה בשרת) אין למי לדווח; לא משאירים שגיאה לא מטופלת
  write.catch(() => undefined);
  const queued = new Promise<'queued'>((resolve) => window.setTimeout(() => resolve('queued'), QUEUE_AFTER_MS));
  return Promise.race([write, queued]);
}

/** ההודעות שלי ותשובות המנהל, בזמן אמת, מהחדשה לישנה. */
export function subscribeMyMessages(
  uid: string,
  onData: (messages: UserMessage[]) => void,
  onError: () => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'messages'), where('uid', '==', uid)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          text: typeof data.text === 'string' ? data.text : '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
          reply: typeof data.reply === 'string' ? data.reply : '',
          repliedAt: typeof data.repliedAt === 'number' ? data.repliedAt : null,
          pending: d.metadata.hasPendingWrites,
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
    },
    () => onError(),
  );
}
