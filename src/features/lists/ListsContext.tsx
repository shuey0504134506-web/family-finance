import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ShoppingItem, Task } from '../../domain/tasks';
import { subscribeShoppingItems, subscribeTasks } from '../../services/listService';

interface ListsValue {
  tasks: Task[];
  items: ShoppingItem[];
  /** true עד שהמשימות נטענו (מהמטמון או מהשרת). */
  loading: boolean;
  error: boolean;
}

const ListsContext = createContext<ListsValue | null>(null);

/** משימות ורשימת קניות של שני התחומים, בזמן אמת. נטענות פעם אחת לכל האפליקציה. */
export function ListsProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [state, setState] = useState<{ tasks: Task[]; items: ShoppingItem[]; tasksReady: boolean; itemsReady: boolean; error: boolean }>({
    tasks: [], items: [], tasksReady: false, itemsReady: false, error: false,
  });

  useEffect(() => {
    const offTasks = subscribeTasks(
      uid,
      (tasks) => setState((s) => ({ ...s, tasks, tasksReady: true })),
      () => setState((s) => ({ ...s, tasks: [], tasksReady: true, error: true })),
    );
    const offItems = subscribeShoppingItems(
      uid,
      (items) => setState((s) => ({ ...s, items, itemsReady: true })),
      () => setState((s) => ({ ...s, items: [], itemsReady: true, error: true })),
    );
    return () => {
      offTasks();
      offItems();
    };
  }, [uid]);

  const value = useMemo<ListsValue>(
    () => ({ tasks: state.tasks, items: state.items, loading: !(state.tasksReady && state.itemsReady), error: state.error }),
    [state],
  );
  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists(): ListsValue {
  const value = useContext(ListsContext);
  if (!value) throw new Error('useLists must be used inside ListsProvider');
  return value;
}
