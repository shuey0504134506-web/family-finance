import { createContext, useContext } from 'react';

/** שם הכפתור והמסך של המדיניות. בחשבון מנותק בתוכנה אין יצירת קשר, ולכן שם אחר. */
export const PRIVACY_LABEL_FULL = 'מדיניות הפרטיות ויצירת קשר';
export const PRIVACY_LABEL_SHORT = 'מדיניות הפרטיות';

export const PrivacyLabelContext = createContext<string>(PRIVACY_LABEL_FULL);

export function usePrivacyLabel(): string {
  return useContext(PrivacyLabelContext);
}
