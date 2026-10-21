import { Capacitor } from '@capacitor/core';
import { isNewerVersion, latestRelease, RELEASES_API, type ReleaseInfo } from '../domain/releases';

/** עדכון מתוך האפליקציה: באנדרואיד (APK) ובתוכנת Windows. בדפדפן רגיל האתר מתעדכן לבד. */
export type UpdateKind = 'android' | 'windows';
export interface UpdateInfo {
  kind: UpdateKind;
  current: string;
  version: string;
  url: string;
}

declare global {
  interface Window {
    desktopUpdate?: {
      version(): Promise<string>;
      install(url: string): Promise<void>;
    };
  }
}

export async function installed(): Promise<{ kind: UpdateKind; version: string } | null> {
  try {
    if (typeof window !== 'undefined' && window.desktopUpdate) {
      return { kind: 'windows', version: await window.desktopUpdate.version() };
    }
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      const { App } = await import('@capacitor/app');
      return { kind: 'android', version: (await App.getInfo()).version };
    }
  } catch {
    // בלי מידע על הגרסה המותקנת לא מציעים עדכון
  }
  return null;
}

/** בודק אם יצאה גרסה חדשה. כל כשל (בלי רשת, מגבלת GitHub) פשוט מחזיר null. */
export async function findUpdate(): Promise<UpdateInfo | null> {
  const cur = await installed();
  if (!cur) return null;
  try {
    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const latest = latestRelease((await res.json()) as ReleaseInfo[], cur.kind);
    if (!latest || !isNewerVersion(latest.version, cur.version)) return null;
    return { kind: cur.kind, current: cur.version, version: latest.version, url: latest.url };
  } catch {
    return null;
  }
}

/**
 * Windows: התוכנה מורידה את ההתקנה, פותחת אותה ונסגרת.
 * אנדרואיד: נפתח הקישור להורדת ה-APK בדפדפן, ובסיום מקישים עליו כדי להתקין.
 */
export async function applyUpdate(info: UpdateInfo): Promise<void> {
  if (info.kind === 'windows') {
    await window.desktopUpdate?.install(info.url);
    return;
  }
  // Capacitor פותח כתובות חיצוניות (שאינן של האפליקציה) בדפדפן המערכת, שמוריד את ה-APK
  window.location.href = info.url;
}
