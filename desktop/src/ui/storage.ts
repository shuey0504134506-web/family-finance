import type { Storage } from '../core/session';
import { IS_PHONE } from './target';

/** IndexedDB פשוט (מפתח → טקסט). גדול בהרבה מ-localStorage, ונדרש כי כספת הנתונים יכולה להגיע למגה-בתים. */
function indexedStorage(): Storage {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('ff-offline-store', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = async <T,>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  };
  return {
    read: async (n) => {
      const value = await run('readonly', (s) => s.get(n));
      return typeof value === 'string' ? value : null;
    },
    write: async (n, t) => {
      await run('readwrite', (s) => s.put(t, n));
    },
    remove: async (n) => {
      await run('readwrite', (s) => s.delete(n));
    },
  };
}

/** באפליקציה: קבצים בתיקיית המשתמש דרך Electron. בטלפון: IndexedDB. בדפדפן (פיתוח ובדיקות): localStorage. */
export function createStorage(): Storage {
  const native = window.desktopStore;
  if (native) return { read: (n) => native.read(n), write: (n, t) => native.write(n, t), remove: (n) => native.remove(n) };
  if (IS_PHONE && typeof indexedDB !== 'undefined') return indexedStorage();
  const key = (n: string) => `desktop-store:${n}`;
  return {
    read: async (n) => localStorage.getItem(key(n)),
    write: async (n, t) => localStorage.setItem(key(n), t),
    remove: async (n) => localStorage.removeItem(key(n)),
  };
}
