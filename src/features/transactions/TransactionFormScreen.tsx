import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { currencySymbol } from '../../domain/currency';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { todayIso } from '../../domain/dates';
import {
  buildTransaction,
  draftFromTransaction,
  validateDraft,
  type DraftErrors,
  type TransactionDraft,
} from '../../domain/transactionInput';
import { businessIdOf, inSpace, type Space } from '../../domain/spaces';
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type Transaction,
  type TransactionType,
} from '../../domain/types';
import { useCategories } from '../../hooks/useCategories';
import { createCategory } from '../../services/categoryService';
import { newId } from '../../services/ids';
import {
  deleteTransaction,
  getTransaction,
  saveTransaction,
} from '../../services/transactionService';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSyncNotice } from '../sync/SyncNotice';

const isType = (value: string | undefined): value is TransactionType =>
  value === 'income' || value === 'expense';

/** הוספה: /:scope/add/:type  |  עריכה: /:scope/edit/:id */
export function TransactionFormScreen({ mode }: { mode: 'add' | 'edit' }) {
  const params = useParams();
  const space = useSpace();

  if (mode === 'add') {
    if (!isType(params.type)) return <Navigate to={`/${space.key}`} replace />;
    return <AddLoader space={space} type={params.type} />;
  }
  if (!params.id) return <Navigate to={`/${space.key}`} replace />;
  return <EditLoader space={space} id={params.id} />;
}

function AddLoader({ space, type }: { space: Space; type: TransactionType }) {
  const month = useMonth();
  // המזהה נוצר פעם אחת בפתיחת הטופס: לחיצה כפולה או ניסיון חוזר לא יוצרים כפילות.
  const [id] = useState(newId);
  const initial = useMemo<TransactionDraft>(
    () => ({
      type,
      amountText: '',
      date: month.selected === month.current ? todayIso() : `${month.selected}-01`,
      counterparty: '',
      categoryId: '',
      paymentMethod: 'cash',
      note: '',
      titheStatus: 'liable',
      isTithePayment: false,
    }),
    // ערכי ברירת המחדל נקבעים פעם אחת בפתיחה. שינוי חודש בזמן הקלדה לא יאפס את הטופס.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return <TransactionForm space={space} id={id} initial={initial} existing={null} />;
}

function EditLoader({ space, id }: { space: Space; id: string }) {
  const { user } = useReadyAuth();
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; tx: Transaction }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getTransaction(user.uid, space.scope, id)
      .then((tx) => {
        // פעולה של עסק אחר אינה נפתחת מתוך עסק זה (היא הייתה "עוברת" אליו בשמירה).
        const mine = tx && (space.scope === 'household' || businessIdOf(tx) === space.businessId);
        if (!cancelled) setState(tx && mine ? { kind: 'ready', tx } : { kind: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [user.uid, space.scope, space.businessId, id]);

  if (state.kind === 'loading') {
    return (
      <div className="app-shell">
        <ScreenHeader title="עריכת פעולה" />
        <main className="content">
          <div className="card notice-card" role="status">
            טוען…
          </div>
        </main>
      </div>
    );
  }
  if (state.kind !== 'ready') {
    return (
      <div className="app-shell">
        <ScreenHeader title="עריכת פעולה" />
        <main className="content">
          <div className="card error-card" role="alert">
            {state.kind === 'missing'
              ? 'הפעולה לא נמצאה. ייתכן שנמחקה.'
              : 'לא הצלחנו לטעון את הפעולה. יש לבדוק את החיבור ולנסות שוב.'}
          </div>
        </main>
      </div>
    );
  }
  return (
    <TransactionForm
      space={space}
      id={state.tx.id}
      initial={draftFromTransaction(state.tx)}
      existing={state.tx}
    />
  );
}

function TransactionForm({
  space,
  id,
  initial,
  existing,
}: {
  space: Space;
  id: string;
  initial: TransactionDraft;
  existing: Transaction | null;
}) {
  const navigate = useNavigate();
  const { user } = useReadyAuth();
  const month = useMonth();
  const scope = space.scope;
  const { reportFailure } = useSyncNotice();
  const { categories, loading: categoriesLoading } = useCategories(user.uid);

  const [draft, setDraft] = useState<TransactionDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // מונע שליחה כפולה גם אם לוחצים מהר מכפי שהמסך מתעדכן.
  const submitted = useRef(false);

  // קטגוריות שנוספו עכשיו מהטופס, כדי שיופיעו מיד גם לפני שהמנוי מתעדכן
  const [added, setAdded] = useState<Array<{ id: string; name: string }>>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');

  const options = useMemo(() => {
    const base = categories
      .filter(
        (c) =>
          inSpace(c, space) &&
          c.type === draft.type &&
          // קטגוריה שהושבתה נשארת זמינה לפעולה שכבר משתמשת בה
          (c.active || c.id === existing?.categoryId),
      )
      .map((c) => ({ id: c.id, name: c.name }));
    const known = new Set(base.map((c) => c.id));
    return [...base, ...added.filter((c) => !known.has(c.id))];
  }, [categories, space, draft.type, existing?.categoryId, added]);

  const onAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return setCategoryError('יש להזין שם לקטגוריה.');
    if (name.length > 60) return setCategoryError('השם ארוך מדי (עד 60 תווים).');
    const same = options.find((c) => c.name.trim() === name);
    if (same) {
      // כבר קיימת קטגוריה בשם הזה: בוחרים אותה במקום ליצור כפילות
      update('categoryId', same.id);
    } else {
      const sortOrder =
        Math.max(-1, ...categories.filter((c) => inSpace(c, space) && c.type === draft.type).map((c) => c.sortOrder)) + 1;
      const { id, saved } = createCategory(user.uid, scope, draft.type, name, sortOrder, space.businessId);
      saved.catch(() => reportFailure('לא הצלחנו לסנכרן את הקטגוריה החדשה. יש לנסות שוב.'));
      setAdded((previous) => [...previous, { id, name }]);
      update('categoryId', id);
    }
    setNewCategoryName('');
    setCategoryError('');
    setAddingCategory(false);
  };

  const isIncome = draft.type === 'income';
  const title = `${existing ? 'עריכת' : 'הוספת'} ${isIncome ? 'הכנסה' : 'הוצאה'}`;

  const update = <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const leave = (targetMonth?: string) => {
    if (targetMonth) month.setMonth(targetMonth);
    if (window.history.length > 1) navigate(-1);
    else navigate(`/${space.key}`, { replace: true });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (submitted.current) return;

    const found = validateDraft(draft, options.map((c) => c.id));
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const category = options.find((c) => c.id === draft.categoryId);
    if (!category) return;

    const transaction = buildTransaction(draft, {
      id,
      categoryName: category.name,
      now: Date.now(),
      createdAt: existing?.createdAt,
      businessId: space.businessId,
    });

    submitted.current = true;
    // לא ממתינים לשרת: בלי אינטרנט ההבטחה מתממשת רק בסנכרון. הפעולה נשמרת במכשיר
    // ומופיעה מיד ברשימה כ"ממתין לסנכרון". אם השרת דוחה אותה, מציגים הודעה.
    saveTransaction(user.uid, scope, transaction).catch(() =>
      reportFailure('לא הצלחנו לסנכרן פעולה אחרונה, והיא לא נשמרה בשרת. יש לבדוק ולהזין אותה שוב.'),
    );
    leave(transaction.yearMonth);
  };

  const onDelete = () => {
    if (!existing || submitted.current) return;
    submitted.current = true;
    deleteTransaction(user.uid, scope, existing.id).catch(() =>
      reportFailure('לא הצלחנו לסנכרן את המחיקה. הפעולה עשויה להופיע שוב.'),
    );
    leave();
  };

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title={title} />
      <main className="content">
        <form className="card form-card" onSubmit={onSubmit} noValidate>
          <Field
            label={`סכום (${currencySymbol()})`}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!existing}
            placeholder="0.00"
            value={draft.amountText}
            onChange={(e) => update('amountText', e.target.value)}
            error={errors.amount}
          />

          <Field
            label="תאריך"
            type="date"
            value={draft.date}
            onChange={(e) => update('date', e.target.value)}
            error={errors.date}
          />

          <Field
            label={isIncome ? 'מקור ההכנסה / שם הלקוח' : 'שם הספק / בית העסק'}
            autoComplete="off"
            value={draft.counterparty}
            onChange={(e) => update('counterparty', e.target.value)}
            error={errors.counterparty}
          />

          <div className="field">
            <label htmlFor="tx-category">קטגוריה</label>
            <select
              id="tx-category"
              className={`input${errors.category ? ' input-error' : ''}`}
              value={draft.categoryId}
              onChange={(e) => update('categoryId', e.target.value)}
              aria-invalid={errors.category ? true : undefined}
            >
              <option value="">{categoriesLoading ? 'טוען…' : 'בחירת קטגוריה'}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category && <div className="field-error">{errors.category}</div>}
            {addingCategory ? (
              <div className="inline-add">
                <input
                  className={`input${categoryError ? ' input-error' : ''}`}
                  aria-label="שם הקטגוריה החדשה"
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddCategory();
                    }
                  }}
                />
                {categoryError && <div className="field-error">{categoryError}</div>}
                <div className="inline-add-actions">
                  <button type="button" className="btn btn-primary" onClick={onAddCategory}>
                    הוספה
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setAddingCategory(false);
                      setCategoryError('');
                    }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="link-btn" onClick={() => setAddingCategory(true)}>
                <Icon name="plus" /> קטגוריה חדשה
              </button>
            )}
          </div>

          <div className="field">
            <label htmlFor="tx-payment">אמצעי תשלום</label>
            <select
              id="tx-payment"
              className="input"
              value={draft.paymentMethod}
              onChange={(e) => update('paymentMethod', e.target.value as PaymentMethod)}
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>

          {isIncome && scope === 'household' && (
            <div className="field">
              <label htmlFor="tx-tithe-status">חייב במעשר</label>
              <select
                id="tx-tithe-status"
                className="input"
                value={draft.titheStatus}
                onChange={(e) => update('titheStatus', e.target.value === 'exempt' ? 'exempt' : 'liable')}
              >
                <option value="liable">חייב במעשר</option>
                <option value="exempt">פטור ממעשר</option>
              </select>
            </div>
          )}

          {!isIncome && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.isTithePayment}
                onChange={(e) => update('isTithePayment', e.target.checked)}
              />
              <span>זהו תשלום מעשר</span>
            </label>
          )}

          <div className="field">
            <label htmlFor="tx-note">הערה (לא חובה)</label>
            <textarea
              id="tx-note"
              className={`input textarea${errors.note ? ' input-error' : ''}`}
              rows={3}
              value={draft.note}
              onChange={(e) => update('note', e.target.value)}
            />
            {errors.note && <div className="field-error">{errors.note}</div>}
          </div>

          <button type="submit" className="btn btn-primary">
            {existing ? 'שמירת שינויים' : 'שמירה'}
          </button>
        </form>

        {existing &&
          (confirmingDelete ? (
            <div className="card delete-confirm" role="alertdialog" aria-label="אישור מחיקה">
              <p>למחוק את הפעולה? אי אפשר לשחזר אותה.</p>
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                כן, למחוק
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmingDelete(false)}
              >
                ביטול
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmingDelete(true)}>
              מחיקת הפעולה
            </button>
          ))}
      </main>
    </div>
  );
}
