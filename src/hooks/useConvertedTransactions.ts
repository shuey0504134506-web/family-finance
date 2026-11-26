import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { applyConversion, datesNeedingRates, type Converted } from '../domain/fx';
import type { TransactionRecord } from '../domain/types';
import { getRatesFor, ratesVersion, requestRates, subscribeRates } from '../services/historicalRates';
import { useReadyAuth } from '../features/auth/AuthContext';

/**
 * ממיר פעולות במטבע זר למטבע הראשי לפי שער יום הפעולה, ומביא את השערים החסרים.
 * עד שהשער מגיע, הפעולה הזרה לא נכנסת לסכומים (ולא מנחשים שער).
 */
export function useConvertedTransactions(all: TransactionRecord[]): Converted {
  const {user}=useReadyAuth();
  const manualUid=(user as {offlineOnly?:boolean}).offlineOnly ? user.uid : undefined;
  const version = useSyncExternalStore(subscribeRates, ratesVersion);
  const dates = useMemo(() => datesNeedingRates(all), [all]);
  useEffect(() => {
    if (dates.length > 0) requestRates(dates);
  }, [dates, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => applyConversion(all, date=>getRatesFor(date,manualUid)), [all, version, manualUid]);
}
