import { useEffect, useState } from 'react';
import { readLocalLogo, subscribeLogo } from '../services/logoService';

/** הלוגו של עסק: קודם מהמכשיר (מיידי), ואז מהחשבון בזמן אמת. null = אין לוגו. */
export function useBusinessLogo(uid: string, businessId: string): string | null {
  const [logo, setLogo] = useState<string | null>(() => (businessId ? readLocalLogo(uid, businessId) : null));
  useEffect(() => {
    if (!businessId) {
      setLogo(null);
      return undefined;
    }
    setLogo(readLocalLogo(uid, businessId));
    return subscribeLogo(uid, businessId, setLogo);
  }, [uid, businessId]);
  return logo;
}
