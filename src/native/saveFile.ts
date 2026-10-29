import { Capacitor } from '@capacitor/core';
import { suppressLock } from '../services/lockSuppress';
import { saveToDownloads } from './fileSaver';

export type SaveOutcome = 'shared' | 'saved-documents' | 'saved-downloads' | 'downloaded' | 'cancelled';

/** שם קובץ בטוח (ASCII) לשיתוף: אפליקציות יעד מסוימות מתקשות עם שמות בעברית. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'file';
}

const isCancel = (error: unknown): boolean => {
  const e = error as { name?: string; message?: string } | null;
  return e?.name === 'AbortError' || /cancel/i.test(e?.message ?? '');
};

/**
 * שומר קובץ שהמשתמש ביקש להוריד (גיבוי או ייצוא לאקסל), בדרך שעובדת בכל מכשיר:
 * - באנדרואיד: נשמר ישר לתיקיית ההורדות (Download/ניהול כספים), בלי חלון שיתוף.
 * - אם זה לא אפשרי (iOS או גרסה ישנה): כותב קובץ זמני ופותח את חלון השיתוף של המערכת ("שמירה בקבצים",
 *   Drive, מייל, וואטסאפ). הורדת קובץ מתוך WebView לא עובדת, ולכן אין הורדה רגילה.
 * - בדפדפן בטלפון (למשל Safari באייפון): חלון השיתוף של הדפדפן, שבו אפשר "שמירה בקבצים".
 * - בדפדפן במחשב: הורדה רגילה.
 * אם חלון השיתוף לא זמין, נופלים לשמירה בתיקיית המסמכים (באפליקציה) או להורדה רגילה.
 */
export async function saveFile(filename: string, content: string, mime: string): Promise<SaveOutcome> {
  suppressLock();
  const name = safeFileName(filename);

  if (Capacitor.isNativePlatform()) {
    // באנדרואיד הקובץ נשמר ישר לתיקיית ההורדות, בלי חלון שיתוף
    if (await saveToDownloads(name, content, mime)) return 'saved-downloads';
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const written = await Filesystem.writeFile({
      path: name,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: name, url: written.uri, dialogTitle: 'שמירת הקובץ' });
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
      await Filesystem.writeFile({ path: name, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      return 'saved-documents';
    }
  }

  const blob = new Blob([content], { type: mime });
  const file = new File([blob], name, { type: mime });
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));
  if (mobile && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
      // ממשיכים להורדה רגילה
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** מפרק כתובת data:image/...;base64,... לסוג, סיומת ותוכן base64. מחזיר null אם זו לא תמונה בקידוד base64. */
export function parseImageDataUrl(dataUrl: string): { mime: string; ext: string; base64: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1]!;
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length);
  return { mime, ext, base64: m[2]! };
}

/**
 * שומר תמונה (למשל קבלה מצורפת) במכשיר. אותה התנהגות כמו saveFile:
 * באנדרואיד חלון השיתוף של המערכת ("שמירה בקבצים", גלריה, וואטסאפ), בדפדפן בטלפון חלון השיתוף, ובמחשב הורדה רגילה.
 */
export async function saveImage(baseName: string, dataUrl: string): Promise<SaveOutcome> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) throw new Error('not-an-image');
  suppressLock();
  const name = `${safeFileName(baseName)}.${parsed.ext}`;

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const written = await Filesystem.writeFile({ path: name, data: parsed.base64, directory: Directory.Cache });
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: name, url: written.uri, dialogTitle: 'שמירת התמונה' });
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
      await Filesystem.writeFile({ path: name, data: parsed.base64, directory: Directory.Documents, recursive: true });
      return 'saved-documents';
    }
  }

  const bytes = Uint8Array.from(atob(parsed.base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: parsed.mime });
  const file = new File([blob], name, { type: parsed.mime });
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));
  if (mobile && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
