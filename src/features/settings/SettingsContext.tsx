import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import { setCurrency } from '../../domain/currency';
import { DEFAULT_SETTINGS, type UserSettings } from '../../domain/types';
import { subscribeSettings } from '../../services/profileService';

const SettingsContext = createContext<UserSettings>(DEFAULT_SETTINGS);

/** מספק את הגדרות המשתמש (נוסחאות מעשרות, העברת נטו וכו') לכל המסכים. */
export function SettingsProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(
    () =>
      subscribeSettings(
        uid,
        setSettings,
        // אם הקריאה נכשלה נשארים עם ברירות המחדל ולא מקריסים את האפליקציה.
        () => setSettings(DEFAULT_SETTINGS),
      ),
    [uid],
  );

  // סימן המטבע נקרא ישירות על ידי פונקציות העיצוב, ולכן מעדכנים אותו לפני הציור,
  // והמפתח בונה מחדש את המסכים כשהמטבע מתחלף כדי שכל הסכומים יוצגו בסימן החדש.
  setCurrency(settings.currency);

  return (
    <SettingsContext.Provider value={settings}>
      <Fragment key={settings.currency}>{children}</Fragment>
    </SettingsContext.Provider>
  );
}

export function useSettings(): UserSettings {
  return useContext(SettingsContext);
}
