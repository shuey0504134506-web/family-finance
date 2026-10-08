import type { Scope } from './types';

/**
 * "מרחב" הוא מקום אחד שאפשר להיות בו: משק הבית, או עסק מסוים.
 * בכל מרחב יש מסך בית, רשימות, קטגוריות ותקציב משלו.
 *
 * המפתח (key) הוא מה שמופיע בכתובת: `household`, `business` (העסק הראשון)
 * או `business.<מזהה>` לעסקים נוספים. העסק הראשון נשאר `business` כדי שכל
 * הקישורים והנתונים שנשמרו לפני שנוספה תמיכה בכמה עסקים ימשיכו לעבוד.
 */
export const DEFAULT_BUSINESS_ID = 'main';

/** עסק. נשמר ב-users/{uid}/businesses/{id}. */
export interface Business {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface Space {
  key: string;
  scope: Scope;
  /** מזהה העסק. במשק הבית: מחרוזת ריקה. */
  businessId: string;
}

export const HOUSEHOLD_SPACE: Space = { key: 'household', scope: 'household', businessId: '' };

export function businessSpace(businessId: string): Space {
  const id = businessId || DEFAULT_BUSINESS_ID;
  return {
    key: id === DEFAULT_BUSINESS_ID ? 'business' : `business.${id}`,
    scope: 'business',
    businessId: id,
  };
}

/** פירוק מפתח מהכתובת. מחזיר null אם אינו תקין. */
export function parseSpaceKey(key: string | undefined): Space | null {
  if (key === 'household') return HOUSEHOLD_SPACE;
  if (key === 'business') return businessSpace(DEFAULT_BUSINESS_ID);
  if (key && key.startsWith('business.') && key.length > 'business.'.length) {
    return businessSpace(key.slice('business.'.length));
  }
  return null;
}

/** העסק של פריט שנשמר. פריט ישן בלי מזהה שייך לעסק הראשון. */
export function businessIdOf(item: { businessId?: string }): string {
  return item.businessId || DEFAULT_BUSINESS_ID;
}

/**
 * האם פריט (קטגוריה, תקציב, משימה...) שייך למרחב.
 * בעסק בודקים גם את מזהה העסק, כדי שעסקים שונים לא יתערבבו.
 */
export function inSpace(item: { scope: Scope; businessId?: string }, space: Space): boolean {
  if (item.scope !== space.scope) return false;
  return space.scope === 'household' || businessIdOf(item) === space.businessId;
}

/** המרחב (מתוך הרשימה) שפריט שייך אליו, או undefined אם אינו מוצג. */
export function spaceOfItem(item: { scope: Scope; businessId?: string }, spaces: readonly Space[]): Space | undefined {
  return spaces.find((s) => inSpace(item, s));
}

/** שם התצוגה של מרחב. */
export function spaceName(space: Space, businesses: readonly Business[], householdName: string): string {
  if (space.scope === 'household') return householdName;
  return businesses.find((b) => b.id === space.businessId)?.name || 'עסק';
}

export const DEFAULT_HOUSEHOLD_NAME = 'משק הבית';
export const MAX_SPACE_NAME = 60;

/** בדיקת שם לעסק או למשק הבית. מחזיר הודעת שגיאה או null. */
export function validateSpaceName(name: string, label: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return `יש להזין ${label}.`;
  if (trimmed.length > MAX_SPACE_NAME) return `${label} ארוך מדי (עד ${MAX_SPACE_NAME} תווים).`;
  return null;
}
