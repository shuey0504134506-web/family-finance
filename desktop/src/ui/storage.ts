import type { Storage } from '../core/session';

/** באפליקציה: קבצים בתיקיית המשתמש דרך Electron. בדפדפן (פיתוח ובדיקות): localStorage. */
export function createStorage(): Storage {
  const native = window.desktopStore;
  if (native) return { read: (n) => native.read(n), write: (n, t) => native.write(n, t), remove: (n) => native.remove(n) };
  const key = (n: string) => `desktop-store:${n}`;
  return {
    read: async (n) => localStorage.getItem(key(n)),
    write: async (n, t) => localStorage.setItem(key(n), t),
    remove: async (n) => localStorage.removeItem(key(n)),
  };
}
