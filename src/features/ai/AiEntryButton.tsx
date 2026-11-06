import { useNavigate } from 'react-router-dom';
import { AI_SUPPORTED, useAiAccess } from '../../services/aiService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSpace } from '../spaces/SpaceRoute';

/** כפתור "סקירת AI" במסך הבית. מוצג רק למשתמש שהמנהל נתן לו גישה. */
export function AiEntryButton() {
  const navigate = useNavigate();
  const { user } = useReadyAuth();
  const space = useSpace();
  const allowed = useAiAccess(user.uid);
  if (!AI_SUPPORTED || !allowed) return null;
  return (
    <button type="button" className="ai-entry" onClick={() => navigate(`/${space.key}/ai`)}>
      סקירת AI
    </button>
  );
}

/** האם להציג את הכפתור (לשימוש המסך כדי להתאים את הברכה). */
export function useShowAiEntry(): boolean {
  const { user } = useReadyAuth();
  const allowed = useAiAccess(user.uid);
  return AI_SUPPORTED && allowed;
}
