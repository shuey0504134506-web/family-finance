import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import { useSpaces } from './SpacesContext';

/** כמה מחכים לרשימת העסקים לפני שפותחים את הטופס בכל זאת (בלי אינטרנט ובלי מטמון). */
const MAX_WAIT_MS = 600;

/**
 * כניסה מהווידג'ט או מקיצור הלחיצה הארוכה: טופס הוספה במרחב הראשון (עסק, ואחריו משק הבית).
 * לא ממתין לנתונים: רשימת העסקים נשמרת במכשיר, ואם היא עוד לא זמינה הטופס נפתח אחרי רגע קצר.
 */
export function QuickAddRedirect() {
  const { type } = useParams();
  const { ready, defaultSpace } = useSpaces();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, []);
  if (!ready && !waited) return <FullScreenMessage title="טוען…" />;
  const kind = type === 'income' ? 'income' : 'expense';
  return <Navigate to={`/${defaultSpace.key}/add/${kind}`} replace />;
}
