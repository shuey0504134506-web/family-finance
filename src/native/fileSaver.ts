import { Capacitor, registerPlugin } from '@capacitor/core';

interface FileSaverPlugin {
  save(options: { name: string; data: string; mime: string; base64?: boolean }): Promise<{ path: string }>;
}
/** התוסף המקורי באנדרואיד (FileSaverPlugin.java). בגרסאות ישנות שאין בהן אותו הקריאה נכשלת ונופלים לדרך הקודמת. */
const FileSaver = registerPlugin<FileSaverPlugin>('FileSaver');

export const DOWNLOADS_FOLDER_LABEL = 'Download/ניהול כספים';

/** שומר ישר לתיקיית ההורדות של הטלפון. מחזיר את המיקום, או null אם אי אפשר (דפדפן, גרסה ישנה, כשל). */
export async function saveToDownloads(name: string, data: string, mime: string, base64 = false): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;
  try {
    return (await FileSaver.save({ name, data, mime, base64 })).path;
  } catch {
    return null;
  }
}
