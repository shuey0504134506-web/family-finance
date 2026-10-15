/** קריאות לפונקציות הענן (מסך הניהול). בחשבון אופליין או בלי רשת הן נכשלות בהודעה ברורה. */
export const functionsBackend: { call: (name: string, data: unknown) => Promise<unknown> } = {
  call: async () => { throw Object.assign(new Error('functions/unavailable'), { code: 'functions/unavailable' }); },
};
