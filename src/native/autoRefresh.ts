/**
 * עדכון אוטומטי של האתר המותקן: בודק גרסה חדשה כל כמה דקות ובחזרה לחלון,
 * וכשהגרסה החדשה מוכנה טוען מחדש בזמן נוח: ברגע שהחלון עובר לרקע, או אחרי דקה בלי נגיעה.
 * כך לא נפסקת הקלדה באמצע, והמשתמש לא נשאר עם גרסה ישנה גם אם לא סגר את החלון.
 */
const CHECK_EVERY_MS = 5 * 60 * 1000;
const IDLE_MS = 60 * 1000;
const GUARD_KEY = 'ff.autorefresh.at';

export function startAutoRefresh(): void {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => {
          if (navigator.onLine) void registration.update().catch(() => undefined);
        };
        window.setInterval(check, CHECK_EVERY_MS);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) check();
        });
        window.addEventListener('online', check);
      },
    });
  });

  // רק אם כבר היה service worker שמנהל את הדף: זה עדכון, לא התקנה ראשונה
  if (!navigator.serviceWorker.controller) {
    // בהתקנה ראשונה ה-worker החדש תופס שליטה בלי שיש מה לרענן; רק השינוי הבא הוא עדכון
    return waitForFirstControl();
  }
  navigator.serviceWorker.addEventListener('controllerchange', scheduleReload, { once: true });
}

function waitForFirstControl(): void {
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => navigator.serviceWorker.addEventListener('controllerchange', scheduleReload, { once: true }),
    { once: true },
  );
}

function reload(): void {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return; // מונע לולאת רענון
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // אחסון חסום: ממשיכים
  }
  window.location.reload();
}

function scheduleReload(): void {
  if (document.hidden) {
    reload();
    return;
  }
  let timer = window.setTimeout(reload, IDLE_MS);
  const bump = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(reload, IDLE_MS);
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, bump, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reload();
  });
}
