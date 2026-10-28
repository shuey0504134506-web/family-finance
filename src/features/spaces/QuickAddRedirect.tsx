import { Navigate, useParams } from 'react-router-dom';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import { useSpaces } from './SpacesContext';

/** כניסה מהווידג'ט או מקיצור הלחיצה הארוכה: טופס הוספה במרחב הראשון (עסק, ואחריו משק הבית). */
export function QuickAddRedirect() {
  const { type } = useParams();
  const { ready, defaultSpace } = useSpaces();
  if (!ready) return <FullScreenMessage title="טוען…" />;
  const kind = type === 'income' ? 'income' : 'expense';
  return <Navigate to={`/${defaultSpace.key}/add/${kind}`} replace />;
}
