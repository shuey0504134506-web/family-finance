/**
 * הצפנה לכספת המקומית. WebCrypto בלבד (זמין גם ב-Node וגם ב-Electron), בלי ספריות חיצוניות.
 * - מפתח מהסיסמה: PBKDF2-SHA256 עם מלח אקראי.
 * - הצפנה: AES-256-GCM (מאומתת: סיסמה שגויה או קובץ שנפגע נכשלים בפענוח).
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** מפתח AES מסוד (סיסמה, או תשובות לשאלות) ומלח. */
export async function deriveKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(secret.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** תיבה מוצפנת: iv ותוכן, שניהם base64. */
export interface Box {
  iv: string;
  ct: string;
}

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<Box> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource));
  return { iv: toBase64(iv), ct: toBase64(ct) };
}

export class WrongKeyError extends Error {
  constructor() {
    super('wrong-key');
  }
}

export async function decryptBytes(key: CryptoKey, box: Box): Promise<Uint8Array> {
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) as BufferSource }, key, fromBase64(box.ct) as BufferSource));
  } catch {
    throw new WrongKeyError();
  }
}

export const encryptText = (key: CryptoKey, text: string) => encryptBytes(key, encoder.encode(text));
export async function decryptText(key: CryptoKey, box: Box): Promise<string> {
  return decoder.decode(await decryptBytes(key, box));
}
