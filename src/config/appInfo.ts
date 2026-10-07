/**
 * פרטי האפליקציה להצגה (אודות, מדיניות פרטיות).
 * כתובת יצירת קשר לפרטיות לא מוגדרת בקוד: בעל האפליקציה מגדיר אותה ב-.env.
 */
export const APP_NAME = 'ניהול כספים';
export const APP_VERSION = '0.1.0';
export const PRIVACY_CONTACT_EMAIL: string = (import.meta.env.VITE_PRIVACY_CONTACT_EMAIL ?? '').trim();
