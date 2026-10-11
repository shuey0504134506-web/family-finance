import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { applyConversion, datesNeedingRates, type Converted } from '../domain/fx';
import type { TransactionRecord } from '../domain/types';
import { getRatesFor, ratesVersion, requestRates, subscribeRates } from '../services/historicalRates';

/**
 * ממיר פעולות במטבע זר למטבע הראשי לפי שער יום הפעולה, ומביא את השערים החסרים.
 * עד שהשער מגיע, הפעולה הזרה לא נכנסת לסכומים (ולא מנחשים שער).
 */
export function useConvertedTransactions(all: TransactionRecord[]): Converted {
  const version = useSyncExternalStore(subscribeRates, ratesVersion);
  const dates = useMemo(() => datesNeedingRates(all), [all]);
  useEffect(() => {
    if (dates.length > 0) requestRates(dates);
  }, [dates, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => applyConversion(all, getRatesFor), [all, version]);
}
