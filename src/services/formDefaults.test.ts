import { describe, expect, it } from 'vitest';
import { parseFormDefaults } from './formDefaults';

describe('parseFormDefaults', () => {
  it('ריק או פגום מחזיר אובייקט ריק', () => {
    expect(parseFormDefaults(null)).toEqual({});
    expect(parseFormDefaults('{bad')).toEqual({});
  });
  it('מקבל רק ערכים מוכרים', () => {
    expect(parseFormDefaults('{"currency":"USD","paymentMethod":"credit"}')).toEqual({ currency: 'USD', paymentMethod: 'credit' });
    expect(parseFormDefaults('{"currency":"BTC","paymentMethod":"gold"}')).toEqual({});
  });
});
