export const SWIPE_MIN_DISTANCE = 80;
export const SWIPE_MAX_MS = 700;

export type SwipeDirection = 'back' | 'forward' | null;

/**
 * מסווג החלקה אופקית. החלקה ימינה = חזרה אחורה, שמאלה = קדימה.
 * מתעלם מגלילה אנכית (תנועה בעיקר אנכית), מהחלקות קצרות ומאיטיות.
 */
export function classifySwipe(dx: number, dy: number, elapsedMs: number): SwipeDirection {
  if (elapsedMs > SWIPE_MAX_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * 2) return null;
  return dx > 0 ? 'back' : 'forward';
}

/** מסך הבית של מרחב: /household, /business או /business.<מזהה>. */
export function isSpaceHomePath(clean: string): boolean {
  return clean === '/household' || clean === '/business' || /^\/business\.[^/]+$/.test(clean);
}

/** מסכים שבהם ההחלקה אינה מנווטת: הבית (שם היא מחליפה בין עסק למשק בית), כניסה והרשמה, וטפסי הזנה. */
export function isSwipeNavigationRoute(path: string): boolean {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/' || isSpaceHomePath(clean)) return false;
  if (['/welcome', '/signup', '/login', '/forgot-password'].includes(clean)) return false;
  // טופס הוספה ועריכה: החלקה בטעות עלולה למחוק מה שהוקלד.
  if (/^\/(business(\.[^/]+)?|household)\/(add|edit)\//.test(clean)) return false;
  return true;
}
