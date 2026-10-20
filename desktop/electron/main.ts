import { app, BrowserWindow, dialog, ipcMain, Menu, net, session, shell } from 'electron';
import { accessSync, createWriteStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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

const MIME_EXT: Record<string, string[]> = {
  'image/*': ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'],
  'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'],
  'text/csv': ['csv'], 'text/plain': ['txt'], 'application/json': ['json'], 'application/pdf': ['pdf'],
  'application/vnd.ms-excel': ['xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
};
const MAX_PICK = 60 * 1024 * 1024;

/** בחירת קבצים בחלון מובנה של המערכת. מחליף את חלון הבחירה של הדפדפן, שבחלק מהמחשבים לא נפתח. */
ipcMain.handle('files:pick', async (e, accept: unknown, multiple: unknown) => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
  const tokens = typeof accept === 'string' ? accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
  const exts = [...new Set(tokens.flatMap((t) => (t.startsWith('.') ? [t.slice(1)] : MIME_EXT[t] ?? [])))].filter((x) => /^[a-z0-9]{1,8}$/.test(x));
  const options: Electron.OpenDialogOptions = {
    title: 'בחירת קובץ',
    properties: multiple === true ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [...(exts.length ? [{ name: 'קבצים נתמכים', extensions: exts }] : []), { name: 'כל הקבצים', extensions: ['*'] }],
  };
  const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  if (res.canceled) return [];
  const out: { name: string; data: Uint8Array }[] = [];
  for (const file of res.filePaths.slice(0, multiple === true ? 20 : 1)) {
    const stat = await fs.stat(file);
    if (stat.size > MAX_PICK) throw new Error('file-too-large');
    out.push({ name: path.basename(file), data: new Uint8Array(await fs.readFile(file)) });
  }
  return out;
});

/**
 * עדכון התוכנה מתוך התוכנה: מוריד את קובץ ההתקנה מגרסאות המאגר (כתובת מאושרת בלבד), פותח אותו ונסגר,
 * כדי שההתקנה תוכל להחליף את הקבצים. הנתונים נשמרים בתיקיית המשתמש ולא נפגעים.
 */
const UPDATE_URL = /^https:\/\/github\.com\/shuey0504134506-web\/family-finance\/releases\/download\/desktop-v\d+(?:\.\d+)*\/finance-desktop-\d+(?:\.\d+)*-x64\.exe$/;
ipcMain.handle('update:version', () => app.getVersion());
ipcMain.handle('update:install', async (_e, url: unknown) => {
  if (typeof url !== 'string' || !UPDATE_URL.test(url)) throw new Error('bad-url');
  const res = await net.fetch(url);
  if (!res.ok || !res.body) throw new Error('download-failed');
  const file = path.join(os.tmpdir(), `finance-update-${Date.now()}.exe`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file));
  const stat = await fs.stat(file);
  if (stat.size < 5 * 1024 * 1024) throw new Error('download-incomplete');
  const err = await shell.openPath(file);
  if (err) throw new Error(err);
  setTimeout(() => app.quit(), 1500);
});

/** הורדות (גיבוי, אקסל) נשמרות ישר בתיקיית ההורדות, בלי חלון שמירה, ובשם שאינו דורס קובץ קיים. */
function setupDownloads(): void {
  session.defaultSession.on('will-download', (_e, item) => {
    const dir = app.getPath('downloads');
    const base = path.basename(item.getFilename() || 'download');
    const ext = path.extname(base);
    const stem = base.slice(0, base.length - ext.length);
    let target = path.join(dir, base);
    for (let i = 1; i < 500; i++) {
      try { accessSync(target); target = path.join(dir, `${stem} (${i})${ext}`); } catch { break; }
    }
    item.setSavePath(target);
  });
}

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
    setupDownloads();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
