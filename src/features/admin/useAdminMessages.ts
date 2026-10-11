import { useEffect, useState } from 'react';
import { subscribeAdminMessages, type AdminMessage } from '../../services/adminService';

/** הודעות המשתמשים בזמן אמת. null = עדיין נטען. */
export function useAdminMessages(): { list: AdminMessage[] | null; error: boolean } {
  const [list, setList] = useState<AdminMessage[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(
    () =>
      subscribeAdminMessages(
        (l) => {
          setList(l);
          setError(false);
        },
        () => setError(true),
      ),
    [],
  );
  return { list, error };
}
