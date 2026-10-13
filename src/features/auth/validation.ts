export interface SignupValues {
  firstName: string;
  lastName: string;
  businessName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const MIN_PASSWORD_LENGTH = 8;

/** מספר טלפון בצורה אחידה: ספרות בלבד, עם + בתחילה אם הוזן. מסיר רווחים, מקפים וסוגריים. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** טלפון ישראלי או בינלאומי: בין 9 ל-15 ספרות. */
export function isValidPhone(phone: string): boolean {
  if (!/^[+\d\s\-().]+$/.test(phone.trim())) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** מחזיר שגיאה לכל שדה לא תקין. אובייקט ריק = הכול תקין. */
export function validateSignup(values: SignupValues): Partial<Record<keyof SignupValues, string>> {
  const errors: Partial<Record<keyof SignupValues, string>> = {};
  if (!values.firstName.trim()) errors.firstName = 'יש להזין שם פרטי';
  if (!values.lastName.trim()) errors.lastName = 'יש להזין שם משפחה';
  if (values.businessName.trim().length > 60) errors.businessName = 'שם העסק ארוך מדי (עד 60 תווים)';
  if (!values.phone.trim()) errors.phone = 'יש להזין מספר טלפון';
  else if (!isValidPhone(values.phone)) errors.phone = 'מספר הטלפון אינו תקין';
  if (!values.email.trim()) errors.email = 'יש להזין כתובת מייל';
  else if (!isValidEmail(values.email)) errors.email = 'כתובת המייל אינה תקינה';
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'הסיסמאות אינן זהות';
  }
  return errors;
}
