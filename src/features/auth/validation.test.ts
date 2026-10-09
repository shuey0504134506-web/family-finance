import { describe, expect, it } from 'vitest';
import { isValidEmail, validateSignup, type SignupValues } from './validation';

const valid: SignupValues = {
  firstName: 'דנה',
  lastName: 'כהן',
  businessName: 'סטודיו דנה',
  email: 'dana@example.com',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
};

describe('validateSignup', () => {
  it('טופס תקין לא מחזיר שגיאות', () => {
    expect(validateSignup(valid)).toEqual({});
  });

  it('שדות חובה ריקים או עם רווחים בלבד נדחים', () => {
    const errors = validateSignup({ ...valid, firstName: '  ', lastName: '', businessName: ' ' });
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.businessName).toBeUndefined();
  });

  it('סיסמה קצרה נדחית', () => {
    const errors = validateSignup({ ...valid, password: 'short', confirmPassword: 'short' });
    expect(errors.password).toBeDefined();
  });

  it('אימות סיסמה שונה נדחה', () => {
    expect(validateSignup({ ...valid, confirmPassword: 'other-password' }).confirmPassword).toBeDefined();
  });

  it('מייל לא תקין נדחה', () => {
    expect(validateSignup({ ...valid, email: 'not-an-email' }).email).toBeDefined();
    expect(validateSignup({ ...valid, email: '' }).email).toBeDefined();
  });
});

describe('isValidEmail', () => {
  it('מזהה כתובות תקינות ולא תקינות', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
});
