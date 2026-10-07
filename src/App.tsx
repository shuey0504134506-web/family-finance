import { HashRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { firebaseReady } from './firebase/config';
import { AuthProvider } from './features/auth/AuthContext';
import { SyncNoticeProvider } from './features/sync/SyncNotice';
import { MonthProvider } from './features/month/MonthContext';
import { NotConfiguredScreen } from './features/setup/NotConfiguredScreen';
import { AppRoutes } from './routes';

/**
 * HashRouter: עובד בכל אחסון סטטי וגם כשהאפליקציה תיארז כאפליקציית אנדרואיד,
 * בלי הגדרות שרת מיוחדות.
 */
export default function App() {
  if (!firebaseReady) return <NotConfiguredScreen />;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <MonthProvider>
          <SyncNoticeProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </SyncNoticeProvider>
        </MonthProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
