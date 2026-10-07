import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): UserSettings {
  return useContext(SettingsContext);
}
