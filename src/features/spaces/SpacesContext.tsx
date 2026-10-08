import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  countedBusinessIds,
  defaultDisplayPrefs,
  visibleSpaces,
  type DisplayPrefs,
} from '../../domain/display';
import {
  DEFAULT_BUSINESS_ID,
  DEFAULT_HOUSEHOLD_NAME,
  spaceName,
  type Business,
  type Space,
} from '../../domain/spaces';
import type { UserProfile } from '../../domain/types';
import { subscribeBusinesses, subscribeHouseholdName } from '../../services/businessService';
import { readDisplayPrefs, writeDisplayPrefs } from '../../services/displayStorage';

interface SpacesValue {
  /** false עד שהעסקים נטענו לראשונה (מהמטמון או מהשרת) */
  ready: boolean;
  /** כל העסקים, כולל מוסתרים */
  businesses: Business[];
  householdName: string;
  /** מה מוצג במכשיר הזה */
  prefs: DisplayPrefs;
  /** המרחבים המוצגים, לפי הסדר */
  spaces: Space[];
  /** העסקים שהכנסתם נכנסת למשק הבית במכשיר הזה */
  countedIds: string[];
  /** מרחב ברירת המחדל בכניסה */
  defaultSpace: Space;
  nameOf: (space: Space) => string;
  setPrefs: (next: DisplayPrefs) => void;
}

const SpacesContext = createContext<SpacesValue | null>(null);

/**
 * מספק את העסקים, שם משק הבית ומה שמוצג במכשיר הזה.
 *
 * עסק ראשון מנתונים ישנים (לפני שנוספה תמיכה בכמה עסקים) אין לו רשומה, והוא נבנה משם העסק
 * שבפרופיל. ברגע שמשנים לו שם נוצרת לו רשומה אמיתית.
 */
export function SpacesProvider({
  uid,
  profile,
  children,
}: {
  uid: string;
  profile: UserProfile;
  children: ReactNode;
}) {
  const [docs, setDocs] = useState<Business[] | null>(null);
  const [householdDocName, setHouseholdDocName] = useState<string | null>(null);
  const [stored, setStored] = useState<DisplayPrefs | null>(() => readDisplayPrefs(uid));

  useEffect(() => subscribeBusinesses(uid, setDocs, () => setDocs((current) => current ?? [])), [uid]);
  // רשת ביטחון: בלי מטמון ובלי חיבור ייתכן שההאזנה לא תחזיר דבר, ואסור להישאר על "טוען" לנצח.
  useEffect(() => {
    const timer = setTimeout(() => setDocs((current) => current ?? []), 3000);
    return () => clearTimeout(timer);
  }, [uid]);
  useEffect(() => subscribeHouseholdName(uid, setHouseholdDocName, () => setHouseholdDocName(null)), [uid]);

  const legacyName = profile.businessName.trim();
  const businesses = useMemo<Business[]>(() => {
    const list = docs ?? [];
    if (list.some((b) => b.id === DEFAULT_BUSINESS_ID) || !legacyName) return list;
    const legacy: Business = {
      id: DEFAULT_BUSINESS_ID,
      name: legacyName,
      sortOrder: -1,
      createdAt: profile.createdAt,
      updatedAt: profile.createdAt,
    };
    return [legacy, ...list];
  }, [docs, legacyName, profile.createdAt]);

  const prefs = useMemo(
    () => stored ?? defaultDisplayPrefs(profile.accountMode, businesses),
    [stored, profile.accountMode, businesses],
  );

  const spaces = useMemo(() => visibleSpaces(businesses, prefs), [businesses, prefs]);
  const countedIds = useMemo(() => countedBusinessIds(businesses, prefs), [businesses, prefs]);
  const householdName = householdDocName ?? DEFAULT_HOUSEHOLD_NAME;

  const setPrefs = useCallback(
    (next: DisplayPrefs) => {
      setStored(next);
      writeDisplayPrefs(uid, next);
    },
    [uid],
  );

  const value = useMemo<SpacesValue>(
    () => ({
      ready: docs !== null,
      businesses,
      householdName,
      prefs,
      spaces,
      countedIds,
      defaultSpace: spaces[0],
      nameOf: (space) => spaceName(space, businesses, householdName),
      setPrefs,
    }),
    [docs, businesses, householdName, prefs, spaces, countedIds, setPrefs],
  );

  return <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>;
}

export function useSpaces(): SpacesValue {
  const value = useContext(SpacesContext);
  if (!value) throw new Error('useSpaces חייב לפעול בתוך SpacesProvider');
  return value;
}
