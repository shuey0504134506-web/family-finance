import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../domain/types';
import { clearOptimistic, optimisticUser, readOptimistic, saveOptimistic } from './optimisticUser';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

const user = { uid: 'u1', email: 'a@b.c', metadata: { lastSignInTime: 'Mon, 01 Jan 2024 00:00:00 GMT', creationTime: 'x' } } as unknown as User;
const profile = { firstName: 'דנה', lastName: 'כהן', email: 'a@b.c' } as unknown as UserProfile;

describe('פתיחה מהירה מתמונת מצב שמורה', () => {
  it('שומר וקורא משתמש ופרופיל', () => {
    expect(readOptimistic()).toBeNull();
    saveOptimistic(user, profile);
    const s = readOptimistic()!;
    expect(s.uid).toBe('u1');
    const fake = optimisticUser(s);
    expect(fake.uid).toBe('u1');
    expect(fake.email).toBe('a@b.c');
    expect(fake.metadata.lastSignInTime).toContain('2024');
  });
  it('נמחק ביציאה', () => {
    saveOptimistic(user, profile);
    clearOptimistic();
    expect(readOptimistic()).toBeNull();
  });
  it('נתונים פגומים מתעלמים', () => {
    store.set('ff.auth.snapshot', '{bad');
    expect(readOptimistic()).toBeNull();
  });
});
