import { useMemo } from 'react';
import { buildTitheInputs, titheByMonth, type TitheMonthRow } from '../../domain/tithe';
import { scopesForMode } from '../../domain/types';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
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
  const { user, profile } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();

  const scopes = scopesForMode(profile.accountMode);
  const hasHousehold = scopes.includes('household');
  const hasBusiness = scopes.includes('business');

  const household = useTransactionsUpTo(user.uid, 'household', month.selected, enabled && hasHousehold);
  const business = useTransactionsUpTo(user.uid, 'business', month.selected, enabled && hasBusiness);

  const rows = useMemo(
    () =>
      titheByMonth(
        buildTitheInputs(household.items, business.items, {
          lastYearMonth: month.selected,
          countBusinessTithePayments: settings.countBusinessTithePayments,
          transferMode: settings.businessTransferMode,
        }),
        settings.titheBps,
      ),
    [household.items, business.items, month.selected, settings],
  );

  return {
    rows,
    loading: enabled && (household.loading || business.loading),
    error: household.error ?? business.error,
    hasBusiness,
    hasHousehold,
  };
}
