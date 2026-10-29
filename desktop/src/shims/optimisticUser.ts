/**
 * בתוכנה ובגרסת הטלפון הלא מקוונת האימות מקומי ומיידי, ואסור להציג מידע לפני שהוא מסיים (חשבון נעול).
 * לכן הפתיחה המהירה מתמונת מצב שמורה (src/services/optimisticUser.ts) כבויה כאן.
 */
import type { User } from 'firebase/auth';
import type { UserProfile } from '../../../src/domain/types';

export interface OptimisticSnapshot {
  uid: string;
  email: string | null;
  lastSignInTime: string | null;
  creationTime: string | null;
  profile: UserProfile;
}
export const readOptimistic = (): OptimisticSnapshot | null => null;
export const saveOptimistic = (_user: User, _profile: UserProfile): void => undefined;
export const clearOptimistic = (): void => undefined;
export const optimisticUser = (_s: OptimisticSnapshot): User => {
  throw new Error('optimistic user is disabled on desktop');
};
