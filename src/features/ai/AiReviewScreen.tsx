import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { pickQuestions } from '../../domain/aiQuestions';
import { newId } from '../../services/ids';
import {
  askAi,
  chatToEvict,
  deleteAiChat,
  describeAiError,
  loadAiQuota,
  saveAiChat,
  saveRecentQuestions,
  subscribeAiChats,
  subscribeRecentQuestions,
  withRecentQuestion,
  type AiChat,
  type AiMessage,
  type RecentQuestion,
} from '../../services/aiService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useSpaces } from '../spaces/SpacesContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { useAiSummaryData } from './useAiSummaryData';

const consentKey = (uid: string) => `ff.ai.consent.v1.${uid}`;
const readConsent = (uid: string): boolean => {
  try {
    return localStorage.getItem(consentKey(uid)) === '1';
  } catch {
    return false;
  }
};

/** השיחה הנוכחית נשמרת בזיכרון, כדי שמעבר להיסטוריה וחזרה לא ימחק אותה. */
let session: { uid: string; chatId: string; createdAt: number; messages: AiMessage[] } | null = null;

interface NavState {
  chat?: AiChat;
  ask?: string;
}

/** סקירת AI: חמש שאלות מוצעות מהמאגר, שורת שאלה חופשית, השיחה, וכפתור להיסטוריה. */
export function AiReviewScreen() {
  const { user } = useReadyAuth();
  const space = useSpace();
  const { nameOf } = useSpaces();
  const navigate = useNavigate();
  const { reportFailure } = useSyncNotice();
  const nav = (useLocation().state ?? {}) as NavState;
  const data = useAiSummaryData();

  const [consent, setConsent] = useState(() => readConsent(user.uid));
  const [suggestions, setSuggestions] = useState(() => pickQuestions(5));
  const restored = !nav.chat && !nav.ask && session?.uid === user.uid ? session : null;
  const [chatId, setChatId] = useState(() => nav.chat?.id ?? restored?.chatId ?? newId());
  const [createdAt, setCreatedAt] = useState(() => nav.chat?.createdAt ?? restored?.createdAt ?? Date.now());
  const [messages, setMessages] = useState<AiMessage[]>(() => nav.chat?.messages ?? restored?.messages ?? []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [saved, setSaved] = useState<AiChat[]>([]);
  const [recent, setRecent] = useState<RecentQuestion[]>([]);
  const threadEnd = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  useEffect(() => subscribeAiChats(user.uid, setSaved, () => undefined), [user.uid]);
  useEffect(() => subscribeRecentQuestions(user.uid, setRecent, () => undefined), [user.uid]);
  useEffect(() => {
    loadAiQuota().then(setQuota).catch(() => undefined);
  }, []);
  useEffect(() => {
    threadEnd.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length, busy]);

  useEffect(() => {
    session = { uid: user.uid, chatId, createdAt, messages };
  }, [user.uid, chatId, createdAt, messages]);

  const isSaved = saved.some((c) => c.id === chatId);
  const pinned = saved.find((c) => c.id === chatId)?.pinned ?? false;

  const persist = useCallback(
    (list: AiMessage[]) => {
      const title = (list.find((m) => m.role === 'user')?.text ?? 'שיחה').slice(0, 60);
      const existing = saved.find((c) => c.id === chatId);
      saveAiChat(user.uid, { id: chatId, title, pinned: existing?.pinned ?? false, messages: list, createdAt, updatedAt: Date.now() }).catch(() =>
        reportFailure('לא הצלחנו לשמור את השיחה. יש לנסות שוב.'),
      );
    },
    [saved, chatId, createdAt, user.uid, reportFailure],
  );

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy || !data.ready || !consent) return;
      setError('');
      setBusy(true);
      setDraft('');
      const before = messages;
      setMessages([...before, { role: 'user', text: q }]);
      try {
        const result = await askAi(q, data.build(), before);
        const next: AiMessage[] = [...before, { role: 'user', text: q }, { role: 'model', text: result.answer }];
        setMessages(next);
        setQuota({ remaining: result.remaining, limit: result.limit });
        saveRecentQuestions(user.uid, withRecentQuestion(recent, q, Date.now())).catch(() => undefined);
        if (saved.some((c) => c.id === chatId)) persist(next);
      } catch (caught) {
        setMessages(before);
        setDraft(q);
        setError(describeAiError(caught));
        loadAiQuota().then(setQuota).catch(() => undefined);
      } finally {
        setBusy(false);
      }
    },
    [busy, data, consent, messages, user.uid, recent, saved, chatId, persist],
  );

  // כניסה משאלה מההיסטוריה: נשאלת אוטומטית ברגע שהנתונים מוכנים
  useEffect(() => {
    if (!nav.ask || autoAsked.current || !data.ready || !consent) return;
    autoAsked.current = true;
    void ask(nav.ask);
  }, [nav.ask, data.ready, consent, ask]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void ask(draft);
  };

  const newConversation = () => {
    setChatId(newId());
    setCreatedAt(Date.now());
    setMessages([]);
    setError('');
    setSuggestions(pickQuestions(5, Math.random, suggestions));
  };

  const save = () => {
    const evict = chatToEvict(saved, chatId);
    if (evict === 'full') {
      setError('יש כבר חמש שיחות שמורות ונעוצות. כדי לשמור שיחה חדשה צריך למחוק או לבטל נעיצה בהיסטוריה.');
      return;
    }
    if (evict) deleteAiChat(user.uid, evict).catch(() => undefined);
    persist(messages);
  };

  const togglePin = () => {
    const existing = saved.find((c) => c.id === chatId);
    if (!existing) return;
    saveAiChat(user.uid, { ...existing, pinned: !existing.pinned }).catch(() => reportFailure('לא הצלחנו לעדכן את השיחה.'));
  };

  const acceptConsent = () => {
    try {
      localStorage.setItem(consentKey(user.uid), '1');
    } catch {
      /* אחסון חסום: ההסכמה תתבקש שוב בפעם הבאה */
    }
    setConsent(true);
  };

  const canAsk = consent && data.ready && !busy;
  const exhausted = quota !== null && quota.remaining <= 0;
  const title = useMemo(() => `סקירת AI · ${nameOf(space)}`, [nameOf, space]);

  return (
    <div className={`app-shell scope-${space.scope}`}>
      <ScreenHeader title={title} backTo={`/${space.key}`} />
      <main className="content ai-page" aria-busy={busy}>
        {!consent && (
          <section className="card ai-consent" aria-label="לפני שמתחילים">
            <h2 className="card-title">לפני שמתחילים</h2>
            <p className="small">
              כדי לענות, האפליקציה שולחת ל-AI של Google סיכום קטן של הנתונים שלך: סכומים כוללים לפי חודש, קטגוריה, בית עסק וצורת תשלום. לא נשלחות פעולות בודדות, הערות או פרטי חשבון.
            </p>
            <button type="button" className="btn btn-primary" onClick={acceptConsent}>
              הבנתי, אפשר להמשיך
            </button>
          </section>
        )}

        <section className="card ai-ask" aria-label="שאלות">
          <h2 className="card-title">שאלות מוצעות</h2>
          <ul className="ai-suggest">
            {suggestions.map((q) => (
              <li key={q}>
                <button type="button" className="ai-suggest-btn" disabled={!canAsk || exhausted} onClick={() => void ask(q)}>
                  {q}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="link-btn" onClick={() => setSuggestions(pickQuestions(5, Math.random, suggestions))}>
            שאלות אחרות
          </button>
          <form className="ai-form" onSubmit={onSubmit}>
            <input
              className="input"
              value={draft}
              maxLength={500}
              placeholder="אפשר לכתוב שאלה משלך"
              aria-label="שאלה"
              onChange={(e) => setDraft(e.target.value)}
              disabled={!consent || exhausted}
            />
            <button type="submit" className="btn btn-primary btn-small" disabled={!canAsk || exhausted || !draft.trim()}>
              שליחה
            </button>
          </form>
          <p className="muted small" role="status">
            {!data.ready && !data.error
              ? 'טוען את הנתונים…'
              : quota
                ? exhausted
                  ? 'המכסה היומית נגמרה. אפשר להמשיך מחר.'
                  : `נותרו ${quota.remaining} שאלות היום`
                : ''}
          </p>
        </section>

        {error && (
          <div className="card error-card" role="alert">
            {error}
          </div>
        )}

        {(messages.length > 0 || busy) && (
          <section className="card ai-thread" aria-label="השיחה" aria-live="polite">
            {messages.map((m, i) => (
              <div key={`${i}-${m.role}`} className={`ai-msg ai-msg-${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="ai-msg ai-msg-model ai-typing">חושב…</div>}
            <div ref={threadEnd} />
            {!busy && messages.length > 0 && (
              <div className="ai-thread-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={newConversation}>
                  שיחה חדשה
                </button>
                {isSaved ? (
                  <button type="button" className="btn btn-secondary btn-small" onClick={togglePin}>
                    {pinned ? 'ביטול נעיצה' : 'נעיצה'}
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary btn-small" onClick={save}>
                    שמירת השיחה
                  </button>
                )}
              </div>
            )}
            <p className="muted small">התשובות הן הערכה כללית על סמך הנתונים באפליקציה, ואינן ייעוץ פיננסי, מס או השקעות.</p>
          </section>
        )}

        <button type="button" className="btn btn-secondary ai-history-btn" onClick={() => navigate(`/${space.key}/ai/history`)}>
          היסטוריה
        </button>
      </main>
    </div>
  );
}
