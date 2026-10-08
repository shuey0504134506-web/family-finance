import { isValidIsoDate } from './dates';
import type { Scope } from './types';

export type RemindMode = 'none' | 'every-open' | 'daily' | 'date';

export const REMIND_LABELS: Record<RemindMode, string> = {
  none: 'ללא תזכורת',
  'every-open': 'בכל כניסה לאפליקציה',
  daily: 'פעם ביום',
  date: 'מתאריך מסוים',
};

export interface Task {
  id: string;
  scope: Scope;
  title: string;
  done: boolean;
  remind: RemindMode;
  /** תאריך YYYY-MM-DD כשהתזכורת "מתאריך מסוים", אחרת מחרוזת ריקה. */
  remindDate: string;
  createdAt: number;
  updatedAt: number;
}

export interface ShoppingItem {
  id: string;
  scope: Scope;
  name: string;
  bought: boolean;
  createdAt: number;
  updatedAt: number;
}

export const MAX_TASK_TITLE = 200;
export const MAX_ITEM_NAME = 120;

export interface TaskDraft {
  title: string;
  remind: RemindMode;
  remindDate: string;
}

export function validateTaskDraft(draft: TaskDraft): Partial<Record<'title' | 'remindDate', string>> {
  const errors: Partial<Record<'title' | 'remindDate', string>> = {};
  const title = draft.title.trim();
  if (!title) errors.title = 'יש להזין תיאור למשימה.';
  else if (title.length > MAX_TASK_TITLE) errors.title = `התיאור ארוך מדי (עד ${MAX_TASK_TITLE} תווים).`;
  if (draft.remind === 'date' && !isValidIsoDate(draft.remindDate)) errors.remindDate = 'יש לבחור תאריך לתזכורת.';
  return errors;
}

export function buildTask(
  draft: TaskDraft,
  context: { id: string; scope: Scope; now: number; createdAt?: number; done?: boolean },
): Task {
  return {
    id: context.id,
    scope: context.scope,
    title: draft.title.trim(),
    done: context.done ?? false,
    remind: draft.remind,
    remindDate: draft.remind === 'date' ? draft.remindDate : '',
    createdAt: context.createdAt ?? context.now,
    updatedAt: context.now,
  };
}

export function validateItemName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'יש להזין שם פריט.';
  if (trimmed.length > MAX_ITEM_NAME) return `השם ארוך מדי (עד ${MAX_ITEM_NAME} תווים).`;
  return null;
}

export function buildShoppingItem(
  name: string,
  context: { id: string; scope: Scope; now: number; createdAt?: number; bought?: boolean },
): ShoppingItem {
  return {
    id: context.id,
    scope: context.scope,
    name: name.trim(),
    bought: context.bought ?? false,
    createdAt: context.createdAt ?? context.now,
    updatedAt: context.now,
  };
}

/** פתוחות קודם (החדשה למעלה), ואחריהן שבוצעו. */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.done === b.done ? b.createdAt - a.createdAt : a.done ? 1 : -1));
}

export function sortItems(items: readonly ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => (a.bought === b.bought ? b.createdAt - a.createdAt : a.bought ? 1 : -1));
}

/** מפה: מזהה משימה -> התאריך האחרון שבו התזכורת הוצגה במכשיר הזה. */
export type ShownMap = Record<string, string>;

export function parseShownMap(raw: string | null): ShownMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ShownMap = {};
    for (const [key, value] of Object.entries(parsed)) if (typeof value === 'string') out[key] = value;
    return out;
  } catch {
    return {};
  }
}

/**
 * אילו משימות מקפיצות תזכורת עכשיו (בכניסה לאפליקציה).
 *  - בכל כניסה: בכל פעם.
 *  - פעם ביום: בכניסה הראשונה של כל יום.
 *  - מתאריך מסוים: בכניסה הראשונה של כל יום, מהתאריך שנקבע ואילך (גם אם לא נכנסו ביום עצמו).
 * משימה שבוצעה לא מקפיצה. התזכורת נמשכת עד שמסמנים "בוצע" או משנים אותה.
 */
export function dueReminders(tasks: readonly Task[], today: string, shown: ShownMap): Task[] {
  return tasks.filter((task) => {
    if (task.done) return false;
    switch (task.remind) {
      case 'every-open':
        return true;
      case 'daily':
        return shown[task.id] !== today;
      case 'date':
        return task.remindDate !== '' && today >= task.remindDate && shown[task.id] !== today;
      default:
        return false;
    }
  });
}

/** מסמן שתזכורות היום הוצגו, ומסיר רשומות של משימות שאינן קיימות עוד. */
export function markShown(shown: ShownMap, shownNow: readonly Task[], allTasks: readonly Task[], today: string): ShownMap {
  const ids = new Set(allTasks.map((t) => t.id));
  const next: ShownMap = {};
  for (const [id, day] of Object.entries(shown)) if (ids.has(id)) next[id] = day;
  for (const task of shownNow) if (task.remind === 'daily' || task.remind === 'date') next[task.id] = today;
  return next;
}

/** מפתח האחסון (במכשיר) של תאריכי הצגת התזכורות. */
export const saveShownKey = (uid: string): string => `ff.reminders.v1.${uid}`;
