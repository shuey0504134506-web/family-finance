import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AttachmentsField } from './AttachmentsField';
import { getAttachments, saveAttachments } from '../../services/attachmentService';
import { useCustomMethods } from '../../hooks/useCustomMethods';
import { choiceKey, choiceText, choicesFor, validateCustomMethod, type PaymentChoice } from '../../domain/payment';
import { saveCustomMethods } from '../../services/paymentMethodsService';
import { defaultsKey, readFormDefaults } from '../../services/formDefaults';
import { CURRENCY_CODES, CURRENCY_SYMBOLS, currencySymbol, getCurrency } from '../../domain/currency';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CategoryChip } from '../../components/CategoryChip';
import { CategoryDialog } from '../../components/CategoryDialog';
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
  type Transaction,
  type TransactionType,
} from '../../domain/types';
import { useCategories } from '../../hooks/useCategories';
import { createCategory, deleteCategory, updateCategory } from '../../services/categoryService';
import { newId } from '../../services/ids';
import {
  getTransaction,
  saveTransaction,
} from '../../services/transactionService';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
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
  const formDefault = useMemo(() => readFormDefaults()[defaultsKey(space.scope, type)] ?? {}, [space.scope, type]);
  const initial = useMemo<TransactionDraft>(
    () => ({
      type,
      amountText: '',
      date: month.selected === month.current ? todayIso() : `${month.selected}-01`,
      counterparty: '',
      categoryId: '',
      paymentMethod: formDefault.payment?.method ?? 'cash',
      paymentLabel: formDefault.payment?.label ?? '',
      note: '',
      titheStatus: 'liable',
      isTithePayment: false,
      currency: formDefault.currency ?? getCurrency(),
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
  const { nameOf } = useSpaces();
  const month = useMonth();
  const scope = space.scope;
  const { reportFailure } = useSyncNotice();
  const { categories, loading: categoriesLoading } = useCategories(user.uid);

  const [draft, setDraft] = useState<TransactionDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  // מונע שליחה כפולה גם אם לוחצים מהר מכפי שהמסך מתעדכן.
  const submitted = useRef(false);
  // פרטים נוספים (תאריך, מטבע, אמצעי תשלום, מעשר) מוסתרים בהוספה, ופתוחים בעריכה.
  const [showDetails, setShowDetails] = useState(existing !== null);

  // תמונות מצורפות (קבלה, תלוש). בעריכה נטענות מהחשבון; נשמרות רק אם השתנו ורק אם נטענו בהצלחה.
  const [attachments, setAttachments] = useState<string[]>([]);
  const savedAttachments = useRef<string[]>([]);
  const [attLoading, setAttLoading] = useState(existing !== null);
  const [attFailed, setAttFailed] = useState(false);
  useEffect(() => {
    if (!existing) return undefined;
    let cancelled = false;
    getAttachments(user.uid, id)
      .then((images) => {
        if (cancelled) return;
        savedAttachments.current = images;
        setAttachments(images);
        setAttLoading(false);
        if (images.length > 0) setShowDetails(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAttFailed(true);
        setAttLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.uid, id, existing]);

  // קטגוריות שנוספו עכשיו מהטופס, כדי שיופיעו מיד גם לפני שהמנוי מתעדכן
  const [added, setAdded] = useState<Array<{ id: string; name: string }>>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // צורת תשלום / הכנסה: האפשרויות המובנות, אלה שהוספת, ובעריכה גם הערך השמור.
  const custom = useCustomMethods(user.uid);
  const [addingPayment, setAddingPayment] = useState(false);
  const [newPayment, setNewPayment] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const paymentChoices = useMemo(
    () => choicesFor(draft.type, custom[draft.type], { method: initial.paymentMethod, label: initial.paymentLabel }),
    [draft.type, custom, initial.paymentMethod, initial.paymentLabel],
  );
  const selectPayment = (choice: PaymentChoice) =>
    setDraft((d) => ({ ...d, paymentMethod: choice.method, paymentLabel: choice.label ?? '' }));
  const onAddPayment = () => {
    const problem = validateCustomMethod(newPayment, custom[draft.type], draft.type);
    if (problem) return setPaymentError(problem);
    const name = newPayment.trim();
    saveCustomMethods(user.uid, { ...custom, [draft.type]: [...custom[draft.type], name] }).catch(() =>
      reportFailure('לא הצלחנו לשמור את האמצעי החדש. יש לנסות שוב.'),
    );
    selectPayment({ method: 'other', label: name });
    setNewPayment('');
    setPaymentError('');
    setAddingPayment(false);
  };

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

  // הקטגוריה האחרונה שבה השתמשו בסוג הזה מופיעה ראשונה (בלי לבחור אותה מראש)
  const lastKey = `ff.lastCategory.v1.${space.key}.${draft.type}`;
  const orderedOptions = useMemo(() => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(lastKey);
    } catch {
      last = null;
    }
    const first = options.find((c) => c.id === last);
    return first ? [first, ...options.filter((c) => c.id !== first.id)] : options;
  }, [options, lastKey]);

  const [managing, setManaging] = useState<string | null>(null);
  const managed = managing ? categories.find((c) => c.id === managing) : undefined;
  const failCategory = () => reportFailure('לא הצלחנו לסנכרן את שינוי הקטגוריות. יש לנסות שוב.');

  const onAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return setCategoryError('יש להזין שם לקטגוריה.');
    if (name.length > 60) return setCategoryError('השם ארוך מדי (עד 60 תווים).');
    const same = options.find((c) => c.name.trim() === name);
    const dormant = categories.find(
      (c) => !c.active && inSpace(c, space) && c.type === draft.type && c.name.trim() === name,
    );
    if (!same && dormant) {
      // קטגוריה מושבתת באותו שם: מפעילים אותה מחדש במקום ליצור כפילות
      updateCategory(user.uid, dormant, { active: true }).catch(failCategory);
      setAdded((previous) => [...previous, { id: dormant.id, name: dormant.name }]);
      update('categoryId', dormant.id);
    } else if (same) {
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
    if (found.date) setShowDetails(true);
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

    try {
      localStorage.setItem(lastKey, category.id);
    } catch {
      // אחסון חסום: רק הסדר לא ייזכר
    }
    submitted.current = true;
    // לא ממתינים לשרת: בלי אינטרנט ההבטחה מתממשת רק בסנכרון. הפעולה נשמרת במכשיר
    // ומופיעה מיד ברשימה כ"ממתין לסנכרון". אם השרת דוחה אותה, מציגים הודעה.
    saveTransaction(user.uid, scope, transaction).catch(() =>
      reportFailure('לא הצלחנו לסנכרן פעולה אחרונה, והיא לא נשמרה בשרת. יש לבדוק ולהזין אותה שוב.'),
    );
    if (!attLoading && !attFailed && JSON.stringify(attachments) !== JSON.stringify(savedAttachments.current)) {
      saveAttachments(user.uid, id, attachments).catch(() =>
        reportFailure('לא הצלחנו לשמור את התמונות המצורפות. יש לנסות שוב.'),
      );
    }
    leave(transaction.yearMonth);
  };

  return (
    <div className={`app-shell scope-${scope}`}>
      <ScreenHeader title={`${title} · ${nameOf(space)}`} />
      <main className="content">
        <form className="card form-card" onSubmit={onSubmit} noValidate>
          <Field
            label={`סכום (${currencySymbol(draft.currency)})`}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!existing}
            placeholder="0.00"
            value={draft.amountText}
            onChange={(e) => update('amountText', e.target.value)}
            error={errors.amount}
          />

          <Field
            label={isIncome ? 'מקור ההכנסה / שם הלקוח' : 'שם הספק / בית העסק'}
            autoComplete="off"
            value={draft.counterparty}
            onChange={(e) => update('counterparty', e.target.value)}
            error={errors.counterparty}
          />

          <div className="field">
            <span className="field-label" id="tx-category-label">
              קטגוריה
            </span>
            <div
              className={`chip-group${errors.category ? ' chip-group-error' : ''}`}
              role="radiogroup"
              aria-labelledby="tx-category-label"
              aria-invalid={errors.category ? true : undefined}
            >
              {categoriesLoading && options.length === 0 && <span className="muted small">טוען…</span>}
              {orderedOptions.map((c) => (
                <CategoryChip
                  key={c.id}
                  label={c.name}
                  selected={draft.categoryId === c.id}
                  onSelect={() => update('categoryId', c.id)}
                  onManage={categories.some((x) => x.id === c.id) ? () => setManaging(c.id) : undefined}
                />
              ))}
            </div>
            {errors.category && <div className="field-error">{errors.category}</div>}
            {managed && (
              <CategoryDialog
                name={managed.name}
                onClose={() => setManaging(null)}
                nameError={(n) => {
                  const name = n.trim();
                  if (!name || name.length > 60) return 'שם לא תקין.';
                  const taken = categories.some(
                    (x) => x.id !== managed.id && inSpace(x, space) && x.type === managed.type && x.name.trim() === name,
                  );
                  return taken ? 'כבר קיימת קטגוריה בשם הזה.' : null;
                }}
                onRename={(n) => {
                  updateCategory(user.uid, managed, { name: n }).catch(failCategory);
                  setAdded((previous) => previous.map((x) => (x.id === managed.id ? { ...x, name: n } : x)));
                }}
                onDelete={() => {
                  if (draft.categoryId === managed.id) update('categoryId', '');
                  setAdded((previous) => previous.filter((x) => x.id !== managed.id));
                  deleteCategory(user.uid, managed.id).catch(failCategory);
                }}
                deleteText="למחוק את הקטגוריה? פעולות שכבר נרשמו בה נשארות עם שמה, והתקציב שלה יימחק."
              />
            )}
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
            <span className="field-label" id="tx-payment-label">
              {isIncome ? 'צורת הכנסה' : 'צורת תשלום'}
            </span>
            <div
              className={`chip-group${errors.paymentMethod ? ' chip-group-error' : ''}`}
              role="radiogroup"
              aria-labelledby="tx-payment-label"
            >
              {paymentChoices.map((choice) => {
                const active = choiceKey(choice) === choiceKey({ method: draft.paymentMethod, label: draft.paymentLabel });
                return (
                  <button
                    key={choiceKey(choice)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`chip-option${active ? ' is-active' : ''}`}
                    onClick={() => selectPayment(choice)}
                  >
                    {choiceText(choice)}
                  </button>
                );
              })}
            </div>
            {errors.paymentMethod && <div className="field-error">{errors.paymentMethod}</div>}
            {addingPayment ? (
              <div className="inline-add">
                <input
                  className={`input${paymentError ? ' input-error' : ''}`}
                  aria-label="שם האמצעי החדש"
                  autoFocus
                  value={newPayment}
                  onChange={(e) => setNewPayment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddPayment();
                    }
                  }}
                />
                {paymentError && <div className="field-error">{paymentError}</div>}
                <div className="inline-add-actions">
                  <button type="button" className="btn btn-primary" onClick={onAddPayment}>
                    הוספה
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setAddingPayment(false);
                      setPaymentError('');
                    }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="link-btn" onClick={() => setAddingPayment(true)}>
                <Icon name="plus" /> אמצעי חדש
              </button>
            )}
          </div>

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

          <button
            type="button"
            className="link-btn details-toggle"
            aria-expanded={showDetails}
            aria-controls="tx-details"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? 'הסתרת פרטים נוספים' : 'פרטים נוספים'}
          </button>
          {showDetails && (
            <div id="tx-details" className="tx-details">
          <Field
            label="תאריך"
            type="date"
            value={draft.date}
            onChange={(e) => update('date', e.target.value)}
            error={errors.date}
          />

          <div className="field">
            <span className="field-label" id="tx-currency-label">
              מטבע
            </span>
            <div className="chip-group" role="radiogroup" aria-labelledby="tx-currency-label">
              {CURRENCY_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={draft.currency === code}
                  className={`chip-option${draft.currency === code ? ' is-active' : ''}`}
                  onClick={() => update('currency', code)}
                >
                  {CURRENCY_SYMBOLS[code]} {code}
                </button>
              ))}
            </div>
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

          <AttachmentsField images={attachments} onChange={setAttachments} loading={attLoading} failed={attFailed} />

            </div>
          )}

          <button type="submit" className="btn btn-primary">
            {existing ? 'שמירת שינויים' : 'שמירה'}
          </button>
        </form>

      </main>
    </div>
  );
}
