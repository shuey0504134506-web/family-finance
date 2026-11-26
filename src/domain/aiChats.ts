export const MAX_SAVED_CHATS = 10;
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

/** Local, deterministic titles: no extra model request or quota use. */
export function chatTitle(question: string): string {
  const clean = question.replace(/[?!.]+$/u, '').replace(/\s+/g, ' ').trim();
  const short = clean.replace(/^(?:כמה|מה|איך|האם|תוכל|תוכלי|תן לי|תני לי)\s+/u, '')
    .replace(/^(?:הוצאתי|הוצאנו|שילמתי|שילמנו)\s+/u, 'הוצאות ')
    .replace(/^how much (?:did I|did we) (?:spend|pay)\s*/i, 'Spending ')
    .replace(/^(?:what is|what are|show me|can you show me|tell me)\s+/i, '');
  const words = (short || clean || 'שיחה חדשה').split(' ');
  return words.slice(0, 6).join(' ').slice(0, 55);
}
export function splitChatHistory(chats: readonly AiChat[]): { cloud: AiChat[]; local: AiChat[] } {
  const sorted = [...new Map(chats.map(c => [c.id, c])).values()].sort((a,b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  return { cloud: sorted.slice(0, MAX_SAVED_CHATS), local: sorted.slice(MAX_SAVED_CHATS) };
}

