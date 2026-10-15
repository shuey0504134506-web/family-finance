import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * תהליך ראשי: חלון אחד, וקבצי נתונים בתיקיית המשתמש בלבד.
 * הרנדרר מבודד (contextIsolation, sandbox) ומקבל גישה רק ל-4 פעולות קבצים בשמות בטוחים.
 */
// ברירת המחדל של התוכנה היא עברית, בלי קשר לשפת Windows. מעבר לאנגלית נשמר בבחירת המשתמש.
app.commandLine.appendSwitch('lang', 'he');

const dataDir = (): string => path.join(app.getPath('userData'), 'data');
const SAFE = /^[A-Za-z0-9_.-]{1,120}$/;

function resolveSafe(name: unknown): string {
  if (typeof name !== 'string' || !SAFE.test(name) || name.startsWith('.')) throw new Error('bad-name');
  return path.join(dataDir(), name);
}

/** כתיבה אטומית: קובץ זמני ואז rename, כדי שקריסה באמצע לא תשאיר קובץ חצי כתוב. */
export async function atomicWrite(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, file);
}

ipcMain.handle('store:read', async (_e, name: unknown) => {
  try {
    return await fs.readFile(resolveSafe(name), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
});
ipcMain.handle('store:write', (_e, name: unknown, text: unknown) => {
  if (typeof text !== 'string' || text.length > 200_000_000) throw new Error('bad-data');
  return atomicWrite(resolveSafe(name), text);
});
ipcMain.handle('store:remove', async (_e, name: unknown) => {
  await fs.rm(resolveSafe(name), { force: true });
});
ipcMain.handle('store:where', () => dataDir());

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f7f3ea',
    title: 'ניהול כספים',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
  void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [w] = BrowserWindow.getAllWindows();
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
