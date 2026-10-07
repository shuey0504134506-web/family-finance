/**
 * מזהה ייחודי לכל פעולה. נוצר פעם אחת בעת פתיחת הטופס, ולכן לחיצה כפולה
 * על "שמור", ניסיון חוזר או סנכרון חוזר כותבים לאותו מסמך ולא יוצרים כפילות.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
