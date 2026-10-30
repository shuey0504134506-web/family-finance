/**
 * פתיחה קרה ברשת שמדווחת "מחוברת" אבל לא עונה (או בלי אינטרנט בכלל): בכניסה Firebase Auth מרענן את החשבון מול השרת
 * וממתין עד 30 שניות לתשובה. כל הזמן הזה גם Firestore ממתין לאימות, ולכן האפליקציה נשארת על "טוען נתונים".
 *
 * כאן מקצרים רק את שתי הקריאות של רענון הסשן בכניסה (חידוש טוקן ובדיקת החשבון) לשנייה אחת, ורק בדקה הראשונה
 * אחרי הפתיחה. כישלון או חריגה מהזמן נחשבים "אין חיבור": Firebase משאיר את המשתמש מחובר ומנסה שוב אחר כך.
 * כניסה, הרשמה, שינוי סיסמה ושאר הפעולות של המשתמש לא נפגעות והזמן שלהן לא מתקצר.
 */
const STARTUP_REFRESH = /^https:\/\/(securetoken\.googleapis\.com\/v1\/token|identitytoolkit\.googleapis\.com\/v1\/accounts:lookup)/;
export const STARTUP_TIMEOUT_MS = 1000;
const STARTUP_WINDOW_MS = 60_000;

export function installFastAuthStart(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const original = window.fetch.bind(window);
  const bootedAt = Date.now();
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (Date.now() - bootedAt > STARTUP_WINDOW_MS || !STARTUP_REFRESH.test(url)) return original(input, init);
    return new Promise<Response>((resolve, reject) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => {
        controller.abort();
        reject(new TypeError('Failed to fetch'));
      }, STARTUP_TIMEOUT_MS);
      init?.signal?.addEventListener('abort', () => controller.abort());
      original(input, { ...init, signal: controller.signal }).then(
        (res) => {
          window.clearTimeout(timer);
          resolve(res);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      );
    });
  };
}
