import { useSyncExternalStore } from "react";
import { newId } from "../../services/ids";
import {
  askAi,
  chatToEvict,
  deleteAiChat,
  describeAiError,
  loadAiQuota,
  saveAiChat,
  saveRecentQuestions,
  withRecentQuestion,
  type AiChat,
  type AiMessage,
  type RecentQuestion,
} from "../../services/aiService";

/**
 * השיחה הנוכחית עם ה-AI. היא חיה מחוץ למסך, ולכן יציאה מהמסך (לבית, להיסטוריה) לא עוצרת שאלה שבדרך:
 * התשובה מגיעה ונשמרת, וכשחוזרים היא כבר שם.
 */
export interface AiSessionState {
  uid: string;
  chatId: string;
  createdAt: number;
  messages: AiMessage[];
  busy: boolean;
  /** מתי נשלחה השאלה שממתינה לתשובה */
  startedAt: number | null;
  error: string;
  /** שאלה שנכשלה: מוחזרת לשורת הכתיבה */
  failedDraft: string;
  quota: { remaining: number; limit: number } | null;
  /** יש תשובה חדשה שעוד לא נראתה (כשהמשתמש יצא מהמסך באמצע) */
  unread: boolean;
}

let state: AiSessionState | null = null;
const listeners = new Set<() => void>();

function set(next: AiSessionState): void {
  state = next;
  listeners.forEach((l) => l());
}

const empty = (uid: string): AiSessionState => ({
  uid,
  chatId: newId(),
  createdAt: Date.now(),
  messages: [],
  busy: false,
  startedAt: null,
  error: "",
  failedDraft: "",
  quota: null,
  unread: false,
});

/** מחזיר את השיחה של המשתמש (ויוצר חדשה למשתמש אחר). */
export function currentSession(uid: string): AiSessionState {
  if (!state || state.uid !== uid) set(empty(uid));
  return state as AiSessionState;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAiSession(uid: string): AiSessionState {
  useSyncExternalStore(subscribe, () => state);
  return currentSession(uid);
}

/** האם יש שאלה בדרך או תשובה שלא נראתה (לחיווי על כפתור הכניסה). */
export function useAiActivity(uid: string): "busy" | "unread" | null {
  const s = useSyncExternalStore(subscribe, () => state);
  if (!s || s.uid !== uid) return null;
  return s.busy ? "busy" : s.unread ? "unread" : null;
}

export function markSeen(uid: string): void {
  const s = currentSession(uid);
  if (s.unread) set({ ...s, unread: false });
}

export function setQuota(
  uid: string,
  quota: { remaining: number; limit: number } | null,
): void {
  set({ ...currentSession(uid), quota });
}

/** מחזיר את השאלה שנכשלה (פעם אחת) כדי להחזיר אותה לשורת הכתיבה. */
export function takeFailedDraft(uid: string): string {
  const s = currentSession(uid);
  if (!s.failedDraft) return "";
  set({ ...s, failedDraft: "" });
  return s.failedDraft;
}

export function setError(uid: string, error: string): void {
  set({ ...currentSession(uid), error });
}

export function startNewChat(uid: string): void {
  const s = currentSession(uid);
  set({ ...empty(uid), quota: s.quota });
}

/** פותח שיחה שמורה. שאלה שעוד בדרך בשיחה אחרת תסתיים ותישמר שם. */
export function openChat(uid: string, chat: AiChat): void {
  const s = currentSession(uid);
  if (s.chatId === chat.id) return;
  set({
    ...empty(uid),
    chatId: chat.id,
    createdAt: chat.createdAt,
    messages: chat.messages,
    quota: s.quota,
  });
}

export interface AskContext {
  saved: readonly AiChat[];
  recent: readonly RecentQuestion[];
}

export function askInSession(
  uid: string,
  question: string,
  build: (question: string) => unknown,
  ctx: AskContext,
): void {
  const s = currentSession(uid);
  const q = question.trim();
  if (!q || s.busy) return;
  const { chatId, createdAt } = s;
  const before = s.messages;
  const withQuestion: AiMessage[] = [...before, { role: "user", text: q }];
  set({
    ...s,
    messages: withQuestion,
    busy: true,
    startedAt: Date.now(),
    error: "",
    failedDraft: "",
    unread: false,
  });

  const stillHere = () =>
    state !== null && state.uid === uid && state.chatId === chatId;
  void (async () => {
    try {
      const result = await askAi(q, build(q), before);
      const next: AiMessage[] = [
        ...withQuestion,
        { role: "model", text: result.answer },
      ];
      // כל שיחה נשמרת אוטומטית בהיסטוריה ואפשר להמשיך אותה, גם אם המשתמש כבר עבר למסך אחר
      const existing = ctx.saved.find((c) => c.id === chatId);
      const title = (next.find((m) => m.role === "user")?.text ?? "שיחה").slice(
        0,
        60,
      );
      let notSaved = false;
      const evict = existing ? null : chatToEvict(ctx.saved, chatId);
      if (evict === "full") {
        notSaved = true;
      } else {
        if (evict) deleteAiChat(uid, evict).catch(() => undefined);
        saveAiChat(uid, {
          id: chatId,
          title,
          pinned: existing?.pinned ?? false,
          messages: next,
          createdAt,
          updatedAt: Date.now(),
        }).catch(() => undefined);
      }
      saveRecentQuestions(
        uid,
        withRecentQuestion(ctx.recent, q, Date.now()),
      ).catch(() => undefined);
      if (stillHere() && state) {
        set({
          ...state,
          messages: next,
          busy: false,
          startedAt: null,
          quota: { remaining: result.remaining, limit: result.limit },
          unread: true,
          error: notSaved
            ? "כל חמש השיחות השמורות נעוצות, ולכן השיחה הזאת לא נשמרה בהיסטוריה. אפשר לבטל נעיצה של שיחה בהיסטוריה."
            : "",
        });
      } else if (state && state.uid === uid) {
        set({
          ...state,
          busy: false,
          startedAt: null,
          quota: { remaining: result.remaining, limit: result.limit },
        });
      }
    } catch (caught) {
      if (stillHere() && state) {
        set({
          ...state,
          messages: before,
          busy: false,
          startedAt: null,
          error: describeAiError(caught),
          failedDraft: q,
        });
      } else if (state && state.uid === uid) {
        set({ ...state, busy: false, startedAt: null });
      }
      loadAiQuota()
        .then((quota) => setQuota(uid, quota))
        .catch(() => undefined);
    }
  })();
}
