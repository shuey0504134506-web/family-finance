import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AI_QUESTION_BANK, pickQuestions } from "../../domain/aiQuestions";
import { getLang } from "../../i18n/lang";
import {
  loadAiQuota,
  saveAiChat,
  subscribeAiChats,
  subscribeRecentQuestions,
  type AiChat,
  type RecentQuestion,
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

const consentKey = (uid: string) => `ff.ai.consent.v2.${uid}`;
const readConsent = (uid: string): boolean => {
  try {
    return localStorage.getItem(consentKey(uid)) === "1";
  } catch {
    return false;
  }
};

interface NavState {
  chat?: AiChat;
  ask?: string;
  /** נפתח מההיסטוריה: חזרה מחזירה אליה ולא למסך הבית */
  from?: "history";
}

/** סקירת AI: חמש שאלות מוצעות מהמאגר, שורת שאלה חופשית, השיחה, וכפתור להיסטוריה. */
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

export function AiReviewScreen() {
  const { user, profile } = useReadyAuth();
  const space = useSpace();
  const { nameOf } = useSpaces();
  const navigate = useNavigate();
  const { reportFailure } = useSyncNotice();
  const nav = (useLocation().state ?? {}) as NavState;
  const data = useAiSummaryData();

  const [consent, setConsent] = useState(() => readConsent(user.uid));
  const session = useAiSession(user.uid);
  const { chatId, messages, busy, startedAt, partial, error, quota } = session;
  const [suggestion, setSuggestion] = useState("");
  const [suggestionFocused, setSuggestionFocused] = useState(false);
  const welcomeVisible = messages.length === 0 && !busy && consent;
  useEffect(() => {
    setSuggestion("");
    setSuggestionFocused(false);
  }, [chatId, welcomeVisible]);
  useEffect(() => {
    if (!welcomeVisible || suggestionFocused) return;
    const questions = pickQuestions(AI_QUESTION_BANK.length);
    let index = 0;
    const timer = window.setInterval(() => {
      setSuggestion(questions[index % questions.length] ?? "");
      index += 1;
    }, 10000);
    return () => window.clearInterval(timer);
  }, [chatId, welcomeVisible, suggestionFocused]);
  const [deep, setDeep] = useState(false);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState<AiChat[]>([]);
  const [recent, setRecent] = useState<RecentQuestion[]>([]);
  const threadEnd = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  useEffect(
    () => subscribeAiChats(user.uid, setSaved, () => undefined),
    [user.uid],
  );
  useEffect(
    () => subscribeRecentQuestions(user.uid, setRecent, () => undefined),
    [user.uid],
  );
  useEffect(() => {
    loadAiQuota()
      .then((q) => setQuota(user.uid, q))
      .catch(() => undefined);
  }, [user.uid]);
  // כניסה משיחה שמורה בהיסטוריה
  useEffect(() => {
    if (nav.chat) openChat(user.uid, nav.chat);
  }, [nav.chat, user.uid]);
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
    threadEnd.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages.length, busy, hasPartial]);

  const isSaved = saved.some((c) => c.id === chatId);
  const pinned = saved.find((c) => c.id === chatId)?.pinned ?? false;

  const ask = (raw: string) => {
    const q = raw.trim();
    if (!q || busy || !data.ready || data.error || !consent || (quota !== null && quota.remaining <= 0)) return;
    setDraft("");
    askInSession(user.uid, q, data.build, { saved, recent }, { deep, lang: getLang() });
  };

  // כניסה משאלה מההיסטוריה: נשאלת אוטומטית ברגע שהנתונים מוכנים
  useEffect(() => {
    if (!nav.ask || autoAsked.current || !data.ready || !consent) return;
    autoAsked.current = true;
    ask(nav.ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.ask, data.ready, consent]);

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
    saveAiChat(user.uid, { ...existing, pinned: !existing.pinned }).catch(() =>
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
    <div className={`app-shell has-hero ai-chat-shell scope-${space.scope}`}>
      <ScreenHeader
        title={title}
        backTo={
          nav.from === "history" ? `/${space.key}/ai/history` : `/${space.key}`
        }
      />
      <main className="content ai-page ai-chat-page" aria-busy={busy}>
        <div className="ai-chat-top"><button type="button" className="btn btn-secondary btn-small" onClick={() => navigate(`/${space.key}/ai/history`)}>היסטוריה</button></div>
        <div className="ai-chat-scroll">
        {!consent && (
          <section className="card ai-consent" aria-label="לפני שמתחילים">
            <h2 className="card-title">לפני שמתחילים</h2>
            <p className="small">
              כדי לענות, האפליקציה שולחת לספק ה-AI שהוגדר על ידי מנהל האפליקציה את הנתונים הכספיים של
              המרחב הזה: הפעולות (כולל שמות בתי עסק והערות), התקציבים, החובות
              והוראות הקבע. לא נשלחים תמונות מצורפות, סיסמאות או פרטי חשבון.
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
          <section className="ai-welcome"><h2>שלום{profile.firstName ? `, ${profile.firstName}` : ""}</h2><div className="ai-welcome-prompt">{suggestion ? <button type="button" className="ai-welcome-suggestion" disabled={!canAsk || exhausted} onFocus={() => setSuggestionFocused(true)} onBlur={() => setSuggestionFocused(false)} onClick={() => ask(suggestion)}>{suggestion}</button> : <p>מה תרצה לשאול היום?</p>}</div></section>
        )}
        {error && (
          <div className="card error-card" role="alert">
            {error}
          </div>
        )}

        {(messages.length > 0 || busy) && (
          <section
            className="card ai-thread"
            aria-label="השיחה"
            aria-live="polite"
          >
            {messages.map((m, i) => (
              <div key={`${i}-${m.role}`} className={`ai-msg ai-msg-${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && partial ? (
              <div className="ai-msg ai-msg-model">{partial}</div>
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
            <p className="muted small">
              התשובות הן הערכה כללית על סמך הנתונים באפליקציה, ואינן ייעוץ
              פיננסי, מס או השקעות.
            </p>
          </section>
        )}

        </div>
        <form className="card ai-composer" onSubmit={onSubmit}>
          <textarea className="input" rows={2} value={draft} maxLength={500} placeholder="כתוב שאלה…" aria-label="שאלה" onChange={e => setDraft(e.target.value)} disabled={!consent || exhausted} />
          <div className="ai-composer-actions">
            <select className="input" aria-label="עוצמת חשיבה" value={deep ? "deep" : "normal"} onChange={e => setDeep(e.target.value === "deep")} disabled={busy}>
              <option value="normal">חשיבה רגילה</option><option value="deep">חשיבה מעמיקה</option>
            </select>
            <button type="submit" className="btn btn-primary ai-send" aria-label="שליחה" disabled={!canAsk || exhausted || !draft.trim()}>↑</button>
          </div>
          {(!data.ready || exhausted || data.error) && <p className="muted small" role="status">{data.error ? "טעינת הנתונים נכשלה" : exhausted ? "המכסה היומית נגמרה" : "טוען נתונים…"}</p>}
        </form>
      </main>
    </div>
  );
}
