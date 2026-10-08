import { useEffect, useMemo, useState } from 'react';
import { annualPeriodOf, type AnnualMode, type AnnualPeriod } from '../domain/annual';
import type { YearMonth } from '../domain/dates';
import type { Scope } from '../domain/types';
import { getFirstTransactionMonth } from '../services/transactionService';

/**
 * התקופה השנתית של החודש הנבחר לפי שיטת החישוב שבהגדרות.
 * בשיטת "12 חודשים מתחילת התיעוד" נקרא החודש של הפעולה הראשונה (פעם אחת לתחום).
 * ready=false עד שהחודש הראשון נקרא, כדי לא להציג חישוב שיתהפך רגע אחר כך.
 */
export function useAnnualPeriod(
  uid: string,
  scope: Scope,
  selected: YearMonth,
  mode: AnnualMode,
): { period: AnnualPeriod; ready: boolean } {
  const key = `${uid}|${scope}`;
  const [first, setFirst] = useState<{ key: string; ym: YearMonth | null } | null>(null);

  useEffect(() => {
    if (mode !== 'from-start') return;
    let cancelled = false;
    getFirstTransactionMonth(uid, scope)
      .then((ym) => !cancelled && setFirst({ key, ym }))
      .catch(() => !cancelled && setFirst({ key, ym: null }));
    return () => {
      cancelled = true;
    };
  }, [uid, scope, key, mode]);

  const loaded = mode === 'calendar' || first?.key === key;
  const firstYm = mode === 'from-start' && first?.key === key ? first.ym : null;
  const period = useMemo(() => annualPeriodOf(selected, mode, firstYm), [selected, mode, firstYm]);
  return { period, ready: loaded };
}
