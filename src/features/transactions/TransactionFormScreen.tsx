import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Field } from '../../components/Field';
import { ScreenHeader } from '../../components/ScreenHeader';
import { todayIso } from '../../domain/dates';
import {
  buildTransaction,
  draftFromTransaction,
  validateDraft,
  type DraftErrors,
  type TransactionDraft,
} from '../../domain/transactionInput';
import {
  PAYMENT_METHOD_LABELS,
  scopesForMode,
  type PaymentMethod,
  type Scope,
  type Transaction,
  type TransactionType,
} from '../../domain/types';
import { useCategories } from '../../hooks/useCategories';
import { newId } from '../../services/ids';
import {
  deleteTransaction,
  getTransaction,
  saveTransaction,
} from '../../services/transactionService';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSyncNotice } from '../sync/SyncNotice';

const isScope = (value: string | undefined): value is Scope =>
  value === 'business' || value === 'household';
const isType = (value: string | undefined): value is TransactionType =>
  value === 'income' || value === 'expense';

/** הוספה: /:scope/add/:type  |  עריכה: /:scope/edit/:id */
export function TransactionFormScreen({ mode }: { mode: 'add' | 'edit' }) {
  const params = useParams();
  const { profile } = useReadyAuth();

  if (!isScope(params.scope) || !scopesForMode(profile.accountMode).includes(params.scope)) {
    return <Navigate to="/" replace />;
  }
  if (mode === 'add') {
    if (!isType(params.type)) return <Navigate to={`/${params.scope}`} replace />;
    return <AddLoader scope={params.scope} type={params.type} />;
  }
  if (!params.id) return <Navigate to={`/${params.scope}`} replace />;
  return <EditLoader scope={params.scope} id={params.id} />;
}

function AddLoader({ scope, type }: { scope: Scope; type: TransactionType }) {
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
  return <TransactionForm scope={scope} id={id} initial={initial} existing={null} />;
}

function EditLoader({ scope, id }: { scope: Scope; id: string }) {
  const { user } = useReadyAuth();
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; tx: Transaction }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getTransaction(user.uid, scope, id)
      .then((tx) => {
        if (!cancelled) setState(tx ? { kind: 'ready', tx } : { kind: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [user.uid, scope, id]);

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
      scope={scope}
      id={state.tx.id}
      initial={draftFromTransaction(state.tx)}
      existing={state.tx}
    />
  );
}

function TransactionForm({
  scope,
  id,
  initial,
  existing,
}: {
  scope: Scope;
  id: string;
  initial: TransactionDraft;
  existing: Transaction | null;
}) {
  const navigate = useNavigate();
  const { user } = useReadyAuth();
  const month = useMonth();
  const { reportFailure } = useSyncNotice();
  const { categories, loading: categoriesLoading } = useCategories(user.uid);

  const [draft, setDraft] = useState<TransactionDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // מונע שליחה כפולה גם אם לוחצים מהר מכפי שהמסך מתעדכן.
  const submitted = useRef(false);

  const options = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.scope === scope &&
          c.type === draft.type &&
          // קטגוריה שהושבתה נשארת זמינה לפעולה שכבר משתמשת בה
          (c.active || c.id === existing?.categoryId),
      ),
    [categories, scope, draft.type, existing?.categoryId],
  );

  const isIncome = draft.type === 'income';
  const title = `${existing ? 'עריכת' : 'הוספת'} ${isIncome ? 'הכנסה' : 'הוצאה'}`;

  const update = <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const leave = (targetMonth?: string) => {
    if (targetMonth) month.setMonth(targetMonth);
    if (window.history.length > 1) navigate(-1);
    else navigate(`/${scope}`, { replace: true });
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
            label="סכום (₪)"
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
