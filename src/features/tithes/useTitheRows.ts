import { useMemo } from 'react';
import { buildTitheInputs, titheByMonth, titheRecipients, type TitheMonthRow, type TitheRecipient } from '../../domain/tithe';
import { businessIdOf, businessSpace } from '../../domain/spaces';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useSpaces } from '../spaces/SpacesContext';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';

const FAR_FUTURE = '9999-12';

/**
 * שורות המעשרות המצטברות עד סוף החודש הנבחר. משמש את מסך המעשרות ואת כפתור הבית.
 * `enabled` כבוי = לא נטענת היסטוריה (למשל בעסק, שאין בו מעשרות).
 */
export function useTitheRows(enabled: boolean): {
  rows: TitheMonthRow[];
  recipients: TitheRecipient[];
  loading: boolean;
  error: Error | null;
  hasBusiness: boolean;
  hasHousehold: boolean;
} {
  const { user } = useReadyAuth();
  const { spaces, countedIds } = useSpaces();
  const settings = useSettings();
  const month = useMonth();

  const hasHousehold = spaces.some((s) => s.scope === 'household');
  // רק עסקים שנספרים במכשיר הזה נכנסים לבסיס המעשרות, בדיוק כמו בהכנסות משק הבית.
  const hasBusiness = countedIds.length > 0;

  // בחודש הנוכחי (או אחריו) נכללות גם פעולות עם תאריך מאוחר יותר, שכבר הוזנו
  const includeLater = month.selected >= month.current;
  const upTo = includeLater ? FAR_FUTURE : month.selected;
  const household = useTransactionsUpTo(user.uid, 'household', upTo, enabled && hasHousehold);
  const business = useTransactionsUpTo(user.uid, 'business', upTo, enabled && hasBusiness);

  const countedBusinessItems = useMemo(() => {
    const counted = new Set(countedIds);
    return business.items.filter((t) => counted.has(businessIdOf(t)));
  }, [business.items, countedIds]);

  const lastYearMonth = useMemo(() => {
    if (!includeLater) return month.selected;
    let last = month.selected;
    for (const t of household.items) if (t.yearMonth > last) last = t.yearMonth;
    for (const t of countedBusinessItems) if (t.yearMonth > last) last = t.yearMonth;
    return last;
  }, [includeLater, month.selected, household.items, countedBusinessItems]);

  const rows = useMemo(
    () =>
      titheByMonth(
        buildTitheInputs(household.items, countedBusinessItems, {
          lastYearMonth,
          countBusinessTithePayments: settings.countBusinessTithePayments,
          transferMode: settings.businessTransferMode,
        }),
        settings.titheBps,
      ),
    [household.items, countedBusinessItems, lastYearMonth, settings],
  );

  const recipients = useMemo(
    () =>
      titheRecipients([
        ...household.items.map((t) => ({ ...t, space: 'household' })),
        ...(settings.countBusinessTithePayments
          ? countedBusinessItems.map((t) => ({ ...t, space: businessSpace(businessIdOf(t)).key }))
          : []),
      ]),
    [household.items, countedBusinessItems, settings.countBusinessTithePayments],
  );

  return {
    rows,
    recipients,
    loading: enabled && (household.loading || business.loading),
    error: household.error ?? business.error,
    hasBusiness,
    hasHousehold,
  };
}
