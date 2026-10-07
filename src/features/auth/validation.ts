export interface SignupValues {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** מחזיר שגיאה לכל שדה לא תקין. אובייקט ריק = הכול תקין. */
export function validateSignup(values: SignupValues): Partial<Record<keyof SignupValues, string>> {
  const errors: Partial<Record<keyof SignupValues, string>> = {};
  if (!values.firstName.trim()) errors.firstName = 'יש להזין שם פרטי';
  if (!values.lastName.trim()) errors.lastName = 'יש להזין שם משפחה';
  if (!values.businessName.trim()) errors.businessName = 'יש להזין שם עסק';
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
