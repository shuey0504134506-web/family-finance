/**
 * לוגו של עסק: תמונה קטנה (עד 256x256) שנשמרת כמחרוזת data URL.
 * נשמרת גם במכשיר (localStorage) וגם בחשבון (Firestore), כדי שלא תיעלם בסגירת הדפדפן
 * ותופיע בכל המכשירים.
 */
export const LOGO_SIZE = 256;
/** מגבלת אורך המחרוזת. נאכפת גם בכללי האבטחה (firestore.rules) ומתחת ל-1MB של מסמך. */
export const MAX_LOGO_CHARS = 120_000;

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export const isLogoData = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_LOGO_CHARS && DATA_URL.test(value);
