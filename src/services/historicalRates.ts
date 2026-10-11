import { CURRENCY_CODES, type Rates } from '../domain/currency';
import { loadRates, parseRatesResponse } from './exchangeRates';

/**
 * שערי המרה לפי תאריך (Frankfurter, שערים רשמיים). לכל יום מבקשים שער אחד ושומרים אותו
 * במכשיר לצמיתות, כך שאחרי הפעם הראשונה אין צורך באינטרנט. בסופי שבוע ובחגים השירות
 * מחזיר את השער של יום העסקים הקודם. לתאריך של היום ולתאריך עתידי משתמשים בשער העדכני.
 */
const STORAGE_KEY = 'ff.fxdaily.v1';
const CONCURRENCY = 4;
const MAX_NEW_PER_RUN = 80;
const RETRY_AFTER_MS = 2 * 60 * 1000;

let cache: Record<string, Rates> = readStorage();
const pendingDates: string[] = [];
const inflight = new Set<string>();
const failedAt = new Map<string, number>();
const live = new Map<string, Rates>();
let running = 0;
let version = 0;
const listeners = new Set<() => void>();

function readStorage(): Record<string, Rates> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<Rates>>;
    const out: Record<string, Rates> = {};
    for (const [date, r] of Object.entries(parsed)) {
      if (CURRENCY_CODES.every((c) => typeof r?.[c] === 'number' && (r[c] as number) > 0)) out[date] = r as Rates;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // אחסון חסום: השערים יובאו שוב בפעם הבאה
  }
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function bump(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeRates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ratesVersion(): number {
  return version;
}

/** השער ליום מסוים, אם כבר הגיע. */
export function getRatesFor(date: string): Rates | undefined {
  return cache[date] ?? live.get(date);
}

async function fetchDay(date: string): Promise<void> {
  try {
    if (date >= todayIso()) {
      const latest = await loadRates();
      if (!latest) throw new Error('no rates');
      live.set(date, latest.rates);
    } else {
      const response = await fetch(`https://api.frankfurter.dev/v1/${date}?base=ILS&symbols=USD,EUR,GBP`);
      if (!response.ok) throw new Error(`rates ${response.status}`);
      const snapshot = parseRatesResponse(await response.json(), Date.now());
      if (!snapshot) throw new Error('rates invalid');
      cache = { ...cache, [date]: snapshot.rates };
      writeStorage();
    }
    failedAt.delete(date);
  } catch {
    failedAt.set(date, Date.now());
  } finally {
    inflight.delete(date);
    bump();
  }
}

function pump(): void {
  while (running < CONCURRENCY && pendingDates.length > 0) {
    const date = pendingDates.shift() as string;
    running += 1;
    void fetchDay(date).finally(() => {
      running -= 1;
      pump();
    });
  }
}

/** מבקש שערים לתאריכים שעוד אין להם. בטוח לקריאה חוזרת. */
export function requestRates(dates: Iterable<string>): void {
  const now = Date.now();
  let added = 0;
  for (const date of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (cache[date] || live.has(date) || inflight.has(date)) continue;
    const failed = failedAt.get(date);
    if (failed !== undefined && now - failed < RETRY_AFTER_MS) continue;
    if (added >= MAX_NEW_PER_RUN) break;
    inflight.add(date);
    pendingDates.push(date);
    added += 1;
  }
  pump();
}
