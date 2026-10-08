import { describe, expect, it } from 'vitest';
import { countedBusinessIds, defaultDisplayPrefs, neighborSpace, parseDisplayPrefs, visibleSpaces } from './display';

const biz = (id: string) => ({ id, name: id, sortOrder: 0, createdAt: 0, updatedAt: 0 });
const businesses = [biz('main'), biz('b2'), biz('b3')];

describe('display prefs', () => {
  it('ברירת מחדל לפי הייעוד הישן', () => {
    expect(defaultDisplayPrefs('both', businesses)).toEqual({ showHousehold: true, hiddenBusinessIds: [], includeHiddenInHousehold: false });
    expect(defaultDisplayPrefs('business', businesses).showHousehold).toBe(false);
    expect(defaultDisplayPrefs('household', businesses).hiddenBusinessIds).toEqual(['main', 'b2', 'b3']);
  });

  it('מציג עסקים ואחריהם משק בית, בלי המוסתרים', () => {
    const spaces = visibleSpaces(businesses, { showHousehold: true, hiddenBusinessIds: ['b2'], includeHiddenInHousehold: false });
    expect(spaces.map((s) => s.key)).toEqual(['business', 'business.b3', 'household']);
  });

  it('אם הכול כבוי מציגים הכול ולא נשארים בלי מסך', () => {
    const spaces = visibleSpaces(businesses, { showHousehold: false, hiddenBusinessIds: ['main', 'b2', 'b3'], includeHiddenInHousehold: false });
    expect(spaces).toHaveLength(4);
  });

  it('עסק מוסתר לא נספר בבית, אלא אם סומן "הכל משתקף"', () => {
    const prefs = { showHousehold: true, hiddenBusinessIds: ['b2'], includeHiddenInHousehold: false };
    expect(countedBusinessIds(businesses, prefs)).toEqual(['main', 'b3']);
    expect(countedBusinessIds(businesses, { ...prefs, includeHiddenInHousehold: true })).toEqual(['main', 'b2', 'b3']);
  });

  it('מכשיר בית בלבד עם "הכל משתקף" סופר את כל העסקים', () => {
    const prefs = defaultDisplayPrefs('household', businesses);
    expect(countedBusinessIds(businesses, prefs)).toEqual([]);
    expect(countedBusinessIds(businesses, { ...prefs, includeHiddenInHousehold: true })).toHaveLength(3);
  });

  it('קריאה סלחנית מהאחסון', () => {
    expect(parseDisplayPrefs(null)).toBeNull();
    expect(parseDisplayPrefs('לא json')).toBeNull();
    expect(parseDisplayPrefs('{"showHousehold":1}')).toBeNull();
    expect(parseDisplayPrefs('{"showHousehold":true,"hiddenBusinessIds":[1]}')).toBeNull();
    expect(parseDisplayPrefs('{"showHousehold":true,"hiddenBusinessIds":["a"]}')).toEqual({
      showHousehold: true,
      hiddenBusinessIds: ['a'],
      includeHiddenInHousehold: false,
    });
  });

  it('שכן להחלקה', () => {
    const spaces = visibleSpaces(businesses, { showHousehold: true, hiddenBusinessIds: [], includeHiddenInHousehold: false });
    expect(neighborSpace(spaces, 'business', 1)?.key).toBe('business.b2');
    expect(neighborSpace(spaces, 'business', -1)).toBeNull();
    expect(neighborSpace(spaces, 'household', 1)).toBeNull();
    expect(neighborSpace(spaces, 'nope', 1)).toBeNull();
  });
});
