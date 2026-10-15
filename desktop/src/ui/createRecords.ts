import { createUserRecords, type NewAccountInput } from '../../../src/services/profileService';

/** יצירת רשומות החשבון בקוד האפליקציה עצמו (פרופיל, הגדרות, קטגוריות), אל המסד המקומי. */
export const createProfile = (uid: string, input: NewAccountInput): Promise<void> => createUserRecords(uid, input);
