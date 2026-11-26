import { CURRENCY_CODES, type Rates, type CurrencyCode } from '../domain/currency';
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
export function getRatesFor(date: string, uid?: string): Partial<Rates> | undefined {
  const auto = cache[date] ?? live.get(date);
  if (!uid) return auto;
  const manual=readManualRates(uid,date);
  return typeof navigator !== 'undefined' && navigator.onLine && auto ? auto : manual ? {...auto,...manual} : auto;
}

function readManualRates(uid:string,date:string):Partial<Rates>|undefined {
  try { const saved = JSON.parse(localStorage.getItem(`ff.manual-fx.v1.${uid}`) ?? '{}') as Record<string,Partial<Rates>>; if(!saved.default&&!saved[date])return undefined; return { ILS:1, ...saved.default, ...saved[date] }; } catch { return undefined; }
}

export function saveManualRates(uid:string,date:string,values:Partial<Rates>): void {
  const key=`ff.manual-fx.v1.${uid}`;
  const saved=JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string,Partial<Rates>>;
  for(const code of CURRENCY_CODES) if(values[code] !== undefined && (!Number.isFinite(values[code]) || values[code]! <= 0)) throw new Error('invalid rate');
  saved[date]={...saved[date],...values,ILS:1}; localStorage.setItem(key,JSON.stringify(saved)); bump();
}

export async function tryAutomaticRates(date:string): Promise<boolean> {
  if (!navigator.onLine) return false;
  if (cache[date] || live.has(date)) return true;
  try {
    const path=date >= todayIso() ? 'latest' : date;
    const response=await fetch(`https://api.frankfurter.dev/v1/${path}?base=ILS&symbols=USD,EUR,GBP`,{signal:AbortSignal.timeout(6000)});
    if(!response.ok) return false;
    const snapshot=parseRatesResponse(await response.json(),Date.now()); if(!snapshot) return false;
    if(date >= todayIso()) live.set(date,snapshot.rates); else {cache={...cache,[date]:snapshot.rates};writeStorage();} bump(); return true;
  } catch { return false; }
}

export function hasManualPair(uid:string,date:string,from:CurrencyCode,to:CurrencyCode):boolean {
  const r=readManualRates(uid,date); return !!r && Number.isFinite(r[from]) && Number.isFinite(r[to]) && r[from]!>0 && r[to]!>0;
}

async function fetchDay(date: string): Promise<void> {
  try {
    if (date >= todayIso()) {
      const latest = await loadRates();
      if (!latest || latest.stale) throw new Error('no fresh rates');
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
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

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { failedAt.clear(); bump(); });
  window.addEventListener('offline', bump);
}
