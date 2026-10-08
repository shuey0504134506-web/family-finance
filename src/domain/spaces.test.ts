import { describe, expect, it } from 'vitest';
import { HOUSEHOLD_SPACE, businessIdOf, businessSpace, inSpace, parseSpaceKey, spaceName, validateSpaceName } from './spaces';

describe('spaces', () => {
  it('העסק הראשון שומר על המפתח המקורי', () => {
    expect(businessSpace('main').key).toBe('business');
    expect(businessSpace('abc').key).toBe('business.abc');
    expect(businessSpace('').businessId).toBe('main');
  });

  it('מפרק מפתחות מהכתובת וחוזר לאותו מרחב', () => {
    expect(parseSpaceKey('household')).toEqual(HOUSEHOLD_SPACE);
    expect(parseSpaceKey('business')).toEqual(businessSpace('main'));
    expect(parseSpaceKey('business.x1')).toEqual(businessSpace('x1'));
    expect(parseSpaceKey('business.')).toBeNull();
    expect(parseSpaceKey('other')).toBeNull();
    expect(parseSpaceKey(undefined)).toBeNull();
  });

  it('פריט ישן בלי מזהה עסק שייך לעסק הראשון', () => {
    expect(businessIdOf({})).toBe('main');
    expect(inSpace({ scope: 'business' }, businessSpace('main'))).toBe(true);
    expect(inSpace({ scope: 'business' }, businessSpace('x'))).toBe(false);
    expect(inSpace({ scope: 'business', businessId: 'x' }, businessSpace('x'))).toBe(true);
    expect(inSpace({ scope: 'business', businessId: 'x' }, HOUSEHOLD_SPACE)).toBe(false);
    expect(inSpace({ scope: 'household' }, HOUSEHOLD_SPACE)).toBe(true);
    expect(inSpace({ scope: 'household' }, businessSpace('main'))).toBe(false);
  });

  it('שם תצוגה', () => {
    const businesses = [{ id: 'main', name: 'נגרות', sortOrder: 0, createdAt: 0, updatedAt: 0 }];
    expect(spaceName(businessSpace('main'), businesses, 'הבית שלי')).toBe('נגרות');
    expect(spaceName(HOUSEHOLD_SPACE, businesses, 'הבית שלי')).toBe('הבית שלי');
    expect(spaceName(businessSpace('zzz'), businesses, 'x')).toBe('עסק');
  });

  it('בדיקת שם', () => {
    expect(validateSpaceName('  ', 'שם עסק')).not.toBeNull();
    expect(validateSpaceName('א'.repeat(61), 'שם עסק')).not.toBeNull();
    expect(validateSpaceName('נגרות', 'שם עסק')).toBeNull();
  });
});
