import { useNavigate } from 'react-router-dom';
import { AI_SUPPORTED, useAiAccess } from '../../services/aiService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpace } from '../spaces/SpaceRoute';
import { useAiActivity } from './aiSession';

/** כפתור "סקירת AI" במסך הבית. מוצג רק למשתמש שהמנהל נתן לו גישה. */
export function AiEntryButton() {
  const navigate = useNavigate();
  const { user } = useReadyAuth();
  const space = useSpace();
  const allowed = useAiAccess(user.uid);
  const activity = useAiActivity(user.uid);
  if (!AI_SUPPORTED || !allowed) return null;
  return (
    <button
      type="button"
      className="ai-entry"
      data-activity={activity ?? undefined}
      aria-label={activity === 'busy' ? 'סקירת AI: חושב' : activity === 'unread' ? 'סקירת AI: יש תשובה חדשה' : 'סקירת AI'} onClick={() => navigate(`/${space.key}/ai`)}
    >
      <span className="ai-entry-full">סקירת AI</span>
      <span className="ai-entry-star" aria-hidden="true">
        ✦
      </span>
      <span className="ai-entry-short" aria-hidden="true">
        AI
      </span>
    </button>
  );
}

/** האם להציג את הכפתור (לשימוש המסך כדי להתאים את הברכה). */
export function useShowAiEntry(): boolean {
  const { user } = useReadyAuth();
  const allowed = useAiAccess(user.uid);
  return AI_SUPPORTED && allowed;
}
