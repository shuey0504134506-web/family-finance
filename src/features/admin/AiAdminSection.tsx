import { useEffect, useState } from 'react';
import { loadAdminAi, saveAdminAi, setAiAccess, type AdminAiInfo, type AdminUserRow } from '../../services/adminService';

/** סקירת AI: מפתח, מכסות, כיבוי כללי, ומי מורשה להשתמש. כל ההגבלות נאכפות בשרת. */
export function AiAdminSection({ users }: { users: AdminUserRow[] }) {
  const [info, setInfo] = useState<AdminAiInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [perUser, setPerUser] = useState('');
  const [global, setGlobal] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setError('');
    loadAdminAi()
      .then((r) => {
        setInfo(r);
        setModel(r.model);
        setPerUser(String(r.perUserDaily));
        setGlobal(String(r.globalDaily));
      })
      .catch(() => setError('לא הצלחנו לטעון את הגדרות ה-AI. ייתכן שפונקציות השרת עדיין לא עודכנו.'));
  };
  useEffect(load, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      load();
    } catch (caught) {
      const message = (caught as { message?: string })?.message;
      setError(message && !/internal/i.test(message) ? message : 'הפעולה נכשלה. יש לנסות שוב.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = () =>
    run(async () => {
      await saveAdminAi({
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        model: model.trim(),
        perUserDaily: Number(perUser),
        globalDaily: Number(global),
      });
      setApiKey('');
    });

  if (!info) {
    return error ? (
      <div className="stack">
        <div className="form-error" role="alert">{error}</div>
        <button type="button" className="btn btn-secondary" onClick={load}>ניסיון חוזר</button>
      </div>
    ) : (
      <p className="muted small" role="status">טוען…</p>
    );
  }

  const access = new Set(info.accessUids);
  const q = search.trim().toLowerCase();
  const shown = users.filter((u) => !q || u.email.toLowerCase().includes(q));

  return (
    <div className="stack">
      <dl className="detail-list">
        <div><dt>מפתח Gemini</dt><dd>{info.hasKey ? `מוגדר (…${info.keyHint})` : 'לא הוגדר'}</dd></div>
        <div><dt>מורשים</dt><dd>{info.accessUids.length}</dd></div>
        <div><dt>שאלות שנשאלו היום</dt><dd>{`${info.usedToday} מתוך ${info.globalDaily}`}</dd></div>
        <div><dt>החודש: שאלות וטוקנים</dt><dd>{`${info.monthQuestions ?? 0} · ${(info.monthTokens ?? 0).toLocaleString('en-US')}`}</dd></div>
        {info.last && (
          <div>
            <dt>השאלה האחרונה (אבחון)</dt>
            <dd dir="ltr">
              {info.last.error
                ? `ERROR · ${info.last.error}`
                : `${info.last.finish || '?'} · prompt ${(info.last.promptTokens ?? 0).toLocaleString('en-US')} · thinking ${(info.last.thoughtTokens ?? 0).toLocaleString('en-US')} · output ${(info.last.outputTokens ?? 0).toLocaleString('en-US')} · ${info.last.answerChars ?? 0} chars · ${((info.last.ms ?? 0) / 1000).toFixed(1)}s`}
            </dd>
          </div>
        )}
      </dl>

      <label className="field-label" htmlFor="ai-key">{info.hasKey ? 'החלפת מפתח (אפשר להשאיר ריק)' : 'מפתח Gemini API'}</label>
      <input id="ai-key" className="input" type="password" dir="ltr" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <label className="field-label" htmlFor="ai-model">מודל</label>
      <input id="ai-model" className="input" dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} />
      <label className="field-label" htmlFor="ai-user">מכסה יומית למשתמש (שאלות)</label>
      <input id="ai-user" className="input" inputMode="numeric" value={perUser} onChange={(e) => setPerUser(e.target.value)} />
      <label className="field-label" htmlFor="ai-global">תקרה יומית לכל המשתמשים ביחד</label>
      <input id="ai-global" className="input" inputMode="numeric" value={global} onChange={(e) => setGlobal(e.target.value)} />
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveSettings()}>שמירת הגדרות</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(() => saveAdminAi({ enabled: !info.enabled }))}>
          {info.enabled ? 'כיבוי כללי של ה-AI' : 'הפעלה מחדש'}
        </button>
      </div>
      {!info.enabled && <p className="muted small">ה-AI כבוי כרגע לכולם.</p>}
      {error && <div className="form-error" role="alert">{error}</div>}

      <p className="muted small">
        הצריכה לפי משתמש נרשמת בכל שאלה (שאלות וטוקנים), כך שאפשר לדעת מי גרם לעלות. אם בעתיד תעבור לתעריף בתשלום, מחירי הטוקנים נקבעים לפי מחירון Google של המודל.
      </p>
      <h3 className="subhead">מי מורשה</h3>
      <input className="input" aria-label="חיפוש חשבון לפי אימייל" placeholder="חיפוש לפי אימייל" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="ai-saved">
        {shown.map((u) => (
          <li key={u.uid} className="ai-saved-row">
            <span className="ai-saved-main">
              {u.email}
              {info.usage?.[u.uid] && (
                <span className="muted small">
                  {` · היום ${info.usage[u.uid].today} · החודש ${info.usage[u.uid].month} שאלות, ${info.usage[u.uid].monthTokens.toLocaleString('en-US')} טוקנים · סך הכול ${info.usage[u.uid].total}`}
                </span>
              )}
            </span>
            <button
              type="button"
              className={`btn btn-small ${access.has(u.uid) ? 'btn-primary' : 'btn-secondary'}`}
              disabled={busy}
              aria-pressed={access.has(u.uid)}
              onClick={() => void run(() => setAiAccess(u.uid, !access.has(u.uid)))}
            >
              {access.has(u.uid) ? 'מורשה' : 'ללא גישה'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
