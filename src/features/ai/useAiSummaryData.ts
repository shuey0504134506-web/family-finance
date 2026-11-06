import { useEffect, useMemo, useState } from 'react';
import { addMonths } from '../../domain/dates';
import { buildAiSummary, type MonthTotals } from '../../domain/aiSummary';
import { periodTotals } from '../../domain/periods';
import { businessIdOf } from '../../domain/spaces';
import type { Transaction, TransactionRecord } from '../../domain/types';
import { useConvertedTransactions } from '../../hooks/useConvertedTransactions';
import { subscribeTransactionsSince } from '../../services/standingOrderService';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';

const MONTHS = 6;
const EMPTY: TransactionRecord[] = [];

function useSince(uid: string, scope: 'business' | 'household', startDate: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; items: TransactionRecord[]; error: boolean }>({ key: '', items: EMPTY, error: false });
  const key = `${scope}|${startDate}`;
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeTransactionsSince(
      uid,
      scope,
      startDate,
      (items: Transaction[]) => setState({ key, items: items as TransactionRecord[], error: false }),
      () => setState({ key, items: EMPTY, error: true }),
    );
  }, [uid, scope, startDate, enabled, key]);
  const current = state.key === key;
  const converted = useConvertedTransactions(current ? state.items : EMPTY);
  return { items: converted.items, loading: enabled && !current, error: current && state.error };
}

/**
 * נתוני הסקירה: 6 החודשים שעד החודש הנבחר, של המרחב הנוכחי (במשק הבית כולל נטו העסקים הנספרים, כמו במסך הסיכומים).
 * `build()` מחזיר את הסיכום הקטן שנשלח למודל, ו-ready כשכל הנתונים נטענו.
 */
export function useAiSummaryData(): { ready: boolean; error: boolean; build: () => Record<string, unknown> } {
  const { user } = useReadyAuth();
  const space = useSpace();
  const month = useMonth();
  const settings = useSettings();
  const { countedIds, nameOf } = useSpaces();
  const isBusiness = space.scope === 'business';
  const startYm = addMonths(month.selected, -(MONTHS - 1));
  const startDate = `${startYm}-01`;
  const business = useSince(user.uid, 'business', startDate, isBusiness || countedIds.length > 0);
  const household = useSince(user.uid, 'household', startDate, !isBusiness);

  const months = useMemo(() => Array.from({ length: MONTHS }, (_, i) => addMonths(month.selected, i - (MONTHS - 1))), [month.selected]);
  const businessForCalc = useMemo(() => {
    if (isBusiness) return business.items.filter((t) => businessIdOf(t) === space.businessId);
    const counted = new Set(countedIds);
    return business.items.filter((t) => counted.has(businessIdOf(t)));
  }, [isBusiness, business.items, space.businessId, countedIds]);
  const scopeItems = isBusiness ? businessForCalc : household.items;

  const ready = !business.loading && !household.loading;
  const error = business.error || household.error;
  const name = nameOf(space);
  const build = () => {
    const totals: MonthTotals[] = months.map((ym) => {
      const t = periodTotals(space.scope, household.items, businessForCalc, [ym], settings.businessTransferMode);
      return { yearMonth: ym, incomeAgorot: t.incomeAgorot, expenseAgorot: t.expenseAgorot };
    });
    return buildAiSummary({ spaceName: name, selected: month.selected, months: totals, items: scopeItems, previousMonth: addMonths(month.selected, -1) });
  };
  return { ready, error, build };
}
