import { decryptBytes, decryptText, deriveKey, encryptBytes, encryptText, fromBase64, importKey, randomBytes, toBase64, type Box } from './crypto';
import { answersSecret, type RecoveryQuestion } from './recovery';

/**
 * כספת: קובץ JSON אחד לחשבון.
 * מפתח נתונים אקראי (32 בייט) מצפין את כל המסד. את מפתח הנתונים עצמו עוטפים (מצפינים) פעמיים:
 * פעם עם מפתח שנגזר מהסיסמה, ופעם עם מפתח שנגזר מהתשובות לשאלות השחזור.
 * כך אפשר להחליף סיסמה או לשחזר אותה בלי להצפין מחדש את כל הנתונים.
 */
export interface VaultFile {
  v: 1;
  iterations: number;
  password: { salt: string; wrap: Box };
  recovery?: { salt: string; iterations: number; questions: RecoveryQuestion[]; wrap: Box };
  data: Box;
}

export const DEFAULT_ITERATIONS = 310_000;

async function wrap(dataKey: Uint8Array, secret: string, salt: Uint8Array, iterations: number): Promise<Box> {
  return encryptBytes(await deriveKey(secret, salt, iterations), dataKey);
}

async function unwrap(box: Box, secret: string, salt: string, iterations: number): Promise<Uint8Array> {
  return decryptBytes(await deriveKey(secret, fromBase64(salt), iterations), box);
}

export async function createVault(password: string, plaintext: string, iterations = DEFAULT_ITERATIONS): Promise<{ file: VaultFile; dataKey: Uint8Array }> {
  const dataKey = randomBytes(32);
  const salt = randomBytes(16);
  const file: VaultFile = {
    v: 1,
    iterations,
    password: { salt: toBase64(salt), wrap: await wrap(dataKey, password, salt, iterations) },
    data: await encryptText(await importKey(dataKey), plaintext),
  };
  return { file, dataKey };
}

/** פותח עם סיסמה. זורק WrongKeyError אם הסיסמה שגויה. */
export async function unlockVault(file: VaultFile, password: string): Promise<{ dataKey: Uint8Array; plaintext: string }> {
  const dataKey = await unwrap(file.password.wrap, password, file.password.salt, file.iterations);
  return { dataKey, plaintext: await decryptText(await importKey(dataKey), file.data) };
}

/** מצפין מחדש את הנתונים (iv חדש) ומשאיר את העטיפות כפי שהן. */
export async function sealVault(file: VaultFile, dataKey: Uint8Array, plaintext: string): Promise<VaultFile> {
  return { ...file, data: await encryptText(await importKey(dataKey), plaintext) };
}

export async function changeVaultPassword(file: VaultFile, dataKey: Uint8Array, newPassword: string): Promise<VaultFile> {
  const salt = randomBytes(16);
  return { ...file, password: { salt: toBase64(salt), wrap: await wrap(dataKey, newPassword, salt, file.iterations) } };
}

/** קובע (או מחליף) את שאלות השחזור ואת התשובות שלהן. התשובות עצמן אינן נשמרות. */
export async function setVaultRecovery(
  file: VaultFile,
  dataKey: Uint8Array,
  questions: readonly RecoveryQuestion[],
  answers: readonly string[],
  iterations = file.iterations,
): Promise<VaultFile> {
  if (questions.length !== answers.length) throw new Error('questions/answers mismatch');
  const salt = randomBytes(16);
  return {
    ...file,
    recovery: { salt: toBase64(salt), iterations, questions: [...questions], wrap: await wrap(dataKey, answersSecret(answers), salt, iterations) },
  };
}

/** משחזר את מפתח הנתונים מתשובות השחזור. זורק WrongKeyError אם אחת שגויה. */
export async function recoverVaultKey(file: VaultFile, answers: readonly string[]): Promise<{ dataKey: Uint8Array; plaintext: string }> {
  if (!file.recovery) throw new Error('no-recovery');
  const dataKey = await unwrap(file.recovery.wrap, answersSecret(answers), file.recovery.salt, file.recovery.iterations);
  return { dataKey, plaintext: await decryptText(await importKey(dataKey), file.data) };
}
