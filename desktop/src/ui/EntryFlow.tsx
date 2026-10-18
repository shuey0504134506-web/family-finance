import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Field } from '../../../src/components/Field';
import { Icon } from '../../../src/components/Icon';
import { DEFAULT_BUSINESS_ID } from '../../../src/domain/spaces';
import { LogoControl } from '../../../src/features/settings/LogoControl';
import { saveLogo } from '../../../src/services/logoService';
import { LangSwitch } from '../../../src/components/LangSwitch';
import { BusinessesFields } from '../../../src/features/auth/BusinessesFields';
import { isValidEmail, MIN_PASSWORD_LENGTH, normalizePhone, validateSignup, type SignupValues } from '../../../src/features/auth/validation';
import { describeError } from '../../../src/services/authErrors';
import { WrongPassword, type AccountMeta } from '../core/session';
import type { RecoveryQuestion } from '../core/recovery';
import { IS_PHONE } from './target';
import { PRIVACY_LABEL_FULL } from '../../../src/features/privacy/privacyLabel';
import { DesktopPrivacyBody } from './DesktopPrivacy';
import { ChevronRight } from '../../../src/components/icons';
import type { NewAccount } from './controller';
import { RecoveryEditor } from './RecoveryEditor';
import { useController, useUi } from './useController';

type View =
  | { name: 'list' }
  | { name: 'unlock'; account: AccountMeta }
  | { name: 'recover'; account: AccountMeta }
  | { name: 'online-login' }
  | { name: 'signup-online' }
  | { name: 'signup-offline' }
  | { name: 'remove'; account: AccountMeta }
  | { name: 'privacy' };

/** בגרסת הטלפון "מחשב" הופך ל"טלפון" */
const ph = (t: string): string => (IS_PHONE ? t.replace(/המחשב הזה/g, 'הטלפון הזה').replace(/מהמחשב/g, 'מהטלפון').replace(/במחשב/g, 'בטלפון') : t);

const fail = (e: unknown): string => (e instanceof WrongPassword ? 'הסיסמה שגויה.' : describeError(e));

/** מסך הכניסה של התוכנה: לוח צד עם המותג, ובצד השני הטופס. */
export function EntryFlow() {
  const ui = useUi();
  const [view, setView] = useState<View>({ name: 'list' });
  const back = () => setView({ name: 'list' });

  return (
    <main className="entry" dir="rtl">
      <aside className="entry-brand" aria-hidden="true">
        <div className="welcome-logo"><img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={88} height={88} draggable={false} /></div>
        <h1>ניהול כספים לעסק ולמשק הבית</h1>
        <p>הנתונים נשמרים במחשב הזה, מוצפנים בסיסמה שלך. סנכרון לענן רק בחשבון מקוון, וכשיש חיבור.</p>
        <ul className="feature-list">
          <li><span className="feature-icon"><Icon name="budget" /></span><span>עובד גם בלי אינטרנט</span></li>
          <li><span className="feature-icon"><Icon name="sync" /></span><span>סנכרון אוטומטי כשהחיבור חוזר</span></li>
          <li><span className="feature-icon"><Icon name="business" /></span><span>עסק ומשק בית, כל אחד בנפרד</span></li>
        </ul>
      </aside>
      <section className="entry-main">
        <div className="entry-panel">
          <LangSwitch />
          {view.name !== 'list' && <button type="button" className="entry-back" onClick={back}><ChevronRight />חזור</button>}
          {view.name === 'list' && <AccountList accounts={ui.accounts} online={ui.online} go={setView} />}
          {view.name === 'unlock' && <Unlock account={view.account} go={setView} />}
          {view.name === 'recover' && <Recover account={view.account} />}
          {view.name === 'online-login' && <OnlineLogin />}
          {view.name === 'signup-online' && <Signup kind="online" />}
          {view.name === 'signup-offline' && <Signup kind="offline" />}
          {view.name === 'remove' && <RemoveAccount account={view.account} back={back} />}
          {view.name === 'privacy' && <DesktopPrivacyBody kind={null} />}
          {view.name !== 'privacy' && (
            <p className="auth-footer-link">
              <button type="button" className="link-btn" onClick={() => setView({ name: 'privacy' })}>{PRIVACY_LABEL_FULL}</button>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function AccountList({ accounts, online, go }: { accounts: AccountMeta[]; online: boolean; go: (v: View) => void }) {
  return (
    <>
      <header className="auth-header">
        <h1>{accounts.length ? 'ברוכים השבים' : 'ברוכים הבאים'}</h1>
        <p className="muted">{accounts.length ? 'בחרו חשבון כדי להיכנס.' : IS_PHONE ? 'חשבון לא מקוון נשמר על הטלפון בלבד, מוצפן בסיסמה, בלי שרת ובלי סנכרון.' : 'אפשר ליצור חשבון מנותק (הכול נשאר במחשב), או להתחבר לחשבון מקוון.'}</p>
      </header>
      {accounts.length > 0 && (
        <ul className="account-list" aria-label={ph("חשבונות במחשב הזה")}>
          {accounts.map((a) => (
            <li key={a.id}>
              <button type="button" className="card account-row" onClick={() => go({ name: 'unlock', account: a })}>
                <span className="account-avatar" aria-hidden="true">{(a.displayName || a.email || '?').slice(0, 1)}</span>
                <span className="account-text">
                  <strong>{a.displayName || a.email}</strong>
                  <span className="muted small">{a.kind === 'offline' ? 'חשבון מנותק · לא מסונכרן' : a.email}</span>
                </span>
                <span className={`badge ${a.kind === 'offline' ? 'badge-offline' : 'badge-online'}`}>{a.kind === 'offline' ? 'מנותק' : 'מקוון'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="auth-actions">
        {!IS_PHONE && <button type="button" className="btn btn-primary" onClick={() => go({ name: 'signup-online' })} disabled={!online}>יצירת חשבון מקוון</button>}
        {!IS_PHONE && <button type="button" className="btn btn-primary" onClick={() => go({ name: 'online-login' })} disabled={!online}>כניסה לחשבון מקוון קיים</button>}
        <button type="button" className="btn btn-primary" onClick={() => go({ name: 'signup-offline' })}>{IS_PHONE ? 'יצירת חשבון לא מקוון' : 'יצירת חשבון מנותק (ללא סנכרון)'}</button>
        {IS_PHONE && <a className="btn btn-secondary phone-exit" href="../index.html">חזרה לכניסה עם חשבון מקוון</a>}
      </div>
      {!IS_PHONE && !online && <p className="muted small" role="status">אין חיבור לאינטרנט. כניסה ראשונה ויצירת חשבון מקוון דורשות חיבור. חשבונות שכבר נמצאים במחשב נפתחים גם בלי חיבור.</p>}
    </>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return {
    busy, error, setError,
    run: async (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true); setError('');
      try { await fn(); } catch (e) { setError(fail(e)); } finally { setBusy(false); }
    },
  };
}

function Unlock({ account, go }: { account: AccountMeta; go: (v: View) => void }) {
  const c = useController();
  const [password, setPassword] = useState('');
  const a = useAction();
  const [hasQuestions, setHasQuestions] = useState<boolean | null>(null);
  useEffect(() => { void c.recoveryQuestions(account.id).then((q) => setHasQuestions(q !== null)); }, [c, account.id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return a.setError('יש להזין סיסמה');
    void a.run(() => c.unlock(account.id, password));
  }
  return (
    <form onSubmit={submit} noValidate>
      <header className="auth-header">
        <h1>שלום {account.displayName || ''}</h1>
        <p className="muted">{account.kind === 'offline' ? ph('חשבון מנותק: הנתונים נמצאים במחשב הזה בלבד.') : account.email}</p>
      </header>
      <div className="card form-card">
        <Field label="סיסמה" type="password" dir="ltr" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={a.error} />
        <button type="submit" className="btn btn-primary" disabled={a.busy}>{a.busy ? 'פותח…' : 'כניסה'}</button>
      </div>
      <p className="auth-footer-link">
        {hasQuestions ? <button type="button" className="link-btn" onClick={() => go({ name: 'recover', account })}>שכחתי סיסמה, שחזור בעזרת שאלות</button>
          : hasQuestions === false && account.kind === 'offline' ? <span className="muted small">לא הוגדרו שאלות שחזור לחשבון הזה, ולכן אי אפשר לשחזר סיסמה.</span> : null}
      </p>
      <p className="auth-footer-link">
        <button type="button" className="link-btn" onClick={() => go({ name: 'remove', account })}>{ph('הסרת החשבון מהמחשב')}</button>
      </p>
    </form>
  );
}

function Recover({ account }: { account: AccountMeta }) {
  const c = useController();
  const [questions, setQuestions] = useState<RecoveryQuestion[] | null>(null);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const a = useAction();
  useEffect(() => { void c.recoveryQuestions(account.id).then(setQuestions); }, [c, account.id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD_LENGTH) return a.setError(`הסיסמה החדשה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
    if (pw !== pw2) return a.setError('אימות הסיסמה אינו תואם');
    void a.run(async () => {
      try { await c.recover(account.id, answers, pw); } catch (err) {
        if (err instanceof WrongPassword) throw Object.assign(new Error('x'), { code: 'recovery/wrong' });
        throw err;
      }
    });
  }
  if (!questions) return <p className="muted">טוען…</p>;
  return (
    <form onSubmit={submit} noValidate>
      <header className="auth-header"><h1>שחזור סיסמה</h1><p className="muted">יש לענות נכון על שלוש השאלות, ואז לקבוע סיסמה חדשה. הנתונים נשמרים כמו שהם.</p></header>
      <div className="card form-card">
        {questions.map((q, i) => (
          <Field key={i} label={q.text} value={answers[i]} autoComplete="off" onChange={(e) => setAnswers((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        <Field label="סיסמה חדשה" type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint={`לפחות ${MIN_PASSWORD_LENGTH} תווים`} />
        <Field label="אימות סיסמה חדשה" type="password" dir="ltr" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {a.error && <div className="form-error" role="alert">{a.error === 'אירעה שגיאה לא צפויה. יש לנסות שוב.' ? 'אחת או יותר מהתשובות שגויה. אפשר לנסות שוב.' : a.error}</div>}
        <button type="submit" className="btn btn-primary" disabled={a.busy}>{a.busy ? 'משחזר…' : 'שחזור וקביעת סיסמה'}</button>
      </div>
    </form>
  );
}

function OnlineLogin() {
  const c = useController();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const a = useAction();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) return a.setError('יש להזין כתובת מייל תקינה');
    if (!password) return a.setError('יש להזין סיסמה');
    void a.run(() => c.firstOnlineLogin(email, password));
  }
  return (
    <form onSubmit={submit} noValidate>
      <header className="auth-header"><h1>כניסה לחשבון מקוון</h1><p className="muted">נדרש חיבור לאינטרנט בפעם הראשונה במחשב הזה. אחר כך אפשר להיכנס גם בלי חיבור, עם אותה סיסמה.</p></header>
      <div className="card form-card">
        <Field label="כתובת מייל" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="סיסמה" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {a.error && <div className="form-error" role="alert">{a.error}</div>}
        <button type="submit" className="btn btn-primary" disabled={a.busy}>{a.busy ? 'מתחבר ומוריד נתונים…' : 'כניסה'}</button>
      </div>
      <p className="auth-footer-link"><ResetPassword email={email} /></p>
    </form>
  );
}

function ResetPassword({ email }: { email: string }) {
  const [msg, setMsg] = useState('');
  const c = useController();
  return (
    <>
      <button type="button" className="link-btn" onClick={() => { if (!isValidEmail(email)) return setMsg('יש להזין כתובת מייל'); void c.sendReset(email).then(() => setMsg('נשלח מייל לאיפוס סיסמה.'), (e) => setMsg(fail(e))); }}>שכחתי סיסמה</button>
      {msg && <span className="muted small" role="status"> {msg}</span>}
    </>
  );
}

function Signup({ kind }: { kind: 'online' | 'offline' }) {
  const c = useController();
  const [values, setValues] = useState<SignupValues>({ firstName: '', lastName: '', businessName: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [extras, setExtras] = useState<string[]>([]);
  const [household, setHousehold] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const saveChosenLogo = () => { const me = c.getState().me; if (logo && me) saveLogo(me.uid, DEFAULT_BUSINESS_ID, logo).catch(() => undefined); };
  const [errors, setErrors] = useState<Partial<Record<keyof SignupValues, string>>>({});
  const [step, setStep] = useState<'details' | 'recovery'>('details');
  const a = useAction();
  const set = (f: keyof SignupValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f]: e.target.value }));
  const offline = kind === 'offline';

  const validate = useMemo(() => () => {
    if (!offline) return validateSignup(values);
    const found: Partial<Record<keyof SignupValues, string>> = {};
    if (!values.firstName.trim()) found.firstName = 'יש להזין שם פרטי';
    if (!values.lastName.trim()) found.lastName = 'יש להזין שם משפחה';
    if (values.email.trim() && !isValidEmail(values.email)) found.email = 'כתובת המייל אינה תקינה';
    if (values.password.length < MIN_PASSWORD_LENGTH) found.password = `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
    if (values.confirmPassword !== values.password) found.confirmPassword = 'אימות הסיסמה אינו תואם';
    return found;
  }, [offline, values]);

  const input = (): NewAccount & Record<string, unknown> => ({
    firstName: values.firstName, lastName: values.lastName, email: values.email, phone: offline ? '' : normalizePhone(values.phone),
    businessName: values.businessName, accountMode: 'both', extraBusinessNames: extras.map((n) => n.trim()).filter(Boolean), householdName: household.trim(),
  });

  function next(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (offline) setStep('recovery');
    else void a.run(async () => { await c.signUpOnline(input(), values.password); saveChosenLogo(); });
  }

  if (step === 'recovery') {
    return (
      <>
        <header className="auth-header">
          <h1>שחזור סיסמה</h1>
          <p className="muted">חשבון מנותק לא נשמר בשום שרת, ולכן אם הסיסמה תישכח הדרך היחידה להיכנס היא לענות על שלוש שאלות שתקבעו עכשיו. כעבור זמן אפשר להחליף חלק מהן בשאלות מהפעולות שתרשמו.</p>
        </header>
        <RecoveryEditor derived={[]} submitLabel="יצירת החשבון" busy={a.busy} error={a.error}
          onSubmit={(qs, ans) => void a.run(async () => { await c.signUpOffline(input(), values.password); await c.setRecovery(qs, ans); saveChosenLogo(); })} />
        <p className="auth-footer-link"><button type="button" className="link-btn" onClick={() => setStep('details')}>חזרה לפרטים</button></p>
      </>
    );
  }

  return (
    <form onSubmit={next} noValidate>
      <header className="auth-header">
        <h1>{offline ? 'יצירת חשבון מנותק' : 'יצירת חשבון מקוון'}</h1>
        <p className="muted">{offline ? ph('הנתונים נשמרים במחשב הזה בלבד, מוצפנים, ולעולם לא יסונכרנו, גם כשיש אינטרנט.') : 'הנתונים נשמרים במחשב ומסונכרנים לענן כשיש חיבור. נדרש אינטרנט ליצירה.'}</p>
      </header>
      <div className="card form-card form-grid">
        <Field label="שם פרטי" autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} />
        <Field label="שם משפחה" autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} />
        <Field label="שם העסק (לא חובה)" value={values.businessName} onChange={set('businessName')} error={errors.businessName} />
        <LogoControl data={logo} onChange={setLogo} />
        <BusinessesFields householdName={household} onHouseholdName={setHousehold} extras={extras} onExtras={setExtras} />
        {!offline && <Field label="מספר טלפון" type="tel" dir="ltr" value={values.phone} onChange={set('phone')} error={errors.phone} hint="מוצג למנהל האפליקציה בלבד" />}
        <Field label={offline ? 'כתובת מייל (לא חובה)' : 'כתובת מייל'} type="email" dir="ltr" value={values.email} onChange={set('email')} error={errors.email} />
        <Field label="סיסמה" type="password" dir="ltr" autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} hint={`לפחות ${MIN_PASSWORD_LENGTH} תווים`} />
        <Field label="אימות סיסמה" type="password" dir="ltr" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
        {a.error && <div className="form-error" role="alert">{a.error}</div>}
        <button type="submit" className="btn btn-primary" disabled={a.busy}>{a.busy ? 'יוצר חשבון…' : offline ? 'המשך לשאלות שחזור' : 'יצירת חשבון'}</button>
      </div>
    </form>
  );
}

function RemoveAccount({ account, back }: { account: AccountMeta; back: () => void }) {
  const c = useController();
  const [text, setText] = useState('');
  const a = useAction();
  const word = 'מחיקה';
  return (
    <>
      <header className="auth-header"><h1>{ph('הסרת החשבון מהמחשב')}</h1>
        <p className="muted">{account.kind === 'offline' ? 'זה חשבון מנותק: אין לו עותק בשום מקום אחר. המחיקה סופית וכל הנתונים יאבדו.' : 'הקובץ המקומי יימחק. הנתונים שכבר סונכרנו נשארים בענן, אבל שינויים שעוד לא סונכרנו יאבדו.'}</p></header>
      <div className="card form-card">
        <Field label={`להקלדת "${word}" לאישור`} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        {a.error && <div className="form-error" role="alert">{a.error}</div>}
        <button type="button" className="btn btn-primary btn-danger" disabled={a.busy || text.trim() !== word} onClick={() => void a.run(async () => { await c.removeLocal(account.id); back(); })}>הסרה סופית</button>
      </div>
    </>
  );
}
