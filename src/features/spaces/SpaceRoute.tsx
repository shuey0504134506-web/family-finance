import { createContext, useContext } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import { parseSpaceKey, type Space } from '../../domain/spaces';
import { useSpaces } from './SpacesContext';

const CurrentSpaceContext = createContext<Space | null>(null);

/**
 * עוטף את כל המסכים שנתיבם `/:scope/...`. בודק שהמרחב שבכתובת קיים ומוצג במכשיר הזה,
 * ואם לא מעביר למרחב ברירת המחדל. המסכים שבפנים מקבלים מרחב תקין מ-useSpace.
 */
export function SpaceRoute() {
  const params = useParams();
  const { ready, spaces, defaultSpace } = useSpaces();
  const parsed = parseSpaceKey(params.scope);
  if (!ready) return <FullScreenMessage title="טוען…" />;
  const space = parsed && spaces.find((s) => s.key === parsed.key);
  if (!space) return <Navigate to={`/${defaultSpace.key}`} replace />;
  return (
    <CurrentSpaceContext.Provider value={space}>
      <Outlet />
    </CurrentSpaceContext.Provider>
  );
}

export function useSpace(): Space {
  const space = useContext(CurrentSpaceContext);
  if (!space) throw new Error('useSpace חייב לפעול בתוך SpaceRoute');
  return space;
}

/** המרחב הנוכחי אם נמצאים בתוך מסך מרחב, אחרת null (למשל בסיכומים או בהגדרות). */
export function useOptionalSpace(): Space | null {
  return useContext(CurrentSpaceContext);
}
