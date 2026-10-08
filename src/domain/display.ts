import type { AccountMode } from './types';
import { HOUSEHOLD_SPACE, businessSpace, type Business, type Space } from './spaces';

/**
 * מה מוצג במכשיר הזה. נשמר בכל מכשיר בנפרד, כדי שאפשר יהיה לנהל עסק במכשיר
 * אחד ואת הבית במכשיר אחר, כשהנתונים עצמם משותפים.
 */
export interface DisplayPrefs {
  showHousehold: boolean;
  /** עסקים שהוסתרו. הנתונים שלהם נשמרים. */
  hiddenBusinessIds: string[];
  /**
   * האם הכנסות כל העסקים (גם המוסתרים) נכנסות להכנסות משק הבית.
   * כבוי: רק עסקים שמוצגים במכשיר נספרים.
   */
  includeHiddenInHousehold: boolean;
}

/** ברירת מחדל למכשיר שעוד לא נבחר בו כלום, לפי ייעוד החשבון שנבחר בעבר. */
export function defaultDisplayPrefs(legacyMode: AccountMode, businesses: readonly Business[]): DisplayPrefs {
  return {
    showHousehold: legacyMode !== 'business',
    hiddenBusinessIds: legacyMode === 'household' ? businesses.map((b) => b.id) : [],
    includeHiddenInHousehold: false,
  };
}

/** קריאה סלחנית של ההעדפות מהאחסון המקומי. ערך פגום מחזיר null. */
export function parseDisplayPrefs(raw: string | null): DisplayPrefs | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DisplayPrefs> | null;
    if (!value || typeof value !== 'object') return null;
    if (typeof value.showHousehold !== 'boolean') return null;
    if (!Array.isArray(value.hiddenBusinessIds) || !value.hiddenBusinessIds.every((x) => typeof x === 'string')) {
      return null;
    }
    return {
      showHousehold: value.showHousehold,
      hiddenBusinessIds: value.hiddenBusinessIds,
      includeHiddenInHousehold: value.includeHiddenInHousehold === true,
    };
  } catch {
    return null;
  }
}

/**
 * המרחבים שמוצגים, בסדר: העסקים ואחריהם משק הבית.
 * תמיד מוצג לפחות מרחב אחד: אם כל הבחירות כבו, מציגים הכול (כדי שלא ייתקעו בלי מסך).
 */
export function visibleSpaces(businesses: readonly Business[], prefs: DisplayPrefs): Space[] {
  const hidden = new Set(prefs.hiddenBusinessIds);
  const result: Space[] = businesses.filter((b) => !hidden.has(b.id)).map((b) => businessSpace(b.id));
  if (prefs.showHousehold) result.push(HOUSEHOLD_SPACE);
  if (result.length === 0) {
    return [...businesses.map((b) => businessSpace(b.id)), HOUSEHOLD_SPACE];
  }
  return result;
}

/** העסקים שהכנסתם נכנסת למשק הבית: המוצגים, או כולם אם סומן "הכל משתקף". */
export function countedBusinessIds(businesses: readonly Business[], prefs: DisplayPrefs): string[] {
  if (prefs.includeHiddenInHousehold) return businesses.map((b) => b.id);
  const hidden = new Set(prefs.hiddenBusinessIds);
  return businesses.filter((b) => !hidden.has(b.id)).map((b) => b.id);
}

/**
 * סדר החלקה בין מרחבים. הרשימה כבר מסודרת; מחזיר את המרחב הבא/הקודם, או null.
 */
export function neighborSpace(spaces: readonly Space[], currentKey: string, step: 1 | -1): Space | null {
  const index = spaces.findIndex((s) => s.key === currentKey);
  if (index < 0) return null;
  return spaces[index + step] ?? null;
}
