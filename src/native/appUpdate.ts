import { suppressLock } from '../services/lockSuppress';
import { Capacitor, registerPlugin } from '@capacitor/core';
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

interface AppUpdaterPlugin {
  download(options: { url: string }): Promise<void>;
  install(): Promise<{ needsPermission: boolean }>;
  addListener(event: 'progress', fn: (e: { percent: number }) => void): Promise<{ remove: () => Promise<void> }>;
}
/** התוסף המקורי באנדרואיד (AppUpdaterPlugin.java). בגרסאות ישנות שאין בהן אותו, הקריאה נכשלת ונופלים להורדה בדפדפן. */
const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export type ApplyResult = 'started' | 'needsPermission';

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
 * אנדרואיד: האפליקציה מורידה את ה-APK בעצמה (בלי דפדפן) ופותחת את מסך ההתקנה של המערכת.
 * אם זו הפעם הראשונה, נפתח מסך הגדרות לאישור התקנת עדכונים ('needsPermission'), ואחרי האישור לוחצים שוב.
 * באפליקציה ישנה שאין בה את התוסף: נפתח קישור ההורדה בדפדפן.
 */
export async function applyUpdate(info: UpdateInfo, onProgress?: (percent: number) => void): Promise<ApplyResult> {
  // מסך ההתקנה והגדרות המערכת מוציאים את האפליקציה לרקע: זה לא סיבה לנעול
  suppressLock(10 * 60_000);
  if (info.kind === 'windows') {
    await window.desktopUpdate?.install(info.url);
    return 'started';
  }
  let handle: { remove: () => Promise<void> } | null = null;
  try {
    if (onProgress) handle = await AppUpdater.addListener('progress', (e) => onProgress(e.percent));
    await AppUpdater.download({ url: info.url });
  } catch (error) {
    const message = String((error as { message?: string } | null)?.message ?? error);
    if (/not implemented|not available|UNIMPLEMENTED/i.test(message)) {
      window.location.href = info.url;
      return 'started';
    }
    throw error;
  } finally {
    await handle?.remove().catch(() => undefined);
  }
  const result = await AppUpdater.install();
  return result.needsPermission ? 'needsPermission' : 'started';
}
