import { useEffect, useState } from 'react';
import type { Category } from '../domain/types';
import { subscribeCategories } from '../services/categoryService';

export function useCategories(uid: string): { categories: Category[]; loading: boolean } {
  const [state, setState] = useState<{ categories: Category[]; loading: boolean }>({
    categories: [],
    loading: true,
  });

  useEffect(
    () =>
      subscribeCategories(
        uid,
        (categories) => setState({ categories, loading: false }),
        () => setState({ categories: [], loading: false }),
      ),
    [uid],
  );

  return state;
}
