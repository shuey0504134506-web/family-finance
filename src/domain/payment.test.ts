import { describe, expect, it } from 'vitest';
import { choiceKey, choicesFor, parseChoiceKey, paymentLabelOf, validateCustomMethod } from './payment';

describe('אמצעי תשלום', () => {
  it('בהכנסה שלוש אפשרויות מובנות, ובהוצאה חמש', () => {
    expect(choicesFor('income', []).map(choiceKey)).toEqual(['cash', 'transfer', 'check']);
    expect(choicesFor('expense', []).map(choiceKey)).toEqual(['cash', 'credit', 'direct', 'check', 'transfer']);
  });

  it('אמצעים אישיים מתווספים אחרי המובנים', () => {
    expect(choicesFor('income', ['ביט']).map(choiceKey)).toEqual(['cash', 'transfer', 'check', 'other:ביט']);
  });

  it('בעריכה הערך השמור מופיע גם אם אינו ברשימה (הכנסה ישנה באשראי)', () => {
    const keys = choicesFor('income', [], { method: 'credit' }).map(choiceKey);
    expect(keys).toContain('credit');
  });

  it('מפתח אפשרות הלוך ושוב', () => {
    expect(parseChoiceKey('other:כרטיס חברה')).toEqual({ method: 'other', label: 'כרטיס חברה' });
    expect(parseChoiceKey('cash')).toEqual({ method: 'cash' });
  });

  it('שם תצוגה של אמצעי אישי ושל מובנה', () => {
    expect(paymentLabelOf({ paymentMethod: 'other', paymentLabel: 'ביט' })).toBe('ביט');
    expect(paymentLabelOf({ paymentMethod: 'cash' })).toBe('מזומן');
  });

  it('בדיקת שם חדש', () => {
    expect(validateCustomMethod(' ', [], 'income')).not.toBeNull();
    expect(validateCustomMethod('מזומן', [], 'income')).not.toBeNull();
    expect(validateCustomMethod('ביט', ['ביט'], 'income')).not.toBeNull();
    expect(validateCustomMethod('x'.repeat(31), [], 'income')).not.toBeNull();
    expect(validateCustomMethod('ביט', [], 'income')).toBeNull();
  });
});
