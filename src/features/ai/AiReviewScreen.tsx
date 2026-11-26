import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AI_QUESTION_BANK, pickQuestions } from "../../domain/aiQuestions";
import { getLang } from "../../i18n/lang";
import { tr } from "../../i18n/translate";
import {
  loadAiQuota,
  deleteAiChat,
  toggleAiChatPin,
  subscribeAiChats,
  type StoredAiChat,
} from "../../services/aiService";
import { useReadyAuth } from "../auth/AuthContext";
import { useSpace } from "../spaces/SpaceRoute";
import { useSpaces } from "../spaces/SpacesContext";
import { useSyncNotice } from "../sync/SyncNotice";
import {
  askInSession,
  markSeen,
  openChat,
  setQuota,
  startNewChat,
  takeFailedDraft,
  useAiSession,
} from "./aiSession";
import { useAiSummaryData } from "./useAiSummaryData";
import { AiChatHistory } from "./AiChatHistory";
import { AiMarkdown } from "./AiMarkdown";
import { useAiViewport } from "./useAiViewport";

const consentKey = (uid: string) => `ff.ai.consent.v3.${uid}`;
const readConsent = (uid: string): boolean => {
  try {
    return localStorage.getItem(consentKey(uid)) === "1";
  } catch {
    return false;
  }
};

/** חיווי "חושב" חי: נקודות מונפשות ושעון שניות, כדי שיהיה ברור שהמודל עובד ולא נתקע. */
function ThinkingIndicator({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = startedAt
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0;
  return (
    <div className="ai-msg ai-msg-model ai-typing" role="status">
      <span>חושב</span>
      <span className="ai-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {seconds >= 3 ? (
        <span className="ai-typing-time">{seconds} שנ'</span>
      ) : null}
    </div>
  );
}

export function AiReviewScreen({ initialHistory = false }: { initialHistory?: boolean } = {}) {
  const { user, profile } = useReadyAuth();
  const space = useSpace();
  const { nameOf } = useSpaces();
  const { reportFailure } = useSyncNotice();
  const data = useAiSummaryData();
  const shellRef = useRef<HTMLDivElement>(null);
  useAiViewport(shellRef);

  const [consent, setConsent] = useState(() => readConsent(user.uid));
  const session = useAiSession(user.uid);
  const { chatId, messages, busy, startedAt, partial, error, quota } = session;
  const [suggestion, setSuggestion] = useState("");
  const [typed, setTyped] = useState("");
  const [suggestionFocused, setSuggestionFocused] = useState(false);
  const welcomeVisible = messages.length === 0 && !busy && consent;
  const questionQueue = useRef<string[]>([]);
  const lastQuestion = useRef("");
  useEffect(() => {
    setSuggestion("");
    setTyped("");
    setSuggestionFocused(false);
    if (!welcomeVisible) return;
    let previous = lastQuestion.current;
    try { previous = sessionStorage.getItem("ff.ai.lastSuggestion") || previous; } catch { /* storage unavailable */ }
    questionQueue.current = pickQuestions(AI_QUESTION_BANK.length).map(tr);
    if (questionQueue.current[0] === previous && questionQueue.current.length > 1) questionQueue.current.push(questionQueue.current.shift()!);
    setSuggestion(questionQueue.current.shift() ?? "");
  }, [chatId, welcomeVisible]);
  useEffect(() => {
    if (!welcomeVisible || !suggestion) return;
    lastQuestion.current = suggestion;
    try { sessionStorage.setItem("ff.ai.lastSuggestion", suggestion); } catch { /* storage unavailable */ }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(suggestion);
      return;
    }
    let index = 0;
    setTyped("");
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(suggestion.slice(0, index));
      if (index >= suggestion.length) window.clearInterval(timer);
    }, 35);
    return () => window.clearInterval(timer);
  }, [suggestion, welcomeVisible]);
  useEffect(() => {
    if (!welcomeVisible || !suggestion || typed !== suggestion || suggestionFocused) return;
    const timer = window.setTimeout(() => {
      if (!questionQueue.current.length) {
        questionQueue.current = pickQuestions(AI_QUESTION_BANK.length).map(tr);
        if (questionQueue.current[0] === suggestion && questionQueue.current.length > 1) questionQueue.current.push(questionQueue.current.shift()!);
      }
      setTyped("");
      setSuggestion(questionQueue.current.shift() ?? "");
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [welcomeVisible, suggestion, typed, suggestionFocused]);
  const [deep, setDeep] = useState(false);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState<StoredAiChat[]>([]);
  const [historyOpen, setHistoryOpen] = useState(initialHistory);
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(
    () => subscribeAiChats(user.uid, setSaved, () => undefined),
    [user.uid],
  );
  useEffect(() => {
    if (!historyOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setHistoryOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [historyOpen]);
  useEffect(() => {
    loadAiQuota()
      .then((q) => setQuota(user.uid, q))
      .catch(() => undefined);
  }, [user.uid]);
  // שאלה שנכשלה חוזרת לשורת הכתיבה
  useEffect(() => {
    if (session.failedDraft) setDraft(takeFailedDraft(user.uid));
  }, [session.failedDraft, user.uid]);
  // כל מה שהיה בדרך ונענה בזמן שהמשתמש לא היה כאן נחשב כנראה, ברגע שחוזרים
  useEffect(() => {
    markSeen(user.uid);
  }, [user.uid, session.unread]);
  const hasPartial = partial.length > 0;
  useEffect(() => {
    const scroll = scrollRef.current;
    const end = threadEnd.current;
    if (!scroll || !end) return;
    // Scroll only the thread; scrollIntoView may pan the Android webview
    // itself while the keyboard is open, hiding the composer.
    const viewport = scroll.getBoundingClientRect();
    const marker = end.getBoundingClientRect();
    if (marker.bottom > viewport.bottom) scroll.scrollTop += marker.bottom - viewport.bottom;
    else if (marker.top < viewport.top) scroll.scrollTop -= viewport.top - marker.top;
  }, [messages.length, busy, hasPartial]);

  const isSaved = saved.some((c) => c.id === chatId);
  const pinned = saved.find((c) => c.id === chatId)?.pinned ?? false;

  const ask = (raw: string) => {
    const q = raw.trim();
    if (!q || busy || !data.ready || data.error || !consent || (quota !== null && quota.remaining <= 0)) return;
    setDraft("");
    askInSession(user.uid, q, data.build, { saved }, { deep, lang: getLang(), remoteConsent: consent });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(draft);
  };

  const newConversation = () => {
    startNewChat(user.uid);
  };

  const togglePin = () => {
    const existing = saved.find((c) => c.id === chatId);
    if (!existing) return;
    toggleAiChatPin(user.uid, existing).catch(() =>
      reportFailure("לא הצלחנו לעדכן את השיחה."),
    );
  };

  const acceptConsent = () => {
    try {
      localStorage.setItem(consentKey(user.uid), "1");
    } catch {
      /* אחסון חסום: ההסכמה תתבקש שוב בפעם הבאה */
    }
    setConsent(true);
  };

  const canAsk = consent && data.ready && !data.error && !busy;
  const exhausted = quota !== null && quota.remaining <= 0;
  const title = useMemo(() => `סקירת AI · ${nameOf(space)}`, [nameOf, space]);

  return (
    <div ref={shellRef} className={`app-shell has-hero ai-chat-shell scope-${space.scope}`}>
      <ScreenHeader
        title={title}
        backTo={`/${space.key}`}
      />
      <div className="ai-chat-layout">
      <main className="content ai-chat-page" aria-busy={busy}>
        <div className="ai-chat-top"><button type="button" className="btn btn-secondary btn-small" aria-controls="ai-chat-history" aria-expanded={historyOpen} onClick={() => setHistoryOpen(true)}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2"/></svg>היסטוריה</button></div>
        <div ref={scrollRef} className="ai-chat-scroll">
        {!consent && (
          <section className="card ai-consent" aria-label="לפני שמתחילים">
            <h2 className="card-title">לפני שמתחילים</h2>
            <p className="small">
              כדי לענות, האפליקציה שולחת לספק ה-AI שהוגדר על ידי מנהל האפליקציה את הנתונים הכספיים של
              המרחב הזה: הפעולות (כולל שמות בתי עסק והערות), התקציבים, החובות
              והוראות הקבע. לא נשלחים תמונות מצורפות, סיסמאות או פרטי חשבון.
              במסלול חינמי ספקים כגון Google עשויים להשתמש בתוכן לשיפור השירות בהתאם למדיניות הפרטיות שלהם. אין להזין פרטים רגישים בשאלות.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={acceptConsent}
            >
              הבנתי, אפשר להמשיך
            </button>
          </section>
        )}

        {messages.length === 0 && !busy && consent && (
          <section className="ai-welcome"><h2>שלום{profile.firstName ? `, ${profile.firstName}` : ""}</h2><p>מה תרצה לשאול היום?</p><div className="ai-welcome-prompt">{suggestion && <button type="button" className="ai-welcome-suggestion" disabled={!canAsk || exhausted || typed !== suggestion} onFocus={() => setSuggestionFocused(true)} onBlur={() => setSuggestionFocused(false)} onClick={() => ask(suggestion)} aria-label={suggestion}><span aria-hidden="true">{typed}{typed !== suggestion && <span className="ai-type-cursor">|</span>}</span>{typed === suggestion && <small className="ai-suggestion-hint">לחץ לשאול</small>}</button>}</div></section>
        )}
        {error && (
          <div className="card error-card" role="alert">
            {error}
          </div>
        )}

        {(messages.length > 0 || busy) && (
          <section
            className="ai-thread"
            aria-label="השיחה"
            aria-live="polite"
          >
            {messages.map((m, i) => (
              <div key={`${i}-${m.role}`} className={`ai-msg ai-msg-${m.role}`} translate="no">
                {m.role === 'model' ? <AiMarkdown message={m}/> : m.text}
              </div>
            ))}
            {busy && partial ? (
              <div className="ai-msg ai-msg-model"><AiMarkdown message={{text:partial}}/></div>
            ) : null}
            {busy && !partial ? (
              <ThinkingIndicator startedAt={startedAt} />
            ) : null}
            <div ref={threadEnd} />
            {!busy && messages.length > 0 && (
              <div className="ai-thread-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={newConversation}
                >
                  שיחה חדשה
                </button>
                {isSaved ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={togglePin}
                  >
                    {pinned ? "ביטול נעיצה" : "נעיצה"}
                  </button>
                ) : null}
              </div>
            )}
            {!busy && messages.length > 0 && <p className="ai-chat-disclaimer muted small">התשובות הן הערכה כללית על סמך הנתונים באפליקציה, ואינן ייעוץ פיננסי, מס או השקעות.</p>}
          </section>
        )}

        </div>
        <form className="card ai-composer" onSubmit={onSubmit}>
          <textarea className="input" rows={1} value={draft} maxLength={500} placeholder="שאל שאלה…" aria-label="שאלה" onChange={e => setDraft(e.target.value)} disabled={!consent || exhausted} />
          <div className="ai-composer-actions">
            <select className="input" aria-label="עוצמת חשיבה" value={deep ? "deep" : "normal"} onChange={e => setDeep(e.target.value === "deep")} disabled={busy}>
              <option value="normal">חשיבה רגילה</option><option value="deep">חשיבה מעמיקה</option>
            </select>
            <button type="submit" className="btn btn-primary ai-send" aria-label="שליחה" disabled={!canAsk || exhausted || !draft.trim()}><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
          </div>
          {(!data.ready || exhausted || data.error) && <p className="muted small" role="status">{data.error ? "טעינת הנתונים נכשלה" : exhausted ? "המכסה היומית נגמרה" : "טוען נתונים…"}</p>}
        </form>
      </main>
      <AiChatHistory chats={saved} active={chatId} open={historyOpen} onClose={() => setHistoryOpen(false)} busy={busy} onNew={newConversation} onOpen={chat => openChat(user.uid, chat)} onPin={chat => { void toggleAiChatPin(user.uid, chat).catch(() => reportFailure('לא הצלחנו לעדכן את השיחה.')); }} onDelete={async chat => { try { await deleteAiChat(user.uid, chat.id); if (chat.id === chatId) newConversation(); } catch { reportFailure('לא הצלחנו למחוק את השיחה.'); } }} />
      </div>
    </div>
  );
}
