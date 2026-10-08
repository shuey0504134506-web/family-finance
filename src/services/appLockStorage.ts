import {
  DEFAULT_LOCK_CONFIG,
  parseLockConfig,
  type LockConfig,
  type SecretHash,
} from '../domain/appLock';

const ITERATIONS = 150_000;
const keyFor = (uid: string) => `ff.lock.v1.${uid}`;

// אם האחסון חסום, ההגדרות נשמרות בזיכרון עד לסגירת הדף.
const memory = new Map<string, string>();

export function loadLockConfig(uid: string): LockConfig {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (raw !== null) return parseLockConfig(raw);
  } catch {
    // אחסון חסום
  }
  return memory.has(keyFor(uid)) ? parseLockConfig(memory.get(keyFor(uid)) ?? null) : { ...DEFAULT_LOCK_CONFIG };
}

/** קריאה, שינוי ושמירה כצעד אחד, כדי ששני כותבים לא ידרסו זה את זה. */
export function patchLockConfig(uid: string, change: (current: LockConfig) => LockConfig): LockConfig {
  const next = change(loadLockConfig(uid));
  const raw = JSON.stringify(next);
  memory.set(keyFor(uid), raw);
  try {
    localStorage.setItem(keyFor(uid), raw);
  } catch {
    // אחסון חסום: נשארים עם הזיכרון
  }
  return next;
}

export function clearLockConfig(uid: string): void {
  memory.delete(keyFor(uid));
  try {
    localStorage.removeItem(keyFor(uid));
  } catch {
    // אין מה לעשות
  }
}

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(secret: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('crypto-unavailable');
  const key = await subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashSecret(secret: string): Promise<SecretHash> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), iterations: ITERATIONS, hash: toB64(await derive(secret, salt, ITERATIONS)) };
}

export async function verifySecret(secret: string, stored: SecretHash): Promise<boolean> {
  const actual = await derive(secret, fromB64(stored.salt), stored.iterations);
  const expected = fromB64(stored.hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
