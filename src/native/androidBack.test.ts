import { describe, expect, it } from 'vitest';
import { isRootRoute } from './androidBack';

describe('isRootRoute', () => {
  it('מסכי שורש', () => {
    for (const hash of ['', '#', '#/', '#/business', '#/household', '#/login', '#/welcome', '#/business.b2']) {
      expect(isRootRoute(hash), hash).toBe(true);
    }
  });

  it('מסכים פנימיים אינם שורש', () => {
    for (const hash of ['#/settings', '#/household/list/income', '#/search', '#/tithes', '#/business/budget', '#/business.b2/budget']) {
      expect(isRootRoute(hash), hash).toBe(false);
    }
  });
});
