import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidPhone, normalizePhone, validateSignup, type SignupValues } from './validation';

const valid: SignupValues = {
  firstName: 'דנה',
  lastName: 'כהן',
  businessName: 'סטודיו דנה',
  phone: '050-1234567',
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

describe('טלפון', () => {
  it('טלפון חסר או לא תקין נדחה, וישראלי או בינלאומי תקין', () => {
    expect(validateSignup({ ...valid, phone: '' }).phone).toBeDefined();
    expect(validateSignup({ ...valid, phone: '123' }).phone).toBeDefined();
    expect(validateSignup({ ...valid, phone: 'abc-defg-hij' }).phone).toBeDefined();
    expect(isValidPhone('050-1234567')).toBe(true);
    expect(isValidPhone('03 123 4567')).toBe(true);
    expect(isValidPhone('+1 (212) 555-0100')).toBe(true);
  });

  it('מנרמל לספרות, ושומר + בתחילה', () => {
    expect(normalizePhone(' 050-123 4567 ')).toBe('0501234567');
    expect(normalizePhone('+972 50-123-4567')).toBe('+972501234567');
  });
});
