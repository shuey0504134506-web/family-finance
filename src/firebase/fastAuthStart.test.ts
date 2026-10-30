import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFastAuthStart, STARTUP_TIMEOUT_MS } from './fastAuthStart';

describe('פתיחה קרה: רענון הסשן לא תוקע את האפליקציה', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('רענון טוקן שלא נענה נכשל אחרי זמן קצר, וכניסה רגילה לא מתקצרת', async () => {
    vi.useFakeTimers();
    const hang = vi.fn(() => new Promise<Response>(() => undefined));
    const win = { fetch: hang, setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) };
    vi.stubGlobal('window', win);
    installFastAuthStart();
    const refresh = (win.fetch as typeof fetch)('https://securetoken.googleapis.com/v1/token?key=k');
    const caught = refresh.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS + 50);
    expect(await caught).toBeInstanceOf(TypeError);

    // כניסה עם סיסמה: עוברת כמו שהיא, בלי קיצור זמן
    const login = (win.fetch as typeof fetch)('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=k');
    let settled = false;
    void login.then(() => (settled = true), () => (settled = true));
    await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS * 5);
    expect(settled).toBe(false);
    vi.unstubAllGlobals();
  });
});
