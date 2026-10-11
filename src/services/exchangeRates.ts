import { CURRENCY_CODES, type Rates } from '../domain/currency';

/**
 * שערי המרה עדכניים משירות חינמי של שערים רשמיים (Frankfurter, מבוסס בנק מרכזי אירופי),
 * בלי מפתח ובלי הרשמה. השער האחרון נשמר במכשיר, כדי שגם בלי אינטרנט אפשר יהיה להמיר
 * לפי השער האחרון שהתקבל, עם תאריך ברור.
 */
const URL = 'https://api.frankfurter.dev/v1/latest?base=ILS&symbols=USD,EUR,GBP';
const STORAGE_KEY = 'ff.rates.v1';
/** שער שנשמר לפני פחות מזה נחשב טרי ואין צורך להביא שוב. */
const FRESH_MS = 6 * 60 * 60 * 1000;

export interface RatesSnapshot {
  rates: Rates;
  /** תאריך השער כפי שפורסם (YYYY-MM-DD) */
  date: string;
  fetchedAt: number;
  /** true = לא הצלחנו להביא שער חדש, ומוצג האחרון ששמרנו */
  stale: boolean;
}

/** פענוח תשובת השירות. מחזיר null אם היא לא תקינה (שערים חסרים, אפס או לא מספר). */
export function parseRatesResponse(raw: unknown, fetchedAt: number): RatesSnapshot | null {
  const body = raw as { date?: unknown; rates?: Record<string, unknown> } | null;
  if (!body || typeof body.date !== 'string' || !body.rates || typeof body.rates !== 'object') return null;
  const rates = { ILS: 1 } as Rates;
  for (const code of CURRENCY_CODES) {
    if (code === 'ILS') continue;
    const value = body.rates[code];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    rates[code] = value;
  }
  return { rates, date: body.date, fetchedAt, stale: false };
}

function readCache(): RatesSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as RatesSnapshot;
    const ok = CURRENCY_CODES.every((c) => typeof p.rates?.[c] === 'number' && p.rates[c] > 0);
    return ok && typeof p.date === 'string' && typeof p.fetchedAt === 'number' ? p : null;
  } catch {
    return null;
  }
}

/** מביא שערים (או מחזיר טריים מהמכשיר). בכישלון: האחרונים ששמרנו, מסומנים stale, ואם אין, null. */
export async function loadRates(now: number = Date.now()): Promise<RatesSnapshot | null> {
  const cached = readCache();
  if (cached && now - cached.fetchedAt < FRESH_MS) return { ...cached, stale: false };
  try {
    const response = await fetch(URL);
    if (!response.ok) throw new Error(`rates ${response.status}`);
    const snapshot = parseRatesResponse(await response.json(), now);
    if (!snapshot) throw new Error('rates invalid');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // אחסון חסום: ננסה שוב בפעם הבאה
    }
    return snapshot;
  } catch {
    return cached ? { ...cached, stale: true } : null;
  }
}
