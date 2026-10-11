import { describe, expect, it } from 'vitest';
import { parseFormDefaults } from './formDefaults';

describe('parseFormDefaults', () => {
  it('ריק או פגום מחזיר אובייקט ריק', () => {
    expect(parseFormDefaults(null)).toEqual({});
    expect(parseFormDefaults('{bad')).toEqual({});
  });
  it('מקבל רק ערכים מוכרים, לכל מקרה בנפרד', () => {
    expect(
      parseFormDefaults('{"household.income":{"currency":"USD","payment":"transfer"},"business.expense":{"payment":"other:כרטיס חברה"},"business.income":{"currency":"BTC","payment":"gold"}}'),
    ).toEqual({
      'household.income': { currency: 'USD', payment: { method: 'transfer' } },
      'business.expense': { payment: { method: 'other', label: 'כרטיס חברה' } },
    });
  });
});
