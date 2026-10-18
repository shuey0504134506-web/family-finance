import { useEffect, useMemo } from 'react';
import { HashRouter } from 'react-router-dom';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { FullScreenMessage } from '../../../src/components/FullScreenMessage';
import { AuthProvider } from '../../../src/features/auth/AuthContext';
import { MonthProvider } from '../../../src/features/month/MonthContext';
import { SyncNoticeProvider } from '../../../src/features/sync/SyncNotice';
import { PRIVACY_LABEL_FULL, PRIVACY_LABEL_SHORT, PrivacyLabelContext } from '../../../src/features/privacy/privacyLabel';
import { createProfile } from './createRecords';
import { Controller } from './controller';
import { DesktopRoutes } from './DesktopRoutes';
import { EntryFlow } from './EntryFlow';
import { createStorage } from './storage';
import { ControllerContext, useUi } from './useController';
import { createFirebaseCloud, type CloudAuth } from '../sync/firebaseCloud';
import { createNoCloud } from '../sync/noCloud';
import { IS_PHONE } from './target';

/** בבדיקות קצה-לקצה (mode=e2e בלבד) אפשר להזריק ענן מדומה. בבנייה רגילה הענף הזה נמחק. */
function pickCloud(): CloudAuth {
  if (IS_PHONE) return createNoCloud();
  if (import.meta.env.MODE === 'e2e') {
    const fake = (window as unknown as { __fakeCloud?: CloudAuth }).__fakeCloud;
    if (fake) return fake;
  }
  return createFirebaseCloud();
}

export function DesktopApp() {
  const controller = useMemo(() => new Controller(createStorage(), pickCloud(), createProfile), []);

  useEffect(() => {
    void controller.boot();
    const on = () => controller.setOnline(true);
    const off = () => controller.setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    // שמירה אחרונה לפני סגירת החלון
    const flush = () => { void controller.flushNow(); };
    window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeunload', flush); };
  }, [controller]);

  return (
    <ControllerContext.Provider value={controller}>
      <ErrorBoundary>
        <Gate />
      </ErrorBoundary>
    </ControllerContext.Provider>
  );
}

function Gate() {
  const ui = useUi();
  if (ui.phase === 'booting') return <FullScreenMessage title="טוען…" />;
  if (ui.phase === 'picker') return <EntryFlow />;
  // בחשבון מנותק אין יצירת קשר עם מפעיל האפליקציה, ולכן גם השם קצר יותר
  const label = ui.me?.kind === 'offline' ? PRIVACY_LABEL_SHORT : PRIVACY_LABEL_FULL;
  return (
    <PrivacyLabelContext.Provider value={label}>
      <AuthProvider>
        <MonthProvider>
          <SyncNoticeProvider>
            <HashRouter>
              <DesktopRoutes phone={IS_PHONE} />
            </HashRouter>
          </SyncNoticeProvider>
        </MonthProvider>
      </AuthProvider>
    </PrivacyLabelContext.Provider>
  );
}
