import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Controller, UiState } from './controller';

export const ControllerContext = createContext<Controller | null>(null);

export function useController(): Controller {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('useController מחוץ ל-ControllerContext');
  return c;
}

export function useUi(): UiState {
  const c = useController();
  return useSyncExternalStore(c.subscribe, c.getState);
}
