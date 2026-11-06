export const MAX_SAVED_CHATS = 5;
export const MAX_RECENT_QUESTIONS = 20;
export const MAX_CHAT_MESSAGES = 40;

export interface AiMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AiChat {
  id: string;
  title: string;
  pinned: boolean;
  messages: AiMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface RecentQuestion {
  q: string;
  at: number;
}

/** הוספת שאלה לראש הרשימה (בלי כפילויות), עד 20. */
export function withRecentQuestion(items: readonly RecentQuestion[], q: string, at: number): RecentQuestion[] {
  return [{ q, at }, ...items.filter((i) => i.q !== q)].slice(0, MAX_RECENT_QUESTIONS);
}

/**
 * שמירת שיחה בכפוף למגבלת חמש השיחות: כשהרשימה מלאה, נמחקת השיחה הישנה ביותר שאינה נעוצה.
 * מחזיר את מזהה השיחה שיש למחוק, null אם אין צורך, או 'full' אם כל השיחות נעוצות.
 */
export function chatToEvict(saved: readonly AiChat[], savingId: string): string | null | 'full' {
  if (saved.some((c) => c.id === savingId) || saved.length < MAX_SAVED_CHATS) return null;
  const candidates = saved.filter((c) => !c.pinned).sort((a, b) => a.updatedAt - b.updatedAt);
  return candidates.length > 0 ? candidates[0].id : 'full';
}
