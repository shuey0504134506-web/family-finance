import { useMemo } from 'react';
import { buildTitheInputs, titheByMonth, type TitheMonthRow } from '../../domain/tithe';
import { businessIdOf } from '../../domain/spaces';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useSpaces } from '../spaces/SpacesContext';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';

/**
 * שורות המעשרות המצטברות עד סוף החודש הנבחר. משמש את מסך המעשרות ואת כפתור הבית.
 * `enabled` כבוי = לא נטענת היסטוריה (למשל בעסק, שאין בו מעשרות).
 */
export function useTitheRows(enabled: boolean): {
  rows: TitheMonthRow[];
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

  const household = useTransactionsUpTo(user.uid, 'household', month.selected, enabled && hasHousehold);
  const business = useTransactionsUpTo(user.uid, 'business', month.selected, enabled && hasBusiness);

  const countedBusinessItems = useMemo(() => {
    const counted = new Set(countedIds);
    return business.items.filter((t) => counted.has(businessIdOf(t)));
  }, [business.items, countedIds]);

  const rows = useMemo(
    () =>
      titheByMonth(
        buildTitheInputs(household.items, countedBusinessItems, {
          lastYearMonth: month.selected,
          countBusinessTithePayments: settings.countBusinessTithePayments,
          transferMode: settings.businessTransferMode,
        }),
        settings.titheBps,
      ),
    [household.items, countedBusinessItems, month.selected, settings],
  );

  return {
    rows,
    loading: enabled && (household.loading || business.loading),
    error: household.error ?? business.error,
    hasBusiness,
    hasHousehold,
  };
}
