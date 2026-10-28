import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export type QuickType = 'income' | 'expense';

/** כתובת מהווידג'ט או מקיצור לחיצה ארוכה: com.familyfinance.app://quick/income */
export function parseQuickUrl(url: string | null | undefined): QuickType | null {
  const m = /^com\.familyfinance\.app:\/\/quick\/(income|expense)\/?$/.exec((url ?? '').trim());
  return m ? (m[1] as QuickType) : null;
}

const go = (type: QuickType) => {
  window.location.hash = `#/quick/${type}`;
};

/**
 * ווידג'ט מסך הבית וקיצורי לחיצה ארוכה על סמל האפליקציה (אנדרואיד): פותחים ישר את טופס ההוספה.
 * בפתיחה קרה וגם כשהאפליקציה כבר פתוחה ברקע.
 */
export function installQuickActions(): void {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener('appUrlOpen', ({ url }) => {
    const type = parseQuickUrl(url);
    if (type) go(type);
  });
  void App.getLaunchUrl().then((launch) => {
    const type = parseQuickUrl(launch?.url);
    if (type) go(type);
  });
}
