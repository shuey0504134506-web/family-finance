import { useEffect, useState } from 'react';
import { subscribeHiddenDebtCategories } from '../services/debtCategoriesService';

/** קטגוריות החובות שהוסרו מהרשימה, בזמן אמת. עד שנטענו: רשימה ריקה. */
export function useHiddenDebtCategories(uid: string): string[] {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => subscribeHiddenDebtCategories(uid, setHidden, () => setHidden([])), [uid]);
  return hidden;
}
