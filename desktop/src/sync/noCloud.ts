import type { CloudAuth } from './firebaseCloud';

const unavailable = (): never => {
  throw Object.assign(new Error('offline-only'), { code: 'auth/not-configured' });
};

/** ענן "ריק" לגרסת הטלפון: חשבון לא מקוון בלבד, בלי שום פנייה לשרת. */
export function createNoCloud(): CloudAuth {
  return {
    configured: false,
    signIn: async () => unavailable(),
    signUp: async () => unavailable(),
    signOut: async () => undefined,
    reauth: async () => unavailable(),
    changePassword: async () => unavailable(),
    resetEmail: async () => unavailable(),
    changeEmail: async () => unavailable(),
    deleteAccount: async () => unavailable(),
    call: async () => unavailable(),
    store: () => unavailable(),
  };
}
