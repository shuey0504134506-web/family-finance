import { useMemo, useState, type FormEvent } from 'react';
import { Amount } from '../../components/Amount';
import { MonthSwitcher } from '../../components/MonthSwitcher';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  BUDGET_STATUS_LABELS,
  budgetUsage,
  buildBudgetRows,
  overallBudgetId,
  splitBudgets,
  type BudgetRow,
} from '../../domain/budget';
import { formatMonthYear } from '../../domain/dates';
import { MAX_TRANSACTION_AGOROT, parseShekelsToAgorot } from '../../domain/money';
import { totalsByCategory } from '../../domain/summary';
import { businessIdOf, inSpace, type Space } from '../../domain/spaces';
import { useBudgets } from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { deleteBudget, saveBudget } from '../../services/budgetService';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
import { useSyncNotice } from '../sync/SyncNotice';

/**
 * תקציב חודשי לפי קטגוריית הוצאה (נפרד לעסק ולמשק בית). התקציב קבוע ותקף לכל חודש,
 * והניצול מחושב מהוצאות החודש הנבחר.
 */
export function BudgetScreen() {
  return <BudgetContent space={useSpace()} />;
}

function BudgetContent({ space }: { space: Space }) {
  const scope = space.scope;
  const { nameOf } = useSpaces();
  const { user } = useReadyAuth();
  const month = useMonth();
  const { reportFailure } = useSyncNotice();
  const { categories } = useCategories(user.uid);
  const { budgets, loading: budgetsLoading, error: budgetsError } = useBudgets(user.uid);
  const allTransactions = useMonthTransactions(user.uid, scope, month.selected, true);
  const transactions = useMemo(
    () => ({
      ...allTransactions,
      items: allTransactions.items.filter((t) => scope === 'household' || businessIdOf(t) === space.businessId),
    }),
    [allTransactions, scope, space.businessId],
  );
  const [editing, setEditing] = useState<string | null>(null);

  const split = useMemo(() => splitBudgets(budgets, scope, space.businessId), [budgets, scope, space.businessId]);
  const overallId = overallBudgetId(scope, space.businessId);
  // מסמכי התקציב הפרטניים בלבד (בלי התקציב הכללי)
  const scopeBudgets = useMemo(
    () => budgets.filter((b) => inSpace(b, space) && b.id !== overallId),
    [budgets, space, overallId],
  );
  const expenseByCategory = useMemo(() => totalsByCategory(transactions.items, 'expense'), [transactions.items]);
  const totalExpenses = useMemo(
    () => [...expenseByCategory.values()].reduce((a, b) => a + b, 0),
    [expenseByCategory],
  );
  const rows = useMemo(
    () =>
      buildBudgetRows(
        categories.filter((c) => inSpace(c, space)),
        scopeBudgets,
        expenseByCategory,
      ),
    [categories, space, scopeBudgets, expenseByCategory],
  );

  const totals = useMemo(() => {
    let budget = 0;
    let used = 0;
    for (const row of rows) {
      if (row.usage) {
        budget += row.usage.budgetAgorot;
        used += row.usedAgorot;
      }
    }
    return { budget, used };
  }, [rows]);

  const loading = budgetsLoading || transactions.loading;

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title={`תקציב · ${nameOf(space)}`} />
      <main className="content" aria-busy={loading}>
        <MonthSwitcher label={formatMonthYear(month.selected)} />
        <p className="muted small">תקציב חודשי לכל קטגוריית הוצאה. הניצול מחושב מהוצאות החודש שנבחר.</p>

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
            <OverallBudgetCard
              overallAgorot={split.overallAgorot}
              usedAgorot={totalExpenses}
              categoriesTotalAgorot={split.categoriesTotalAgorot}
              categoriesUsedAgorot={totals.used}
              onSave={(amountAgorot) => {
                const existing = budgets.find((b) => b.id === overallId);
                saveBudget(user.uid, scope, overallId, amountAgorot, existing?.createdAt, space.businessId).catch(() =>
                  reportFailure('לא הצלחנו לסנכרן את התקציב. יש לנסות שוב.'),
                );
              }}
              onRemove={() =>
                deleteBudget(user.uid, overallId).catch(() =>
                  reportFailure('לא הצלחנו לסנכרן את מחיקת התקציב.'),
                )
              }
            />

            <h2 className="section-title">תקציב לפי קטגוריה</h2>

            <ul className="budget-list">
              {rows.map((row) => (
                <li key={row.categoryId} className="card budget-row">
                  <BudgetRowView
                    row={row}
                    editing={editing === row.categoryId}
                    onEdit={() => setEditing(row.categoryId)}
                    onCancel={() => setEditing(null)}
                    onSave={(amountAgorot) => {
                      const existing = scopeBudgets.find((b) => b.categoryId === row.categoryId);
                      saveBudget(user.uid, scope, row.categoryId, amountAgorot, existing?.createdAt, space.businessId).catch(
                        () => reportFailure('לא הצלחנו לסנכרן את התקציב. יש לנסות שוב.'),
                      );
                      setEditing(null);
                    }}
                    onRemove={() => {
                      deleteBudget(user.uid, row.categoryId).catch(() =>
                        reportFailure('לא הצלחנו לסנכרן את מחיקת התקציב.'),
                      );
                      setEditing(null);
                    }}
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
 * תקציב חודשי כללי לתחום. אפשר להגדיר אותו בלי שום תקציב פרטני.
 * הכפתור "התאמה לסכום הפרטניים" מציב כתקציב הכללי את סכום התקציבים לפי קטגוריה.
 * אין חובה שהכללי יהיה שווה לסכום הפרטניים.
 */
function OverallBudgetCard({
  overallAgorot,
  usedAgorot,
  categoriesTotalAgorot,
  categoriesUsedAgorot,
  onSave,
  onRemove,
}: {
  overallAgorot: number | null;
  usedAgorot: number;
  categoriesTotalAgorot: number;
  categoriesUsedAgorot: number;
  onSave: (amountAgorot: number) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const usage = overallAgorot === null ? null : budgetUsage(overallAgorot, usedAgorot);
  const percent = usage?.percentUsed ?? 0;
  const canMatch = categoriesTotalAgorot > 0 && categoriesTotalAgorot !== overallAgorot;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseShekelsToAgorot(text);
    if (amount === null || amount <= 0 || amount > MAX_TRANSACTION_AGOROT) {
      setError('יש להזין סכום תקין גדול מאפס. לדוגמה: 8,000');
      return;
    }
    onSave(amount);
    setEditing(false);
  };

  return (
    <section className="card budget-row" aria-label="תקציב חודשי כללי">
      <div className="row-between">
        <strong>תקציב חודשי כללי</strong>
        {usage && <span className={`budget-status budget-${usage.status}`}>{BUDGET_STATUS_LABELS[usage.status]}</span>}
      </div>

      {usage ? (
        <>
          <div
            className={`budget-bar budget-${usage.status}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(percent))}
            aria-label="ניצול התקציב הכללי"
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
        </>
      ) : (
        <div className="muted small">
          לא הוגדר תקציב כללי. אפשר להגדיר אותו גם בלי תקציבים לפי קטגוריה. הוצאות החודש:{' '}
          <Amount agorot={usedAgorot} />
        </div>
      )}

      {categoriesTotalAgorot > 0 && (
        <div className="muted small">
          סכום התקציבים לפי קטגוריה: <Amount agorot={categoriesTotalAgorot} />, מתוכם נוצל{' '}
          <Amount agorot={categoriesUsedAgorot} />.
        </div>
      )}

      {editing ? (
        <form className="budget-edit" onSubmit={submit} noValidate>
          <label htmlFor="overall-budget" className="small">
            תקציב חודשי כללי (₪)
          </label>
          <input
            id="overall-budget"
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
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              ביטול
            </button>
            {usage && (
              <button
                type="button"
                className="btn btn-danger-outline"
                onClick={() => {
                  onRemove();
                  setEditing(false);
                }}
              >
                הסרת התקציב הכללי
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="budget-actions">
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setText(overallAgorot === null ? '' : String(overallAgorot / 100));
              setError('');
              setEditing(true);
            }}
          >
            {usage ? 'שינוי התקציב הכללי' : 'הגדרת תקציב כללי'}
          </button>
          {canMatch && (
            <button type="button" className="link-btn" onClick={() => onSave(categoriesTotalAgorot)}>
              התאמה לסכום התקציבים לפי קטגוריה (<Amount agorot={categoriesTotalAgorot} />)
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function BudgetRowView({
  row,
  editing,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  row: BudgetRow;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (amountAgorot: number) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const usage = row.usage;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseShekelsToAgorot(text);
    if (amount === null || amount <= 0 || amount > MAX_TRANSACTION_AGOROT) {
      setError('יש להזין סכום תקין גדול מאפס. לדוגמה: 1,500');
      return;
    }
    onSave(amount);
  };

  const percent = usage?.percentUsed ?? 0;

  return (
    <>
      <div className="row-between">
        <strong>{row.categoryName}</strong>
        {usage && <span className={`budget-status budget-${usage.status}`}>{BUDGET_STATUS_LABELS[usage.status]}</span>}
      </div>

      {usage ? (
        <>
          <div
            className={`budget-bar budget-${usage.status}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(percent))}
            aria-label={`ניצול תקציב ${row.categoryName}`}
          >
            <div style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
          <div className="row-between small">
            <span>
              <Amount agorot={usage.usedAgorot} /> מתוך <Amount agorot={usage.budgetAgorot} /> ({percent}%)
            </span>
            <span className={usage.remainingAgorot < 0 ? 'tone-expense' : 'muted'}>
              {usage.remainingAgorot < 0 ? 'חריגה של ' : 'נותר '}
              <Amount agorot={Math.abs(usage.remainingAgorot)} />
            </span>
          </div>
        </>
      ) : (
        <div className="muted small">
          לא הוגדר תקציב. הוצאות החודש: <Amount agorot={row.usedAgorot} />
        </div>
      )}

      {editing ? (
        <form className="budget-edit" onSubmit={submit} noValidate>
          <label htmlFor={`b-${row.categoryId}`} className="small">
            תקציב חודשי (₪)
          </label>
          <input
            id={`b-${row.categoryId}`}
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
            {usage && (
              <button type="button" className="btn btn-danger-outline" onClick={onRemove}>
                הסרת תקציב
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setText(usage ? String(usage.budgetAgorot / 100) : '');
            setError('');
            onEdit();
          }}
        >
          {usage ? 'שינוי תקציב' : 'הגדרת תקציב'}
        </button>
      )}
    </>
  );
}
