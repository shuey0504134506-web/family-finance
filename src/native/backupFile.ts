import { Capacitor } from '@capacitor/core';

/**
 * שומר קובץ גיבוי במכשיר.
 * באפליקציית אנדרואיד: כותב לתיקיית המסמכים (Documents) בשם קבוע, ולכן כל גיבוי חדש
 * מחליף את הקודם. בדפדפן: הורדת קובץ רגילה, והדפדפן הוא שמחליט על השם אם כבר קיים קובץ כזה.
 * מחזיר איפה נשמר, להצגה למשתמש.
 */
export async function saveBackupFile(filename: string, content: string): Promise<'documents' | 'download'> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    try {
      await Filesystem.requestPermissions();
    } catch {
      // באנדרואיד 11 ומעלה אין צורך בהרשאה לקבצים שהאפליקציה יצרה
    }
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return 'documents';
  }
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'download';
}
