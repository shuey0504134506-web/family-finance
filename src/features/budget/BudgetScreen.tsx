import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { AppHeader } from '../../components/AppHeader';
import { BUDGET_STATUS_LABELS, buildBudgetRows, type BudgetRow } from '../../domain/budget';
import { formatMonthYear } from '../../domain/dates';
import { MAX_TRANSACTION_AGOROT, parseShekelsToAgorot } from '../../domain/money';
import { totalsByCategory } from '../../domain/summary';
import { scopesForMode, type Scope } from '../../domain/types';
import { useBudgets } from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';
import { useMonthTransactions } from '../../hooks/useMonthTransactions';
import { deleteBudget, saveBudget } from '../../services/budgetService';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { ScreenBack } from '../tithes/ScreenBack';

/**
 * תקציב חודשי לפי קטגוריית הוצאה (נפרד לעסק ולמשק בית). התקציב קבוע ותקף לכל חודש,
 * והניצול מחושב מהוצאות החודש הנבחר.
 */
export function BudgetScreen() {
  const params = useParams();
  const { profile } = useReadyAuth();
  const scope = params.scope as Scope;
  if (
    (scope !== 'business' && scope !== 'household') ||
    !scopesForMode(profile.accountMode).includes(scope)
  ) {
    return <Navigate to="/" replace />;
  }
  return <BudgetContent scope={scope} />;
}

function BudgetContent({ scope }: { scope: Scope }) {
  const { user } = useReadyAuth();
  const month = useMonth();
  const { reportFailure } = useSyncNotice();
  const { categories } = useCategories(user.uid);
  const { budgets, loading: budgetsLoading, error: budgetsError } = useBudgets(user.uid);
  const transactions = useMonthTransactions(user.uid, scope, month.selected, true);
  const [editing, setEditing] = useState<string | null>(null);

  const scopeBudgets = useMemo(() => budgets.filter((b) => b.scope === scope), [budgets, scope]);
  const rows = useMemo(
    () =>
      buildBudgetRows(
        categories.filter((c) => c.scope === scope),
        scopeBudgets,
        totalsByCategory(transactions.items, 'expense'),
      ),
    [categories, scope, scopeBudgets, transactions.items],
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
      <AppHeader />
      <main className="content" aria-busy={loading}>
        <ScreenBack to={`/${scope}`} label="חזרה" />
        <h1 className="scope-title">
          <span aria-hidden="true">🎯</span> תקציב · {scope === 'business' ? 'עסק' : 'משק בית'}
        </h1>
        <p className="muted small">
          תקציב חודשי לכל קטגוריית הוצאה. הניצול מחושב מהוצאות {formatMonthYear(month.selected)}.
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
            {totals.budget > 0 && (
              <section className="card">
                <div className="row-between">
                  <span>סך התקציבים שהוגדרו</span>
                  <Amount agorot={totals.budget} />
                </div>
                <div className="row-between">
                  <span>נוצל מתוכם</span>
                  <Amount agorot={totals.used} />
                </div>
              </section>
            )}

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
                      saveBudget(user.uid, scope, row.categoryId, amountAgorot, existing?.createdAt).catch(
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
