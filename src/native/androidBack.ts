import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/** מסכי שורש: Back בהם יוצא מהאפליקציה (אינו מוחק מידע ואינו מנתק מהחשבון). */
const ROOT_ROUTES = new Set(['', '/', '/business', '/household', '/welcome', '/login']);

export function isRootRoute(hash: string): boolean {
  const path = hash.replace(/^#/, '').split('?')[0];
  // מסך הבית של עסק נוסף: /business.<מזהה>
  return ROOT_ROUTES.has(path) || /^\/business\.[^/]+$/.test(path);
}

/**
 * כפתור Back של אנדרואיד באפליקציה הארוזה: במסך פנימי חוזרים צעד אחורה, ובמסך שורש יוצאים.
 * בדפדפן רגיל אין לזה השפעה.
 */
export function installAndroidBackHandler(): void {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener('backButton', () => {
    if (!isRootRoute(window.location.hash) && window.history.length > 1) {
      window.history.back();
    } else {
      void App.exitApp();
    }
  });
}
