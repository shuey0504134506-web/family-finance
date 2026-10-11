import { useMemo, useState, type FormEvent } from 'react';
import { Amount } from '../../components/Amount';
import { Field } from '../../components/Field';
import { ScreenHeader } from '../../components/ScreenHeader';
import { CURRENCY_CODES, CURRENCY_SYMBOLS, currencyOf, getCurrency, type CurrencyCode } from '../../domain/currency';
import {
  balanceAgorot,
  debtCategories,
  debtTotals,
  isSettled,
  paidAgorot,
  validateDebt,
  validatePayment,
  type Debt,
  type DebtDirection,
} from '../../domain/debt';
import { formatDisplayDate, todayIso } from '../../domain/dates';
import { parseShekelsToAgorot } from '../../domain/money';
import { choiceKey, choiceText, choicesFor, parseChoiceKey, paymentLabelOf } from '../../domain/payment';
import { DEFAULT_BUSINESS_ID, inSpace } from '../../domain/spaces';
import { useCustomMethods } from '../../hooks/useCustomMethods';
import { useDebts } from '../../hooks/useDebts';
import { deleteDebt, saveDebt } from '../../services/debtService';
import { newId } from '../../services/ids';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpace } from '../spaces/SpaceRoute';

type Filter = 'open' | 'settled';

/** חובות של המרחב הנוכחי: "אני חייב" ו"חייבים לי". ספר נפרד, לא נספר בהכנסות, בהוצאות או בתקציב. */
export function DebtsScreen() {
  const { user } = useReadyAuth();
  const space = useSpace();
  const { debts: all, loading, error } = useDebts(user.uid);
  const debts = useMemo(() => all.filter((d) => inSpace(d, space)), [all, space]);
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<Debt | 'new' | null>(null);
  const [failure, setFailure] = useState('');

  const totals = useMemo(() => debtTotals(debts), [debts]);
  const visible = debts.filter((d) => (filter === 'open' ? !isSettled(d) : isSettled(d)));

  const persist = (debt: Debt) => {
    setFailure('');
    saveDebt(user.uid, debt).catch(() => setFailure('לא הצלחנו לשמור. יש לנסות שוב.'));
  };
  const remove = (id: string) => {
    setFailure('');
    deleteDebt(user.uid, id).catch(() => setFailure('לא הצלחנו למחוק. יש לנסות שוב.'));
  };

  return (
    <div className={`app-shell scope-${space.scope}`}>
      <ScreenHeader title="חובות" />
      <main className="content" aria-busy={loading}>
        {error && (
          <div className="card error-card" role="alert">
            לא הצלחנו לטעון את החובות. יש לבדוק את החיבור ולנסות שוב.
          </div>
        )}
        {failure && (
          <div className="form-error" role="alert">
            {failure}
          </div>
        )}

        {editing ? (
          <DebtForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            debts={debts}
            onCancel={() => setEditing(null)}
            onSave={(debt) => {
              persist(debt);
              setEditing(null);
            }}
            spaceBusinessId={space.scope === 'business' ? space.businessId : undefined}
            scope={space.scope}
          />
        ) : (
          <>
            <section className="card" aria-label="סיכום חובות">
              <h2 className="card-title">סיכום יתרות פתוחות</h2>
              {totals.length === 0 ? (
                <p className="muted">אין חובות פתוחים.</p>
              ) : (
                totals.map((t) => (
                  <dl className="detail-list" key={t.currency}>
                    <div>
                      <dt>אני חייב</dt>
                      <dd>
                        <Amount agorot={t.oweAgorot} currency={t.currency} className={t.oweAgorot > 0 ? 'tone-expense' : undefined} />
                      </dd>
                    </div>
                    <div>
                      <dt>חייבים לי</dt>
                      <dd>
                        <Amount agorot={t.owedAgorot} currency={t.currency} className={t.owedAgorot > 0 ? 'tone-income' : undefined} />
                      </dd>
                    </div>
                    <div>
                      <dt>מאזן</dt>
                      <dd>
                        <Amount agorot={t.owedAgorot - t.oweAgorot} currency={t.currency} />
                      </dd>
                    </div>
                  </dl>
                ))
              )}
              <p className="muted small">החובות ותשלומיהם אינם נספרים בהכנסות, בהוצאות, בתקציב ובמעשרות.</p>
            </section>

            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              הוספת חוב
            </button>

            <div className="segmented" role="group" aria-label="סינון חובות">
              {(
                [
                  ['open', 'פתוחים'],
                  ['settled', 'שולמו'],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="card notice-card" role="status">
                טוען…
              </div>
            ) : visible.length === 0 ? (
              <p className="muted">{filter === 'open' ? 'אין חובות פתוחים.' : 'אין חובות ששולמו במלואם.'}</p>
            ) : (
              <ul className="debt-list">
                {visible.map((d) => (
                  <DebtCard key={d.id} debt={d} onEdit={() => setEditing(d)} onChange={persist} onDelete={() => remove(d.id)} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DebtCard({
  debt,
  onEdit,
  onChange,
  onDelete,
}: {
  debt: Debt;
  onEdit: () => void;
  onChange: (debt: Debt) => void;
  onDelete: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState('');
  const code = currencyOf(debt);
  const balance = balanceAgorot(debt);

  const addPayment = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseShekelsToAgorot(amountText);
    const problem = validatePayment(debt, amount, date);
    if (problem || amount === null) return setError(problem ?? '');
    onChange({ ...debt, payments: [...debt.payments, { id: newId(), amountAgorot: amount, date }], updatedAt: Date.now() });
    setPaying(false);
    setAmountText('');
    setError('');
  };

  const removePayment = (id: string) =>
    onChange({ ...debt, payments: debt.payments.filter((p) => p.id !== id), updatedAt: Date.now() });

  return (
    <li className="card debt-card">
      <div className="row-between">
        <strong>{debt.name}</strong>
        <span className={`chip ${debt.direction === 'owe' ? 'tone-expense' : 'tone-income'}`}>
          {debt.direction === 'owe' ? 'אני חייב' : 'חייבים לי'}
        </span>
      </div>
      <div className="muted small">
        {debt.category} · {paymentLabelOf(debt)} · {formatDisplayDate(debt.date)}
        {debt.dueDate ? ` · יעד ${formatDisplayDate(debt.dueDate)}` : ''}
      </div>
      <dl className="detail-list">
        <div>
          <dt>סכום מקורי</dt>
          <dd>
            <Amount agorot={debt.amountAgorot} currency={code} />
          </dd>
        </div>
        <div>
          <dt>שולם</dt>
          <dd>
            <Amount agorot={paidAgorot(debt)} currency={code} />
          </dd>
        </div>
        <div>
          <dt>יתרה</dt>
          <dd>
            <Amount agorot={Math.max(0, balance)} currency={code} />
          </dd>
        </div>
      </dl>
      {debt.note && <p className="muted small">{debt.note}</p>}

      {debt.payments.length > 0 && (
        <ul className="tithe-months" aria-label="היסטוריית תשלומים">
          {debt.payments.map((p) => (
            <li key={p.id}>
              <span>{formatDisplayDate(p.date)}</span>
              <span>
                <Amount agorot={p.amountAgorot} currency={code} />{' '}
                <button type="button" className="link-btn" aria-label="מחיקת תשלום" onClick={() => removePayment(p.id)}>
                  מחיקה
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {paying ? (
        <form onSubmit={addPayment} noValidate className="stack">
          <Field label={`סכום התשלום (${CURRENCY_SYMBOLS[code]})`} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          <Field label="תאריך" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              שמירת תשלום
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPaying(false)}>
              ביטול
            </button>
          </div>
        </form>
      ) : confirming ? (
        <div className="delete-confirm" role="alert">
          <span>למחוק את החוב והיסטוריית התשלומים שלו?</span>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            כן, למחוק
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
            ביטול
          </button>
        </div>
      ) : (
        <div className="form-actions">
          {balance > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAmountText('');
                setPaying(true);
              }}
            >
              רישום תשלום
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            עריכה
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirming(true)}>
            מחיקה
          </button>
        </div>
      )}
    </li>
  );
}

function DebtForm({
  initial,
  debts,
  scope,
  spaceBusinessId,
  onSave,
  onCancel,
}: {
  initial: Debt | null;
  debts: readonly Debt[];
  scope: Debt['scope'];
  spaceBusinessId?: string;
  onSave: (debt: Debt) => void;
  onCancel: () => void;
}) {
  const { user } = useReadyAuth();
  const custom = useCustomMethods(user.uid);
  const [id] = useState(() => initial?.id ?? newId());
  const [direction, setDirection] = useState<DebtDirection>(initial?.direction ?? 'owe');
  const [name, setName] = useState(initial?.name ?? '');
  const [amountText, setAmountText] = useState(initial ? String(initial.amountAgorot / 100) : '');
  const [currency, setCurrency] = useState<CurrencyCode>(initial ? currencyOf(initial) : getCurrency());
  const [category, setCategory] = useState(initial?.category ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [payment, setPayment] = useState(
    choiceKey({ method: initial?.paymentMethod ?? 'cash', label: initial?.paymentLabel }),
  );
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<ReturnType<typeof validateDebt>>({});

  const categories = useMemo(() => debtCategories(debts), [debts]);
  const choice = parseChoiceKey(payment);
  const methods = useMemo(() => choicesFor('expense', custom.expense, choice), [custom.expense, choice]);
  const chosenCategory = addingCategory ? newCategory.trim() : category;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseShekelsToAgorot(amountText);
    const found = validateDebt({
      name,
      amountAgorot: amount,
      category: chosenCategory,
      date,
      dueDate,
      note,
      paymentLabel: choice.label,
    });
    setErrors(found);
    if (Object.keys(found).length > 0 || amount === null) return;
    const now = Date.now();
    // שדות חדשים מושמטים כשהם ברירת מחדל, כדי שכללי Firestore ישנים לא ידחו את השמירה.
    const debt: Debt = {
      id,
      scope,
      ...(spaceBusinessId && scope === 'business' && spaceBusinessId !== DEFAULT_BUSINESS_ID ? { businessId: spaceBusinessId } : {}),
      direction,
      name: name.trim(),
      amountAgorot: amount,
      ...(currency !== getCurrency() ? { currency } : {}),
      category: chosenCategory,
      paymentMethod: choice.method,
      ...(choice.method === 'other' && choice.label ? { paymentLabel: choice.label } : {}),
      date,
      ...(dueDate ? { dueDate } : {}),
      note: note.trim(),
      payments: initial?.payments ?? [],
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(debt);
  };

  return (
    <form className="card stack" onSubmit={submit} noValidate>
      <h2 className="card-title">{initial ? 'עריכת חוב' : 'חוב חדש'}</h2>

      <div className="segmented" role="group" aria-label="סוג החוב">
        {(
          [
            ['owe', 'אני חייב'],
            ['owed', 'חייבים לי'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" className={direction === value ? 'is-active' : ''} aria-pressed={direction === value} onClick={() => setDirection(value)}>
            {label}
          </button>
        ))}
      </div>

      <Field label={direction === 'owe' ? 'למי אני חייב' : 'מי חייב לי'} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <Field label={`סכום (${CURRENCY_SYMBOLS[currency]})`} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} error={errors.amount} />

      <div className="field">
        <span className="field-label" id="debt-currency-label">
          מטבע
        </span>
        <div className="chip-group" role="radiogroup" aria-labelledby="debt-currency-label">
          {CURRENCY_CODES.map((code) => (
            <button key={code} type="button" role="radio" aria-checked={currency === code} className={`chip-option${currency === code ? ' is-active' : ''}`} onClick={() => setCurrency(code)}>
              {CURRENCY_SYMBOLS[code]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="debt-cat-label">
          קטגוריה
        </span>
        <div className={`chip-group${errors.category ? ' chip-group-error' : ''}`} role="radiogroup" aria-labelledby="debt-cat-label">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={!addingCategory && category === c}
              className={`chip-option${!addingCategory && category === c ? ' is-active' : ''}`}
              onClick={() => {
                setAddingCategory(false);
                setCategory(c);
              }}
            >
              {c}
            </button>
          ))}
          <button type="button" className={`chip-option${addingCategory ? ' is-active' : ''}`} onClick={() => setAddingCategory(true)}>
            + חדשה
          </button>
        </div>
        {addingCategory && <Field label="שם הקטגוריה" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />}
        {errors.category && <div className="field-error">{errors.category}</div>}
      </div>

      <div className="field">
        <span className="field-label" id="debt-pay-label">
          צורת תשלום
        </span>
        <div className="chip-group" role="radiogroup" aria-labelledby="debt-pay-label">
          {methods.map((m) => (
            <button key={choiceKey(m)} type="button" role="radio" aria-checked={choiceKey(m) === payment} className={`chip-option${choiceKey(m) === payment ? ' is-active' : ''}`} onClick={() => setPayment(choiceKey(m))}>
              {choiceText(m)}
            </button>
          ))}
        </div>
      </div>

      <Field label="תאריך" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
      <Field label="תאריך יעד לפירעון (לא חובה)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={errors.dueDate} />

      <div className="field">
        <label htmlFor="debt-note">הערה</label>
        <textarea id="debt-note" className="input textarea" value={note} onChange={(e) => setNote(e.target.value)} />
        {errors.note && <div className="field-error">{errors.note}</div>}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          שמירה
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  );
}
