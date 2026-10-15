import { LocalDb } from '../db/localDb';

/** המסד הפעיל של החשבון המחובר. הקליפה מחליפה אותו בכניסה ויוצאת ממנו ביציאה. */
let active: LocalDb = new LocalDb();
const holders = new Set<() => void>();

export const activeDb = (): LocalDb => active;

export function setActiveDb(db: LocalDb): void {
  active = db;
  for (const h of [...holders]) h();
}

/** האזנות שמוגדרות על המסד הפעיל מתחברות מחדש כשמחליפים אותו. */
export function onDbSwap(fn: () => void): () => void {
  holders.add(fn);
  return () => holders.delete(fn);
}
