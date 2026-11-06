import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../../components/ScreenHeader";
import { formatDisplayDate } from "../../domain/dates";
import {
  MAX_RECENT_QUESTIONS,
  MAX_SAVED_CHATS,
  deleteAiChat,
  saveAiChat,
  saveRecentQuestions,
  subscribeAiChats,
  subscribeRecentQuestions,
  type AiChat,
  type RecentQuestion,
} from "../../services/aiService";
import { useReadyAuth } from "../auth/AuthContext";
import { useSpace } from "../spaces/SpaceRoute";
import { useSyncNotice } from "../sync/SyncNotice";

const dateOf = (ms: number) =>
  formatDisplayDate(
    new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }),
  );

/** היסטוריה: הסבר על ההגבלות, השיחות השמורות (עד חמש), והשאלות האחרונות. */
export function AiHistoryScreen() {
  const { user } = useReadyAuth();
  const space = useSpace();
  const navigate = useNavigate();
  const { reportFailure } = useSyncNotice();
  const [chats, setChats] = useState<AiChat[] | null>(null);
  const [recent, setRecent] = useState<RecentQuestion[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(
    () => subscribeAiChats(user.uid, setChats, () => setChats([])),
    [user.uid],
  );
  useEffect(
    () => subscribeRecentQuestions(user.uid, setRecent, () => setRecent([])),
    [user.uid],
  );

  const open = (state: { chat?: AiChat; ask?: string }) =>
    navigate(`/${space.key}/ai`, { state: { ...state, from: "history" } });

  return (
    <div className={`app-shell scope-${space.scope}`}>
      <ScreenHeader title="היסטוריה · סקירת AI" backTo={`/${space.key}/ai`} />
      <main className="content ai-page">
        <section className="card" aria-label="הסבר">
          <h2 className="card-title">איך זה עובד</h2>
          <ul className="ai-rules small">
            <li>
              סקירת ה-AI עונה רק על נושאי הכספים שלך, חיסכון, תקציב והאפליקציה.
              על כל נושא אחר היא לא תענה.
            </li>
            <li>
              היא מסתמכת על הנתונים המלאים של המרחב: כל הפעולות מתחילת התיעוד,
              תקציבים, חובות והוראות קבע. תמונות מצורפות לא נשלחות.
            </li>
            <li>
              יש מכסה יומית של שאלות לכל משתמש. כשהיא נגמרת אפשר להמשיך למחרת.
            </li>
            <li>התשובות הן הערכה כללית ואינן ייעוץ פיננסי, מס או השקעות.</li>
            <li>{`אפשר לשמור עד ${MAX_SAVED_CHATS} שיחות. שיחה נעוצה לא נמחקת אוטומטית, וכשמוסיפים שיחה נוספת נמחקת הלא נעוצה הישנה ביותר.`}</li>
            <li>{`${MAX_RECENT_QUESTIONS} השאלות האחרונות נשמרות כאן, ואפשר לשאול אותן שוב בלחיצה.`}</li>
            <li>
              השיחות והשאלות נשמרות בחשבון שלך ומופיעות בכל מכשיר שבו אתה מחובר.
            </li>
          </ul>
        </section>

        <section className="card" aria-label="שיחות שמורות">
          <h2 className="card-title">{`שיחות שמורות (${chats?.length ?? 0}/${MAX_SAVED_CHATS})`}</h2>
          {chats === null ? (
            <p className="muted small" role="status">
              טוען…
            </p>
          ) : chats.length === 0 ? (
            <p className="muted small">
              אין שיחות שמורות. בסיום שיחה אפשר ללחוץ על "שמירת השיחה".
            </p>
          ) : (
            <ul className="ai-saved">
              {chats.map((c) => (
                <li key={c.id} className="ai-saved-row">
                  <button
                    type="button"
                    className="ai-saved-main"
                    onClick={() => open({ chat: c })}
                  >
                    <span className="ai-saved-title">{`${c.pinned ? "📌 " : ""}${c.title}`}</span>
                    <span className="muted small">{dateOf(c.updatedAt)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() =>
                      saveAiChat(user.uid, { ...c, pinned: !c.pinned }).catch(
                        () => reportFailure("לא הצלחנו לעדכן את השיחה."),
                      )
                    }
                  >
                    {c.pinned ? "ביטול נעיצה" : "נעיצה"}
                  </button>
                  {confirmId === c.id ? (
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-small"
                      onClick={() => {
                        deleteAiChat(user.uid, c.id).catch(() =>
                          reportFailure("לא הצלחנו למחוק את השיחה."),
                        );
                        setConfirmId(null);
                      }}
                    >
                      למחוק?
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => setConfirmId(c.id)}
                    >
                      מחיקה
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-label="שאלות אחרונות">
          <h2 className="card-title">שאלות אחרונות</h2>
          {recent === null ? (
            <p className="muted small" role="status">
              טוען…
            </p>
          ) : recent.length === 0 ? (
            <p className="muted small">עדיין לא נשאלו שאלות.</p>
          ) : (
            <>
              <ul className="ai-saved">
                {recent.map((r) => (
                  <li key={r.q} className="ai-saved-row">
                    <button
                      type="button"
                      className="ai-saved-main"
                      onClick={() => open({ ask: r.q })}
                    >
                      <span className="ai-saved-title">{r.q}</span>
                      <span className="muted small">{dateOf(r.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  saveRecentQuestions(user.uid, []).catch(() =>
                    reportFailure("לא הצלחנו לנקות את הרשימה."),
                  )
                }
              >
                ניקוי רשימת השאלות
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
