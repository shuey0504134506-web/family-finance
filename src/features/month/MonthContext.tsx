import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addMonths,
  currentYearMonth,
  monthStatus,
  type MonthStatus,
  type YearMonth,
} from '../../domain/dates';

interface MonthContextValue {
  /** החודש שהמשתמש צופה בו. כל הנתונים באפליקציה מתייחסים אליו. */
  selected: YearMonth;
  /** החודש הנוכחי האמיתי (מתעדכן אם האפליקציה נשארת פתוחה בחצות) */
  current: YearMonth;
  status: MonthStatus;
  goPrevious: () => void;
  goNext: () => void;
  backToCurrent: () => void;
  setMonth: (ym: YearMonth) => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<YearMonth>(() => currentYearMonth());
  const [selected, setSelected] = useState<YearMonth>(() => currentYearMonth());

  // אם האפליקציה נשארת פתוחה במעבר בין חודשים, "החודש הנוכחי" מתעדכן.
  // מי שצפה בחודש הנוכחי הישן ממשיך אוטומטית לחודש החדש.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = currentYearMonth();
      setCurrent((previous) => {
        if (previous !== now) {
          setSelected((sel) => (sel === previous ? now : sel));
          return now;
        }
        return previous;
      });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const goPrevious = useCallback(() => setSelected((m) => addMonths(m, -1)), []);
  const goNext = useCallback(() => setSelected((m) => addMonths(m, 1)), []);
  const backToCurrent = useCallback(() => setSelected(current), [current]);

  const value = useMemo<MonthContextValue>(
    () => ({
      selected,
      current,
      status: monthStatus(selected, current),
      goPrevious,
      goNext,
      backToCurrent,
      setMonth: setSelected,
    }),
    [selected, current, goPrevious, goNext, backToCurrent],
  );

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth(): MonthContextValue {
  const value = useContext(MonthContext);
  if (!value) throw new Error('useMonth must be used inside MonthProvider');
  return value;
}
