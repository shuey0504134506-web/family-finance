import { useEffect, useMemo, useRef, useState } from 'react';
import { suppressLock } from '../../services/lockSuppress';
import { Link } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { ScreenHeader } from '../../components/ScreenHeader';
import { formatDisplayDate, todayIso } from '../../domain/dates';
import { normalizeName } from '../../domain/import/match';
import { detectLayout, ROLE_LABELS, withColumn, type ColumnRole, type Layout } from '../../domain/import/layout';
import { parseSheet, type ImportRow } from '../../domain/import/parse';
import { buildImportTransactions, defaultChoice, planRows, rowProblem, type PlannedRow, type RowChoice } from '../../domain/import/plan';
import type { Sheet } from '../../domain/import/text';
import { choiceKey, choiceText, choicesFor } from '../../domain/payment';
import { inSpace } from '../../domain/spaces';
import { useCategories } from '../../hooks/useCategories';
import { useCustomMethods } from '../../hooks/useCustomMethods';
import {
  commitImport,
  IMPORT_ERROR_TEXT,
  ImportReadFailure,
  loadExistingForImport,
  readImportFile,
  type ExistingForImport,
} from '../../services/importService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
import { useSyncNotice } from '../sync/SyncNotice';

const PAGE = 100;
const HISTORY_DAYS = 540;

function shiftDays(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

/** התפקידים שמוצגים לתיקון ידני. */
const EDITABLE_ROLES: ColumnRole[] = ['date', 'description', 'amount', 'debit', 'credit', 'card', 'category', 'details'];

function headerLabels(sheet: Sheet, layout: Layout): string[] {
  const width = Math.max(0, ...sheet.rows.slice(0, 60).map((r) => r.length));
  const head = layout.headerRow >= 0 ? sheet.rows[layout.headerRow] ?? [] : [];
  return Array.from({ length: width }, (_, i) => {
    const text = String(head[i] ?? '').trim();
    return text ? `${i + 1}. ${text}` : `עמודה ${i + 1}`;
  });
}

type Filter = 'all' | 'new' | 'dups' | 'nocat';

export function ImportScreen() {
  const { user } = useReadyAuth();
  const space = useSpace();
  const { nameOf } = useSpaces();
  const { reportFailure } = useSyncNotice();
  const { categories: allCategories } = useCategories(user.uid);
  const custom = useCustomMethods(user.uid);
  const fileInput = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<'pick' | 'review' | 'done'>('pick');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Layout>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<ExistingForImport | null>(null);
  const [existingFailed, setExistingFailed] = useState(false);
  const [choices, setChoices] = useState<Record<string, Partial<RowChoice>>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [result, setResult] = useState<{ saved: number; skipped: number; queued: boolean } | null>(null);

  const categories = useMemo(() => allCategories.filter((c) => c.active && inSpace(c, space)), [allCategories, space]);
  const catOptions = useMemo(() => categories.map((c) => ({ id: c.id, name: c.name, type: c.type })), [categories]);
  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);

  // פריסה וניתוח של כל גיליון
  const analyzed = useMemo(
    () =>
      sheets.map((sheet) => {
        const layout = overrides[sheet.name] ?? detectLayout(sheet.rows);
        return { sheet, layout, rows: layout ? parseSheet(sheet, layout) : ([] as ImportRow[]) };
      }),
    [sheets, overrides],
  );
  const rows = useMemo(() => analyzed.flatMap((a) => a.rows), [analyzed]);
  const range = useMemo(() => {
    if (rows.length === 0) return null;
    const dates = rows.map((r) => r.date).sort();
    return { min: dates[0]!, max: dates[dates.length - 1]! };
  }, [rows]);

  // הפעולות הקיימות: להשוואת כפילויות וללמידת קטגוריות
  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setExisting(null);
    setExistingFailed(false);
    const from = [shiftDays(range.min, -10), shiftDays(todayIso(), -HISTORY_DAYS)].sort()[0]!;
    const to = shiftDays(range.max, 10);
    loadExistingForImport(user.uid, space, from, to)
      .then((list) => !cancelled && setExisting(list))
      .catch(() => {
        if (cancelled) return;
        setExisting([]);
        setExistingFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [range, user.uid, space]);

  const planned = useMemo<PlannedRow[]>(
    () => (existing ? planRows(rows, space.key, existing, catOptions) : []),
    [rows, existing, space.key, catOptions],
  );
  const choiceOf = (p: PlannedRow): RowChoice => ({ ...defaultChoice(p), ...choices[p.id] });

  const stats = useMemo(() => {
    let selected = 0;
    let ready = 0;
    let missing = 0;
    let dups = 0;
    for (const p of planned) {
      const c = { ...defaultChoice(p), ...choices[p.id] };
      if (p.match.level === 'exact' || p.match.level === 'likely') dups++;
      if (!c.selected) continue;
      selected++;
      if (rowProblem(p, c, categoryIds)) missing++;
      else ready++;
    }
    return { selected, ready, missing, dups };
  }, [planned, choices, categoryIds]);

  const visible = useMemo(() => {
    return planned.filter((p) => {
      const c = { ...defaultChoice(p), ...choices[p.id] };
      if (filter === 'new') return p.match.level === 'none' || p.match.level === 'possible';
      if (filter === 'dups') return p.match.level === 'exact' || p.match.level === 'likely' || p.match.level === 'possible';
      if (filter === 'nocat') return !c.categoryId && p.row.currency !== null;
      return true;
    });
  }, [planned, choices, filter]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const read = await readImportFile(file);
      setSheets(read);
      setOverrides({});
      setChoices({});
      setFilter('all');
      setShown(PAGE);
      setFileName(file.name);
      setStage('review');
    } catch (e) {
      setError(e instanceof ImportReadFailure ? IMPORT_ERROR_TEXT[e.code] : IMPORT_ERROR_TEXT.unreadable);
    } finally {
      setBusy(false);
    }
  };

  const patch = (id: string, change: Partial<RowChoice>) => setChoices((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }));

  const setCategory = (p: PlannedRow, categoryId: string) => {
    const key = `${p.row.type}:${normalizeName(p.row.name)}`;
    setChoices((prev) => {
      const next = { ...prev, [p.id]: { ...prev[p.id], categoryId } };
      // אותו עסק בשורות אחרות שעוד לא נבחרה להן קטגוריה ידנית
      for (const q of planned) {
        if (q.id !== p.id && `${q.row.type}:${normalizeName(q.row.name)}` === key && next[q.id]?.categoryId === undefined) {
          next[q.id] = { ...next[q.id], categoryId };
        }
      }
      return next;
    });
  };

  const bulk = (fn: (p: PlannedRow, c: RowChoice) => boolean) => {
    setChoices((prev) => {
      const next = { ...prev };
      for (const p of planned) next[p.id] = { ...next[p.id], selected: fn(p, { ...defaultChoice(p), ...prev[p.id] }) };
      return next;
    });
  };

  const assignMissing = (type: 'income' | 'expense', categoryId: string) => {
    if (!categoryId) return;
    setChoices((prev) => {
      const next = { ...prev };
      for (const p of planned) {
        const c = { ...defaultChoice(p), ...prev[p.id] };
        if (p.row.type === type && !c.categoryId) next[p.id] = { ...next[p.id], categoryId };
      }
      return next;
    });
  };

  const onImport = async () => {
    const items = planned.map((p) => ({ planned: p, choice: choiceOf(p) })).filter(({ planned: p, choice }) => choice.selected && !rowProblem(p, choice, categoryIds));
    const transactions = buildImportTransactions(items, { categories: catOptions, now: Date.now(), businessId: space.scope === 'business' ? space.businessId : undefined });
    if (transactions.length === 0) return;
    setBusy(true);
    try {
      const { outcome, settled } = await commitImport(user.uid, space, transactions);
      settled.catch(() => reportFailure('חלק מהפעולות המיובאות לא נשמרו בשרת. יש לבדוק את החיבור ולנסות שוב: ייבוא חוזר אינו יוצר כפילויות.'));
      setResult({ saved: transactions.length, skipped: stats.selected - transactions.length, queued: outcome === 'queued' });
      setStage('done');
    } catch {
      setError('השמירה נכשלה. יש לנסות שוב: ייבוא חוזר אינו יוצר כפילויות.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStage('pick');
    setSheets([]);
    setOverrides({});
    setChoices({});
    setResult(null);
    setError('');
    setExisting(null);
  };

  const title = `ייבוא נתונים · ${nameOf(space)}`;

  if (stage === 'done' && result) {
    return (
      <div className="app-shell">
        <ScreenHeader title={title} />
        <main className="content">
          <div className="card notice-card" role="status">
            <p className="center-title">{`נשמרו ${result.saved} פעולות`}</p>
            {result.queued ? <p className="muted">אין חיבור מהיר לשרת: הפעולות נשמרו במכשיר ויסונכרנו כשהחיבור יחזור.</p> : null}
            {result.skipped > 0 ? <p className="muted">{`${result.skipped} שורות מסומנות לא יובאו כי חסרה להן קטגוריה. אפשר לייבא שוב את הקובץ: שורות שכבר נשמרו יזוהו ולא יוכפלו.`}</p> : null}
          </div>
          <Link className="btn btn-primary" to={`/${space.key}/list/expense`}>
            לרשימת ההוצאות
          </Link>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            ייבוא קובץ נוסף
          </button>
        </main>
      </div>
    );
  }

  if (stage === 'pick') {
    return (
      <div className="app-shell">
        <ScreenHeader title={title} />
        <main className="content">
          <div className="card stack">
            <p>
              מעלים קובץ תנועות מהבנק או מחברת האשראי (Excel או CSV). האפליקציה מזהה את מבנה הקובץ, משייכת קטגוריות לפי מה שכבר הזנת, ומסמנת שורות שכבר קיימות אצלך. לפני השמירה אפשר לבחור מה לייבא.
            </p>
            <p className="muted small">נתמכים: קובצי xlsx, xls ו-csv, וגם קבצי "אקסל" שהבנק שומר כטבלת HTML. קובצי PDF לא נתמכים. הקובץ נקרא רק במכשיר שלך ואינו נשלח לשום מקום.</p>
            <input ref={fileInput} type="file" hidden accept=".xlsx,.xls,.csv,.txt,.htm,.html,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { suppressLock(); fileInput.current?.click(); }}>
              {busy ? 'קורא…' : 'בחירת קובץ'}
            </button>
            {error ? <div className="field-error" role="alert">{error}</div> : null}
          </div>
        </main>
      </div>
    );
  }

  const unusable = analyzed.filter((a) => !a.layout || (a.rows.length === 0));
  return (
    <div className="app-shell">
      <ScreenHeader title={title} />
      <main className="content imp">
        <div className="card imp-summary">
          <div className="imp-file">{fileName}</div>
          <div className="muted small">
            {range ? `${rows.length} שורות · ${formatDisplayDate(range.min)} – ${formatDisplayDate(range.max)}` : 'לא נמצאו שורות תנועות'}
          </div>
          <button type="button" className="link-btn" onClick={reset}>
            החלפת קובץ
          </button>
        </div>

        {analyzed.map(({ sheet, layout, rows: sheetRows }) =>
          layout ? (
            <details key={sheet.name} className="card imp-columns" open={layout.confidence === 'guess' || sheetRows.length === 0}>
              <summary>
                {`זיהוי עמודות · ${sheet.name} (${sheetRows.length} שורות)`}
                {layout.confidence === 'guess' ? <span className="imp-badge imp-badge-warn">נוחש, יש לאשר</span> : null}
              </summary>
              {layout.confidence === 'guess' ? <p className="muted small">לא זוהו כותרות מוכרות, ולכן העמודות נוחשו לפי התוכן. כדאי לבדוק שהן נכונות.</p> : null}
              <div className="imp-col-grid">
                {EDITABLE_ROLES.map((role) => (
                  <label key={role} className="imp-col-field">
                    <span>{ROLE_LABELS[role]}</span>
                    <select
                      value={layout.columns[role] ?? -1}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [sheet.name]: withColumn(layout, role, Number(e.target.value)) }))}
                    >
                      <option value={-1}>לא קיימת</option>
                      {headerLabels(sheet, layout).map((label, i) => (
                        <option key={i} value={i}>{label}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          ) : null,
        )}
        {unusable.length > 0 ? (
          <div className="card notice-card" role="status">
            {`לא זוהו תנועות בגיליון: ${unusable.map((u) => u.sheet.name).join(', ')}.`}
          </div>
        ) : null}

        {rows.length === 0 ? null : existing === null ? (
          <div className="card notice-card" role="status">בודק מול הפעולות הקיימות…</div>
        ) : (
          <>
            {existingFailed ? <div className="card error-card" role="alert">לא הצלחנו לקרוא את הפעולות הקיימות, ולכן לא נבדקו כפילויות ולא נלמדו קטגוריות.</div> : null}
            {categories.length === 0 ? <div className="card error-card" role="alert">אין קטגוריות. יש להוסיף קטגוריה לפני הייבוא.</div> : null}

            <div className="imp-tools card">
              <div className="imp-tabs" role="tablist" aria-label="סינון שורות">
                {([['all', `הכול (${planned.length})`], ['new', 'חדשות'], ['dups', `קיימות (${stats.dups})`], ['nocat', 'ללא קטגוריה']] as [Filter, string][]).map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={filter === key} className={`imp-tab${filter === key ? ' active' : ''}`} onClick={() => { setFilter(key); setShown(PAGE); }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="imp-bulk">
                <button type="button" className="link-btn" onClick={() => bulk((p, c) => c.selected || p.row.currency !== null)}>סימון הכול</button>
                <button type="button" className="link-btn" onClick={() => bulk(() => false)}>ניקוי</button>
                <button type="button" className="link-btn" onClick={() => bulk((p) => p.match.level === 'none' || p.match.level === 'possible')}>רק חדשות</button>
              </div>
              {(['expense', 'income'] as const).map((type) => {
                const missing = planned.filter((p) => p.row.type === type && !choiceOf(p).categoryId).length;
                if (missing === 0) return null;
                return (
                  <label key={type} className="imp-col-field">
                    <span>{`${missing} ${type === 'expense' ? 'הוצאות' : 'הכנסות'} ללא קטגוריה: שיוך כולן ל…`}</span>
                    <select value="" onChange={(e) => assignMissing(type, e.target.value)}>
                      <option value="">בחירת קטגוריה</option>
                      {categories.filter((c) => c.type === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>

            <ul className="imp-list">
              {visible.slice(0, shown).map((p) => (
                <ImportRowItem
                  key={p.id}
                  planned={p}
                  choice={choiceOf(p)}
                  categories={categories.filter((c) => c.type === p.row.type)}
                  methods={choicesFor(p.row.type, custom[p.row.type], { method: p.row.payment })}
                  problem={rowProblem(p, choiceOf(p), categoryIds)}
                  onSelect={(selected) => patch(p.id, { selected })}
                  onCategory={(id) => setCategory(p, id)}
                  onPayment={(paymentKey) => patch(p.id, { paymentKey })}
                />
              ))}
            </ul>
            {visible.length > shown ? (
              <button type="button" className="btn btn-secondary" onClick={() => setShown((n) => n + PAGE)}>
                {`הצגת עוד (${visible.length - shown})`}
              </button>
            ) : null}
            {visible.length === 0 ? <div className="card notice-card">אין שורות להצגה בסינון הזה.</div> : null}

            <div className="imp-footer">
              {stats.missing > 0 ? <div className="imp-warn" role="status">{`${stats.missing} שורות מסומנות חסרות קטגוריה ולא ייובאו`}</div> : null}
              {error ? <div className="field-error" role="alert">{error}</div> : null}
              <button type="button" className="btn btn-primary" disabled={busy || stats.ready === 0} onClick={() => void onImport()}>
                {busy ? 'שומר…' : `ייבוא ${stats.ready} פעולות`}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const MATCH_TEXT = { exact: 'כבר יובאה', likely: 'כנראה קיימת', possible: 'ייתכן שקיימת', none: '' } as const;

function ImportRowItem({
  planned,
  choice,
  categories,
  methods,
  problem,
  onSelect,
  onCategory,
  onPayment,
}: {
  planned: PlannedRow;
  choice: RowChoice;
  categories: { id: string; name: string }[];
  methods: ReturnType<typeof choicesFor>;
  problem: string | null;
  onSelect: (selected: boolean) => void;
  onCategory: (id: string) => void;
  onPayment: (key: string) => void;
}) {
  const { row, match } = planned;
  const level = match.level;
  const flags = [
    row.cardLumpSum ? 'נראה כחיוב כרטיס אשראי מסכם' : '',
    row.pending ? 'טרם נקלטה' : '',
    row.refund ? 'זיכוי' : '',
    row.currency === null ? 'מטבע לא נתמך' : '',
  ].filter(Boolean);
  const mark = choice.selected && problem ? 'incomplete' : choice.selected ? 'on' : 'off';
  return (
    <li className={`imp-row imp-${mark}`}>
      <input type="checkbox" className="imp-check" checked={choice.selected} disabled={row.currency === null} onChange={(e) => onSelect(e.target.checked)} aria-label={`ייבוא ${row.name || 'שורה'}`} />
      <div className="imp-main">
        <div className="imp-line">
          <span className="imp-name">{row.name || 'ללא שם'}</span>
          <Amount agorot={row.amountAgorot} className={row.type === 'income' ? 'tone-income' : 'tone-expense'} currency={row.currency ?? undefined} />
        </div>
        <div className="imp-meta muted small">
          {[formatDisplayDate(row.date), row.card ? `כרטיס ${row.card}` : '', row.issuerCategory].filter(Boolean).join(' · ')}
        </div>
        {flags.length > 0 || level !== 'none' ? (
          <div className="imp-badges">
            {level !== 'none' ? <span className={`imp-badge imp-badge-${level}`}>{`${MATCH_TEXT[level]}${level === 'exact' ? '' : ` · ${Math.round(match.probability * 100)}%`}`}</span> : null}
            {flags.map((f) => <span key={f} className="imp-badge imp-badge-warn">{f}</span>)}
          </div>
        ) : null}
        {match.existing && level !== 'none' ? (
          <div className="imp-dup muted small">
            {`קיימת: ${match.existing.counterparty || 'ללא שם'} · ${formatDisplayDate(match.existing.date)} · ${(match.existing.amountAgorot / 100).toFixed(2)}`}
          </div>
        ) : null}
        <div className="imp-selects">
          <select aria-label="קטגוריה" value={choice.categoryId} onChange={(e) => onCategory(e.target.value)} className={choice.categoryId ? '' : 'imp-needs'}>
            <option value="">בחירת קטגוריה…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="אמצעי תשלום" value={choice.paymentKey} onChange={(e) => onPayment(e.target.value)}>
            {methods.map((m) => <option key={choiceKey(m)} value={choiceKey(m)}>{choiceText(m)}</option>)}
          </select>
        </div>
      </div>
    </li>
  );
}
