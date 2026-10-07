/**
 * זיכרון "מי המשתמש במכשיר הזה". נשמר רק אימייל ושם פרטי, לצורך הצגה
 * במסך הכניסה. הסיסמה לעולם לא נשמרת על ידי האפליקציה.
 */
const KEY = 'ff.deviceUser';

export interface DeviceUser {
  email: string;
  firstName: string;
}

export function readDeviceUser(): DeviceUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as DeviceUser).email === 'string' &&
      typeof (parsed as DeviceUser).firstName === 'string'
    ) {
      return parsed as DeviceUser;
    }
  } catch {
    // אחסון חסום או נתון פגום: מתייחסים כמכשיר חדש.
  }
  return null;
}

export function saveDeviceUser(user: DeviceUser): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // לא קריטי: המשתמש פשוט יקליד אימייל בכניסה הבאה.
  }
}

export function forgetDeviceUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // התעלמות מכוונת.
  }
}
