import { useEffect, useState } from 'react';
import { compatibleAiModel, defaultAiModel } from '../../domain/aiModels';
import { loadAdminAi, saveAdminAi, setAiAccess, type AiProvider, type ExtraAiProvider, type ExtraAiConfig, type AdminAiInfo, type AdminUserRow } from '../../services/adminService';

const additionalProviders = [
  { id: 'openrouter', name: 'OpenRouter', link: 'https://openrouter.ai/keys', available: true, description: 'Free models only (openrouter/free)' },
  { id: 'cloudflare', name: 'Cloudflare Workers AI', link: 'https://dash.cloudflare.com/', available: true, description: 'Workers Free: 10,000 neurons/day' },
  { id: 'nvidia', name: 'NVIDIA NIM', link: 'https://build.nvidia.com/', available: false, description: 'Free prototyping access; production requires verification' },
  { id: 'cohere', name: 'Cohere', link: 'https://dashboard.cohere.com/api-keys', available: false, description: 'Evaluation key only; production is paid' },
  { id: 'zai', name: 'Z.AI', link: 'https://z.ai/', available: true, description: 'Free GLM-4.7-Flash and GLM-4.5-Flash' },
  { id: 'sambanova', name: 'SambaNova', link: 'https://cloud.sambanova.ai/', available: false, description: 'Requires acquired credits' },
  { id: 'ollama', name: 'Ollama Cloud', link: 'https://ollama.com/settings/keys', available: false, description: 'Starter credits; recurring free quota not verified' },
  { id: 'mistral', name: 'Mistral', link: 'https://console.mistral.ai/', available: false, description: 'Free evaluation and prototyping only' },
  { id: 'cerebras', name: 'Cerebras', link: 'https://cloud.cerebras.ai/', available: false, description: 'Limited promotional credit; payment method required' },
] as const;

function AdditionalProviderSettings({ config, provider, busy, save }: { config?: ExtraAiConfig; provider: ExtraAiProvider; busy: boolean; save: (value: Omit<ExtraAiConfig, 'hasKey'> & { apiKey?: string }) => void }) {
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [confirmed, setConfirmed] = useState(config?.freeConfirmed ?? false);
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState(config?.accountId ?? '');
  return <div className="stack">
    <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} /> הפעלת ספק</label>
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /> אני מאשר שהחשבון במסלול חינמי ללא חיוב</label>
    {provider === 'cloudflare' && <label>Account ID<input className="input" dir="ltr" value={accountId} onChange={e=>setAccountId(e.target.value)} /></label>}
    <label>{config?.hasKey ? 'החלפת מפתח (אפשר להשאיר ריק)' : 'מפתח API'}<input className="input" type="password" dir="ltr" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} /></label>
    <p className="muted small">מודל: Auto</p>
    <button type="button" className="btn btn-secondary" disabled={busy || (enabled && (!confirmed || (!apiKey.trim() && !config?.hasKey)))} onClick={()=>{save({provider, enabled, freeConfirmed:confirmed, accountId, model:'auto', ...(apiKey.trim()?{apiKey:apiKey.trim()}: {})});setApiKey('');}}>שמירת הגדרות ספק</button>
  </div>;
}

/** סקירת AI: מפתח, מכסות, כיבוי כללי, ומי מורשה להשתמש. כל ההגבלות נאכפות בשרת. */
export function AiAdminSection({ users }: { users: AdminUserRow[] }) {
  const [info, setInfo] = useState<AdminAiInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<AiProvider>('google');
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupProvider, setBackupProvider] = useState<'google' | 'groq'>('groq');
  const [backupModel, setBackupModel] = useState('auto');
  const [backupKey, setBackupKey] = useState('');
  const [model, setModel] = useState('');
  const [perUser, setPerUser] = useState('');
  const [global, setGlobal] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setError('');
    loadAdminAi()
      .then((r) => {
        setInfo(r);
        setProvider(r.provider ?? 'google');
        setModel(compatibleAiModel(r.provider ?? 'google', r.model));
        setBackupEnabled(r.freeBackup?.enabled ?? false);
        setBackupProvider(r.freeBackup?.provider ?? 'groq');
        setBackupModel(compatibleAiModel(r.freeBackup?.provider ?? 'groq', r.freeBackup?.model ?? ''));
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
        provider,
        freeBackup: { enabled: backupEnabled, provider: backupProvider, model: compatibleAiModel(backupProvider, backupModel), ...(backupKey.trim() ? { apiKey: backupKey.trim() } : {}) },
        model: compatibleAiModel(provider, model),
        perUserDaily: Number(perUser),
        globalDaily: Number(global),
      });
      setApiKey('');
      setBackupKey('');
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
        <div><dt>מפתח API</dt><dd>{info.hasKey ? `מוגדר (…${info.keyHint})` : 'לא הוגדר'}</dd></div>
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

      <label className="field-label" htmlFor="ai-provider">ספק AI</label>
      <select id="ai-provider" className="input" value={provider} onChange={(e) => { setProvider(e.target.value as AiProvider); setModel(defaultAiModel(e.target.value)); setApiKey(''); }}>
        <option value="google">Google Gemini</option>
        <option value="openai">OpenAI</option>
        <option value="xai">xAI Grok</option>
        <option value="anthropic">Anthropic Claude</option>
        <option value="deepseek">DeepSeek</option>
        <option value="openrouter">OpenRouter</option>
        <option value="groq">GroqCloud</option>
      </select>
      {provider !== (info.provider ?? 'google') && <p className="muted small">בהחלפת ספק יש להזין מפתח ומודל חדשים. מודל הגיבוי הקודם יוסר.</p>}
      <label className="field-label" htmlFor="ai-key">{info.hasKey ? 'החלפת מפתח (אפשר להשאיר ריק)' : 'מפתח API'}</label>
      <input id="ai-key" className="input" type="password" dir="ltr" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <label className="field-label" htmlFor="ai-model">מודל</label>
      <input id="ai-model" className="input" dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} />
      <h3 className="subhead">ספק גיבוי</h3>
      <label><input type="checkbox" checked={backupEnabled} onChange={e => setBackupEnabled(e.target.checked)} /> הפעלת גיבוי אוטומטי</label>
      <label className="field-label" htmlFor="ai-backup-provider">ספק גיבוי</label>
      <select id="ai-backup-provider" className="input" value={backupProvider} onChange={e => { const p = e.target.value as 'google' | 'groq'; setBackupProvider(p); setBackupModel('auto'); setBackupKey(''); }}>
        <option value="google">Google Gemini</option><option value="groq">GroqCloud</option>
      </select>
      <label className="field-label" htmlFor="ai-backup-model">מודל גיבוי</label>
      <input id="ai-backup-model" className="input" dir="ltr" value={backupModel} onChange={e => setBackupModel(e.target.value)} />
      <label className="field-label" htmlFor="ai-backup-key">{info.freeBackup?.hasKey && info.freeBackup.provider === backupProvider ? 'מפתח גיבוי שמור (אפשר להשאיר ריק)' : 'מפתח גיבוי'}</label>
      <input id="ai-backup-key" className="input" type="password" dir="ltr" autoComplete="off" value={backupKey} onChange={e => setBackupKey(e.target.value)} />
      <p className="muted small">Gemini ו-Groq עובדים עם מודלים הזמינים במסלול חינמי. יש לוודא שהחשבון אצל הספק נשאר ללא חיוב; מפתח API אינו מוכיח מסלול חינמי. אם הספקים אינם זמינים, המנוע המקומי עונה.</p>
      <h3 className="subhead">ספקי AI נוספים</h3>
      {additionalProviders.map(p=><details key={p.id} className="card">
        <summary>{p.name} · {p.available ? 'זמין להגדרה' : 'לא זמין במסלול חינמי קבוע'}</summary>
        <p className="muted small" translate="no">{p.description}</p>
        <a href={p.link} target="_blank" rel="noreferrer">קבלת מפתח</a>
        {p.available && <AdditionalProviderSettings provider={p.id as ExtraAiProvider} config={info.extraProviders?.find(c=>c.provider===p.id)} busy={busy} save={entry=>void run(()=>saveAdminAi({extraProvider:entry}))}/>}
      </details>)}
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
        הצריכה לפי משתמש נרשמת בכל שאלה (שאלות וטוקנים), כך שאפשר לדעת מי גרם לעלות. אם בעתיד תעבור לתעריף בתשלום, מחירי הטוקנים נקבעים לפי מחירון הספק של המודל.
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
