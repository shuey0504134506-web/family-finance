import { useNavigate } from "react-router-dom";
import { AI_SUPPORTED, useAiAccess } from "../../services/aiService";
import { useReadyAuth } from "../auth/AuthContext";
import { useSpace } from "../spaces/SpaceRoute";
import { useAiActivity } from "./aiSession";

/** כפתור "סקירת AI" במסך הבית: שורה בסגנון הכרטיסים, מתחת לכפתורי ההוספה. מוצג רק למשתמש שהמנהל נתן לו גישה. */
export function AiEntryButton() {
  const navigate = useNavigate();
  const { user } = useReadyAuth();
  const space = useSpace();
  const allowed = useAiAccess(user.uid);
  const activity = useAiActivity(user.uid);
  if (!AI_SUPPORTED || !allowed) return null;
  const hint =
    activity === "busy"
      ? "חושב על השאלה…"
      : activity === "unread"
        ? "יש תשובה חדשה"
        : "שאל שאלות על הנתונים שלך";
  return (
    <button
      type="button"
      className="card ai-card"
      data-activity={activity ?? undefined}
      onClick={() => navigate(`/${space.key}/ai`)}
    >
      <span className="ai-card-icon" aria-hidden="true">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
      </span>
      <span className="ai-card-text">
        <b>סקירת AI</b>
        <span>{hint}</span>
      </span>
      <span className="ai-card-chevron" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}
