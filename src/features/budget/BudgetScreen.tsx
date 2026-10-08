import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { currencySymbol } from '../../domain/currency';
import { Amount } from '../../components/Amount';
import { MonthSwitcher } from '../../components/MonthSwitcher';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  BUDGET_STATUS_LABELS,
  budgetDocId,
  budgetUsage,
  buildBudgetRowsFromMap,
  effectiveMonthly,
  overallBudgetId,
  splitBudgets,
} from '../../domain/budget';
import { formatMonthYear } from '../../domain/dates';
import { MAX_TRANSACTION_AGOROT, parseShekelsToAgorot } from '../../domain/money';
import { totalsByCategory } from '../../domain/summary';
import { businessIdOf, inSpace, type Space } from '../../domain/spaces';
import type { Budget, TransactionRecord } from '../../domain/types';
import { useBudgets } from '../../hooks/useBudgets';
import { useAnnualPeriod } from '../../hooks/useAnnualPeriod';
import { useCategories } from '../../hooks/useCategories';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { deleteBudget, saveBudget } from '../../services/budgetService';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
import { useSyncNotice } from '../sync/SyncNotice';

/**
 * תקציב לפי קטגוריית הוצאה ותקציב כללי (נפרד לכל עסק ולמשק הבית).
 * חודשי: תקציב קבוע לכל החודשים, ואפשר לקבוע לחודש מסוים תקציב מיוחד שדורס את הקבוע באותו חודש.
 * שנתי: תקציב לכל שנה בנפרד, והניצול מחושב מהוצאות השנה.
 */
export function BudgetScreen() {
  return <BudgetContent space={useSpace()} />;
}

type Mode = 'monthly' | 'annual';
type Target = 'general' | 'period';

function BudgetContent({ space }: { space: Space }) {
  const scope = space.scope;
  const { nameOf } = useSpaces();
  const { user } = useReadyAuth();
  const month = useMonth();
  const { reportFailure } = useSyncNotice();
  const { categories } = useCategories(user.uid);
  const { budgets, loading: budgetsLoading, error: budgetsError } = useBudgets(user.uid);
  const [mode, setMode] = useState<Mode>('monthly');
  const [editing, setEditing] = useState<string | null>(null);

  const settings = useSettings();
  const { period: annual, ready: annualReady } = useAnnualPeriod(user.uid, scope, month.selected, settings.annualMode);
  const monthlyTx = useMonthTransactions(user.uid, scope, month.selected, mode === 'monthly');
  const yearTx = useTransactionsUpTo(user.uid, scope, annual.endYm, mode === 'annual' && annualReady);

  const ofSpace = (items: readonly TransactionRecord[]) =>
    items.filter((t) => scope === 'household' || businessIdOf(t) === space.businessId);
  const transactions = mode === 'monthly' ? monthlyTx : yearTx;
  const periodItems = useMemo(() => {
    const own = ofSpace(transactions.items);
    return mode === 'monthly' ? own : own.filter((t) => annual.months.includes(t.yearMonth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.items, mode, annual, scope, space.businessId]);

  const period = mode === 'monthly' ? month.selected : annual.id;
  const overallId = overallBudgetId(scope, space.businessId);

  // תקציב מחושב לתקופה שמוצגת: קבוע + דריסות (חודשי), או תקציבי השנה (שנתי)
  const view = useMemo(() => {
    if (mode === 'monthly') {
      const e = effectiveMonthly(budgets, scope, space.businessId, month.selected);
      const general = splitBudgets(budgets, scope, space.businessId);
      const own = splitBudgets(budgets, scope, space.businessId, month.selected);
      return {
        overall: e.overallAgorot,
        byCategory: e.byCategory,
        categoriesTotal: e.categoriesTotalAgorot,
        general,
        own,
      };
    }
    const annualSplit = splitBudgets(budgets, scope, space.businessId, annual.id);
    return {
      overall: annualSplit.overallAgorot,
      byCategory: annualSplit.byCategory,
      categoriesTotal: annualSplit.categoriesTotalAgorot,
      general: annualSplit,
      own: annualSplit,
    };
  }, [mode, budgets, scope, space.businessId, month.selected, annual.id]);

  const expenseByCategory = useMemo(() => totalsByCategory(periodItems, 'expense'), [periodItems]);
  const totalExpenses = useMemo(
    () => [...expenseByCategory.values()].reduce((a, b) => a + b, 0),
    [expenseByCategory],
  );
  const rows = useMemo(
    () =>
      buildBudgetRowsFromMap(
        categories.filter((c) => inSpace(c, space)),
        view.byCategory,
        expenseByCategory,
      ),
    [categories, space, view.byCategory, expenseByCategory],
  );
  const categoriesUsed = useMemo(() => {
    let used = 0;
    for (const row of rows) if (row.usage) used += row.usedAgorot;
    return used;
  }, [rows]);

  const loading = budgetsLoading || transactions.loading || (mode === 'annual' && !annualReady);
  const failSave = () => reportFailure('לא הצלחנו לסנכרן את התקציב. יש לנסות שוב.');
  const failRemove = () => reportFailure('לא הצלחנו לסנכרן את מחיקת התקציב.');

  const docOf = (baseId: string, per?: string): Budget | undefined =>
    budgets.find((b) => b.id === budgetDocId(baseId, per) && inSpace(b, space));

  const save = (baseId: string, target: Target, amountAgorot: number) => {
    const per = mode === 'annual' ? period : target === 'period' ? period : undefined;
    saveBudget(user.uid, scope, baseId, amountAgorot, docOf(baseId, per)?.createdAt, space.businessId, per).catch(failSave);
  };
  const remove = (baseId: string, target: Target) => {
    const per = mode === 'annual' ? period : target === 'period' ? period : undefined;
    deleteBudget(user.uid, baseId, per).catch(failRemove);
  };

  const monthly = mode === 'monthly';
  const periodLabel = monthly ? formatMonthYear(month.selected) : annual.label;
  const generalOf = (baseId: string, isOverall: boolean): number | null =>
    isOverall ? view.general.overallAgorot : (view.general.byCategory.get(baseId) ?? null);
  const ownOf = (baseId: string, isOverall: boolean): number | null =>
    isOverall ? view.own.overallAgorot : (view.own.byCategory.get(baseId) ?? null);

  // תקציב שנתי של שנה נוכחית: כמה אפשר להוציא בכל חודש שנשאר
  const monthsLeftInYear = (() => {
    const idx = annual.months.indexOf(month.current);
    return idx >= 0 ? 12 - idx : null;
  })();

  const lineProps = (baseId: string, isOverall: boolean, used: number) => ({
    used,
    // בחודשי: "קבוע" הוא התקציב לכל החודשים ו"תקופה" הוא הדריסה. בשנתי יש תקציב אחד לשנה.
    generalAmount: generalOf(baseId, isOverall),
    periodAmount: monthly ? ownOf(baseId, isOverall) : null,
    periodLabel: monthly ? periodLabel : null,
    unit: monthly ? ('חודשי' as const) : ('שנתי' as const),
    monthsLeft: monthly ? null : monthsLeftInYear,
    onSave: (target: Target, amount: number) => {
      save(baseId, target, amount);
      setEditing(null);
    },
    onRemove: (target: Target) => {
      remove(baseId, target);
      setEditing(null);
    },
  });

  // "התאמה לסכום התקציבים לפי קטגוריה": נשמר באותה רמה שהקטגוריות בפועל מוגדרות בה
  const matchTarget: Target = monthly && view.own.byCategory.size > 0 ? 'period' : 'general';

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title={`תקציב · ${nameOf(space)}`} />
      <main className="content" aria-busy={loading}>
        <div className="segmented" role="group" aria-label="סוג תקציב">
          {(
            [
              ['monthly', 'חודשי'],
              ['annual', 'שנתי'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={mode === value ? 'is-active' : ''}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setEditing(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <MonthSwitcher label={periodLabel} stepMonths={monthly ? 1 : 12} unit={monthly ? 'חודש' : 'שנה'} />
        <p className="muted small">
          {monthly
            ? 'תקציב קבוע תקף לכל החודשים. אפשר לקבוע לחודש שנבחר תקציב מיוחד שדורס את הקבוע באותו חודש בלבד.'
            : 'תקציב לשנה שנבחרה. הניצול מחושב מכל הוצאות השנה, ומעקב החודשים שנותרו מופיע בשנה הנוכחית.'}
        </p>

        {budgetsError || transactions.error ? (
          <div className="card error-card" role="alert">
            לא הצלחנו לטעון את הנתונים. יש לבדוק את החיבור ולנסות שוב.
          </div>
        ) : loading ? (
          <div className="card notice-card" role="status">
            טוען נתונים…
          </div>
        ) : (
          <>
            <BudgetLine
              key={`overall-${period}-${mode}`}
              id="overall"
              title={monthly ? 'תקציב חודשי כללי' : 'תקציב שנתי כללי'}
              editing={editing === 'overall'}
              onEdit={() => setEditing('overall')}
              onCancel={() => setEditing(null)}
              noBudgetText="לא הוגדר תקציב כללי. אפשר להגדיר אותו גם בלי תקציבים לפי קטגוריה."
              extra={
                view.categoriesTotal > 0 && view.categoriesTotal !== view.overall ? (
                  <>
                    <div className="muted small">
                      סכום התקציבים לפי קטגוריה: <Amount agorot={view.categoriesTotal} />, מתוכם נוצל{' '}
                      <Amount agorot={categoriesUsed} />.
                    </div>
                    <button type="button" className="link-btn" onClick={() => save(overallId, matchTarget, view.categoriesTotal)}>
                      התאמה לסכום התקציבים לפי קטגוריה (<Amount agorot={view.categoriesTotal} />)
                    </button>
                  </>
                ) : view.categoriesTotal > 0 ? (
                  <div className="muted small">
                    סכום התקציבים לפי קטגוריה: <Amount agorot={view.categoriesTotal} />, מתוכם נוצל{' '}
                    <Amount agorot={categoriesUsed} />.
                  </div>
                ) : null
              }
              {...lineProps(overallId, true, totalExpenses)}
            />

            <h2 className="section-title">תקציב לפי קטגוריה</h2>

            <ul className="budget-list">
              {rows.map((row) => (
                <li key={row.categoryId} className="card budget-row">
                  <BudgetLine
                    key={`${row.categoryId}-${period}-${mode}`}
                    id={row.categoryId}
                    bare
                    title={row.categoryName}
                    editing={editing === row.categoryId}
                    onEdit={() => setEditing(row.categoryId)}
                    onCancel={() => setEditing(null)}
                    noBudgetText=""
                    {...lineProps(row.categoryId, false, row.usedAgorot)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

/**
 * שורת תקציב (כללי או קטגוריה): סרגל ניצול, סטטוס ועריכה.
 * חודשי: אפשר לשמור "לכל החודשים" או "לחודש זה בלבד" (דורס את הקבוע).
 * שנתי: תקציב אחד לשנה.
 */
function BudgetLine({
  id,
  title,
  bare,
  used,
  generalAmount,
  periodAmount,
  periodLabel,
  unit,
  monthsLeft,
  editing,
  onEdit,
  onCancel,
  onSave,
  onRemove,
  noBudgetText,
  extra,
}: {
  id: string;
  title: string;
  bare?: boolean;
  used: number;
  generalAmount: number | null;
  periodAmount: number | null;
  /** null = אין בחירה בין קבוע לתקופה (תקציב שנתי) */
  periodLabel: string | null;
  unit: 'חודשי' | 'שנתי';
  monthsLeft: number | null;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (target: Target, amountAgorot: number) => void;
  onRemove: (target: Target) => void;
  noBudgetText: string;
  extra?: ReactNode;
}) {
  const choosable = periodLabel !== null;
  const effective = periodAmount ?? generalAmount;
  const overridden = periodAmount !== null;
  const usage = effective === null ? null : budgetUsage(effective, used);
  const percent = usage?.percentUsed ?? 0;

  const [target, setTarget] = useState<Target>('general');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const amountFor = (t: Target): number | null => (t === 'period' ? periodAmount : generalAmount);
  const open = () => {
    const initial: Target = choosable && overridden ? 'period' : 'general';
    setTarget(initial);
    const current = amountFor(initial) ?? (initial === 'period' ? generalAmount : null);
    setText(current === null ? '' : String(current / 100));
    setError('');
    onEdit();
  };
  const pickTarget = (t: Target) => {
    setTarget(t);
    const current = amountFor(t) ?? generalAmount;
    setText(current === null ? '' : String(current / 100));
    setError('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseShekelsToAgorot(text);
    if (amount === null || amount <= 0 || amount > MAX_TRANSACTION_AGOROT) {
      setError('יש להזין סכום תקין גדול מאפס. לדוגמה: 1,500');
      return;
    }
    onSave(target, amount);
  };

  const remainingText =
    usage && monthsLeft !== null && usage.remainingAgorot > 0 ? (
      <div className="muted small">
        עוד {monthsLeft} חודשים בשנה: עד <Amount agorot={Math.floor(usage.remainingAgorot / monthsLeft)} /> בחודש.
      </div>
    ) : null;

  const body = (
    <>
      <div className="row-between">
        <strong>{title}</strong>
        {usage && <span className={`budget-status budget-${usage.status}`}>{BUDGET_STATUS_LABELS[usage.status]}</span>}
      </div>

      {overridden && choosable && <div className="small tone-gold">תקציב מיוחד לחודש זה</div>}

      {usage ? (
        <>
          <div
            className={`budget-bar budget-${usage.status}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(percent))}
            aria-label={`ניצול תקציב ${title}`}
          >
            <div style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
          <div className="row-between small">
            <span>
              נוצל <Amount agorot={usage.usedAgorot} /> מתוך <Amount agorot={usage.budgetAgorot} /> ({percent}%)
            </span>
            <span className={usage.remainingAgorot < 0 ? 'tone-expense' : 'muted'}>
              {usage.remainingAgorot < 0 ? 'חריגה של ' : 'נותר '}
              <Amount agorot={Math.abs(usage.remainingAgorot)} />
            </span>
          </div>
          {overridden && generalAmount !== null && (
            <div className="muted small">
              התקציב הקבוע לכל החודשים: <Amount agorot={generalAmount} />
            </div>
          )}
          {remainingText}
        </>
      ) : (
        <div className="muted small">
          {noBudgetText && <>{noBudgetText} </>}
          {unit === 'חודשי' ? 'הוצאות החודש' : 'הוצאות השנה'}: <Amount agorot={used} />
        </div>
      )}

      {extra}

      {editing ? (
        <form className="budget-edit" onSubmit={submit} noValidate>
          {choosable && (
            <div className="segmented" role="group" aria-label="תחולת התקציב">
              <button type="button" className={target === 'general' ? 'is-active' : ''} aria-pressed={target === 'general'} onClick={() => pickTarget('general')}>
                לכל החודשים
              </button>
              <button type="button" className={target === 'period' ? 'is-active' : ''} aria-pressed={target === 'period'} onClick={() => pickTarget('period')}>
                לחודש זה בלבד
              </button>
            </div>
          )}
          <label htmlFor={`b-${id}`} className="small">
            {`תקציב ${unit} (${currencySymbol()})`}
          </label>
          <input
            id={`b-${id}`}
            className={`input${error ? ' input-error' : ''}`}
            inputMode="decimal"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <div className="field-error">{error}</div>}
          <div className="budget-actions">
            <button type="submit" className="btn btn-primary">
              שמירה
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              ביטול
            </button>
            {amountFor(target) !== null && (
              <button type="button" className="btn btn-danger-outline" onClick={() => onRemove(target)}>
                {!choosable ? 'הסרת התקציב' : target === 'period' ? 'הסרת התקציב המיוחד (חזרה לקבוע)' : 'הסרת התקציב הקבוע'}
              </button>
            )}
          </div>
        </form>
      ) : (
        <button type="button" className="link-btn" onClick={open}>
          {usage ? 'שינוי תקציב' : 'הגדרת תקציב'}
        </button>
      )}
    </>
  );

  return bare ? body : <section className="card budget-row" aria-label={title}>{body}</section>;
}
