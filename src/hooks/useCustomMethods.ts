import { useEffect, useState } from 'react';
import { NO_CUSTOM_METHODS, subscribeCustomMethods, type CustomMethods } from '../services/paymentMethodsService';

/** אמצעי התשלום האישיים של המשתמש, בזמן אמת. עד שנטענו: רשימה ריקה. */
export function useCustomMethods(uid: string): CustomMethods {
  const [methods, setMethods] = useState<CustomMethods>(NO_CUSTOM_METHODS);
  useEffect(() => subscribeCustomMethods(uid, setMethods, () => setMethods(NO_CUSTOM_METHODS)), [uid]);
  return methods;
}
