import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, deleteDoc, doc, setDoc, type Unsubscribe } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { onSnapshot } from '../firebase/cacheFirst';
import { app, db } from '../firebase/config';
import { MAX_CHAT_MESSAGES, MAX_RECENT_QUESTIONS, type AiChat, type AiMessage, type RecentQuestion } from '../domain/aiChats';

export { MAX_RECENT_QUESTIONS, MAX_SAVED_CHATS, chatToEvict, withRecentQuestion } from '../domain/aiChats';
export type { AiChat, AiMessage, RecentQuestion } from '../domain/aiChats';

/** סקירת AI זמינה רק באתר ובאפליקציית האנדרואיד המקוונת (לא בתוכנת המחשב ולא בגרסה הלא מקוונת, שאין להן חיבור לשרת). */
export const AI_SUPPORTED = typeof window !== 'undefined' && !(window as { desktopUpdate?: unknown }).desktopUpdate && import.meta.env.VITE_TARGET !== 'phone';

const functions = () => getFunctions(app, 'europe-west1');

export interface AiAnswer {
  answer: string;
  remaining: number;
  limit: number;
}

/** שאלה למודל. ההגבלות (גישה, מכסה, נושא) נאכפות בשרת. */
export async function askAi(question: string, summary: unknown, history: readonly AiMessage[]): Promise<AiAnswer> {
  const call = httpsCallable<unknown, AiAnswer>(functions(), 'aiAsk', { timeout: 175_000 });
  return (await call({ question, summary: JSON.stringify(summary), history: history.slice(-6) })).data;
}

export async function loadAiQuota(): Promise<{ remaining: number; limit: number }> {
  const call = httpsCallable<void, { remaining: number; limit: number }>(functions(), 'aiQuota');
  return (await call()).data;
}

/** הודעת שגיאה בעברית מתוך תשובת השרת. */
export function describeAiError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const known = ['functions/permission-denied', 'functions/resource-exhausted', 'functions/failed-precondition', 'functions/unavailable', 'functions/invalid-argument'];
  if (e?.code && known.includes(e.code) && e.message) return e.message;
  if (e?.code === 'functions/deadline-exceeded') return 'התשובה לקחה יותר מדי זמן. אפשר לנסות שוב, או לשאול שאלה ממוקדת יותר.';
  return 'לא הצלחנו לקבל תשובה. יש לבדוק את החיבור ולנסות שוב.';
}

/** האם יש למשתמש גישת AI (נקבעת ע"י המנהל). */
export function useAiAccess(uid: string): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!AI_SUPPORTED) return undefined;
    return onSnapshot(
      doc(db, 'aiAccess', uid),
      (snap) => setAllowed(snap.exists() && snap.data()?.enabled === true),
      () => setAllowed(false),
    );
  }, [uid]);
  return allowed;
}

const chatsCollection = (uid: string) => collection(db, 'users', uid, 'aiChats');

export function subscribeAiChats(uid: string, onChange: (chats: AiChat[]) => void, onError: () => void): Unsubscribe {
  return onSnapshot(
    chatsCollection(uid),
    (snap) => {
      const chats = snap.docs.map((d) => ({ ...(d.data() as AiChat), id: d.id }));
      chats.sort((a, b) => b.updatedAt - a.updatedAt);
      onChange(chats);
    },
    () => onError(),
  );
}

export function saveAiChat(uid: string, chat: AiChat): Promise<void> {
  return setDoc(doc(chatsCollection(uid), chat.id), { ...chat, messages: chat.messages.slice(-MAX_CHAT_MESSAGES) });
}

export function deleteAiChat(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(chatsCollection(uid), id));
}

const recentDoc = (uid: string) => doc(db, 'users', uid, 'aiMeta', 'recent');

export function subscribeRecentQuestions(uid: string, onChange: (items: RecentQuestion[]) => void, onError: () => void): Unsubscribe {
  return onSnapshot(
    recentDoc(uid),
    (snap) => {
      const items = snap.exists() ? (snap.data().items as unknown) : [];
      onChange(Array.isArray(items) ? (items as RecentQuestion[]).filter((i) => typeof i?.q === 'string') : []);
    },
    () => onError(),
  );
}

export function saveRecentQuestions(uid: string, items: RecentQuestion[]): Promise<void> {
  return setDoc(recentDoc(uid), { items: items.slice(0, MAX_RECENT_QUESTIONS), updatedAt: Date.now() });
}
