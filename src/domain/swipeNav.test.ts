import { describe, expect, it } from 'vitest';
import { classifySwipe, isSwipeNavigationRoute } from './swipeNav';

describe('classifySwipe', () => {
  it('ימינה = אחורה, שמאלה = קדימה', () => {
    expect(classifySwipe(120, 5, 200)).toBe('back');
    expect(classifySwipe(-120, 5, 200)).toBe('forward');
  });
  it('מתעלם מקצר, מאיטי ומגלילה אנכית', () => {
    expect(classifySwipe(40, 0, 100)).toBeNull();
    expect(classifySwipe(150, 0, 2000)).toBeNull();
    expect(classifySwipe(100, 80, 200)).toBeNull();
    expect(classifySwipe(0, 300, 200)).toBeNull();
  });
});

describe('isSwipeNavigationRoute', () => {
  it('לא פעיל בבית, בכניסה ובטפסים', () => {
    for (const p of ['/', '/business', '/household', '/login', '/welcome', '/business/add/income', '/household/edit/abc', '/business.b2', '/business.b2/add/expense', '/business.b2/edit/x']) {
      expect(isSwipeNavigationRoute(p), p).toBe(false);
    }
  });
  it('פעיל ברשימות, בהגדרות ובשאר המסכים', () => {
    for (const p of ['/business/list/income', '/business.b2/list/income', '/household/budget', '/settings', '/search', '/summary', '/tithes', '/categories', '/privacy']) {
      expect(isSwipeNavigationRoute(p), p).toBe(true);
    }
  });
});
