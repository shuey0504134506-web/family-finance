import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { FullScreenMessage } from './components/FullScreenMessage';
import { useAuth } from './features/auth/AuthContext';
import { AdminMessageHost } from './features/admin/AdminMessageHost';
import { isAdminEmail } from './config/admin';
import { ApprovalGate } from './features/auth/ApprovalGate';
import { CompleteSetupScreen } from './features/auth/CompleteSetupScreen';
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { SignupScreen } from './features/auth/SignupScreen';
import { WelcomeScreen } from './features/auth/WelcomeScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { MenuScreen } from './features/menu/MenuScreen';
import { ListsProvider } from './features/lists/ListsContext';
import { WideShell } from './features/shell/WideShell';
import { useIsWide } from './hooks/useIsWide';
import { StandingOrdersHost } from './features/standing/StandingOrdersHost';
import { RemindersHost } from './features/lists/RemindersHost';
import { ShoppingScreen } from './features/lists/ShoppingScreen';
import { TasksScreen } from './features/lists/TasksScreen';
import { LockProvider } from './features/lock/LockContext';
import { LockGate } from './features/lock/LockScreen';
import { AutoBackupHost } from './features/settings/AutoBackupHost';
import { SettingsProvider } from './features/settings/SettingsContext';
import { TransactionListScreen } from './features/transactions/TransactionListScreen';
import { TransactionFormScreen } from './features/transactions/TransactionFormScreen';
import { SpaceRoute } from './features/spaces/SpaceRoute';
import { QuickAddRedirect } from './features/spaces/QuickAddRedirect';
import { SpacesProvider, useSpaces } from './features/spaces/SpacesContext';
import { readDeviceUser } from './services/deviceUser';
import { isInstalledApp } from './native/installPrompt';
import { Capacitor } from '@capacitor/core';

/**
 * מסכים שאינם חלק מהכניסה הראשונה נטענים לפי הצורך, כדי שהחבילה הראשית תהיה קטנה וההפעלה מהירה.
 * אם הקובץ של המסך כבר לא קיים בשרת (פורסמה גרסה חדשה בזמן שהאפליקציה פתוחה), טוענים את האפליקציה מחדש פעם אחת.
 */
const RELOAD_KEY = 'ff.chunkReload.v1';
function lazyScreen<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(async () => {
    try {
      const module = await load();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* אחסון חסום */
      }
      return { default: module[name] };
    } catch (error) {
      let already = true;
      try {
        already = sessionStorage.getItem(RELOAD_KEY) === '1';
        if (!already) sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        already = true;
      }
      if (!already) {
        window.location.reload();
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  });
}
const AdminScreen = lazyScreen(() => import('./features/admin/AdminScreen'), 'AdminScreen');
const AiHistoryScreen = lazyScreen(() => import('./features/ai/AiHistoryScreen'), 'AiHistoryScreen');
const AiReviewScreen = lazyScreen(() => import('./features/ai/AiReviewScreen'), 'AiReviewScreen');
const ImportScreen = lazyScreen(() => import('./features/import/ImportScreen'), 'ImportScreen');
const StandingOrdersScreen = lazyScreen(() => import('./features/standing/StandingOrdersScreen'), 'StandingOrdersScreen');
const PrivacyScreen = lazyScreen(() => import('./features/privacy/PrivacyScreen'), 'PrivacyScreen');
const AccessibilityScreen = lazyScreen(() => import('./features/privacy/AccessibilityScreen'), 'AccessibilityScreen');
const SettingsScreen = lazyScreen(() => import('./features/settings/SettingsScreen'), 'SettingsScreen');
const BudgetScreen = lazyScreen(() => import('./features/budget/BudgetScreen'), 'BudgetScreen');
const SearchScreen = lazyScreen(() => import('./features/search/SearchScreen'), 'SearchScreen');
const SummaryScreen = lazyScreen(() => import('./features/summary/SummaryScreen'), 'SummaryScreen');
const DebtsScreen = lazyScreen(() => import('./features/debts/DebtsScreen'), 'DebtsScreen');
const HelpScreen = lazyScreen(() => import('./features/help/HelpScreen'), 'HelpScreen');
const TitheScreen = lazyScreen(() => import('./features/tithes/TitheScreen'), 'TitheScreen');
const LandingScreen = lazyScreen(() => import('./features/landing/LandingScreen'), 'LandingScreen');

function LoadingScreen() {
  return <FullScreenMessage title="טוען…" />;
}

/** מסכים שדורשים משתמש מחובר עם חשבון שהושלם. */
function RequireAccount() {
  const { state, signOutUser } = useAuth();

  switch (state.status) {
    case 'loading':
      return <LoadingScreen />;
    case 'signedOut':
      // מכשיר שכבר השתמש בחשבון נכנס ישר למסך הכניסה, מכשיר חדש למסך הפתיחה.
      // באתר בדפדפן (לא מותקן) מכשיר חדש רואה קודם את דף ההסבר וההתקנה.
      if (readDeviceUser()) return <Navigate to="/login" replace />;
      return <Navigate to={isInstalledApp() || Capacitor.isNativePlatform() ? '/welcome' : '/start'} replace />;
    case 'checking': {
      const waiting = (
        <FullScreenMessage title="ממתין לחיבור">
              <p className="muted">
                לא הצלחנו לאמת את החשבון מול השרת. יש לבדוק את החיבור לאינטרנט. האפליקציה תמשיך
                אוטומטית כשהחיבור יחזור.
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => void signOutUser()}>
                יציאה
              </button>
            </FullScreenMessage>
      );
      // חשבון חסום לא יכול לקרוא את הפרופיל, ולכן גם כאן בודקים אישור
      return (
        <ApprovalGate uid={state.user.uid} whileLoading={waiting}>
          {waiting}
        </ApprovalGate>
      );
    }
    case 'needsSetup':
      return <CompleteSetupScreen />;
    case 'ready':
      return (
        <ApprovalGate uid={state.user.uid} whileLoading={<LoadingScreen />}>
        <SettingsProvider uid={state.user.uid}>
          <LockProvider user={state.user}>
            <SpacesProvider uid={state.user.uid} profile={state.profile}>
              <ListsProvider uid={state.user.uid}>
                <LockGate>
                  <RemindersHost />
                  <StandingOrdersHost />
                  {isAdminEmail(state.user.email) ? <AdminMessageHost /> : null}
                  <AutoBackupHost />
                  <WebShell />
                </LockGate>
              </ListsProvider>
            </SpacesProvider>
          </LockProvider>
        </SettingsProvider>
        </ApprovalGate>
      );
  }
}

/** מסכי כניסה והרשמה. משתמש שכבר מחובר מועבר למסך הבית. */
function PublicOnly() {
  const { state, justRegistered } = useAuth();
  if (state.status === 'loading') return <LoadingScreen />;
  const showWelcomeAfterSignup = state.status === 'ready' && justRegistered;
  if (state.status !== 'signedOut' && !showWelcomeAfterSignup) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** בכניסה פותחים את המרחב הראשון שמוצג במכשיר (עסק, ואחריו משק הבית). */
function HomeRedirect() {
  const { ready, defaultSpace } = useSpaces();
  if (!ready) return <LoadingScreen />;
  return <Navigate to={`/${defaultSpace.key}`} replace />;
}

export function AppRoutes() {
  return (
    <>
    <Suspense fallback={null}>
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/start" element={<LandingScreen />} />
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      </Route>

      {/* מדיניות הפרטיות פתוחה גם למי שלא מחובר */}
      <Route path="/privacy" element={<PrivacyScreen />} />
      <Route path="/accessibility" element={<AccessibilityScreen />} />

      <Route element={<RequireAccount />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/quick/:type" element={<QuickAddRedirect />} />
        <Route element={<SpaceRoute />}>
          <Route path="/:scope" element={<HomeScreen />} />
          <Route path="/:scope/list/:type" element={<TransactionListScreen />} />
          <Route path="/:scope/add/:type" element={<TransactionFormScreen mode="add" />} />
          <Route path="/:scope/edit/:id" element={<TransactionFormScreen mode="edit" />} />
          <Route path="/:scope/budget" element={<BudgetScreen />} />
          <Route path="/:scope/menu" element={<MenuScreen />} />
          <Route path="/:scope/import" element={<ImportScreen />} />
          <Route path="/:scope/debts" element={<DebtsScreen />} />
          <Route path="/:scope/standing" element={<StandingOrdersScreen />} />
          <Route path="/:scope/ai" element={<AiReviewScreen />} />
          <Route path="/:scope/ai/history" element={<AiHistoryScreen />} />
          <Route path="/:scope/tasks" element={<TasksScreen />} />
          <Route path="/:scope/shopping" element={<ShoppingScreen />} />
        </Route>
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/summary" element={<SummaryScreen />} />
        <Route path="/tithes" element={<TitheScreen />} />
        <Route path="/help" element={<HelpScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}

/** בטלפון: המסך עצמו. במחשב (מסך רחב): אותה מעטפת עם תפריט צד כמו בתוכנה. */
function WebShell() {
  const wide = useIsWide();
  const { signOutUser } = useAuth();
  const { state } = useAuth();
  if (!wide) return <Outlet />;
  const label = state.status === 'ready' ? `${state.profile.firstName} ${state.profile.lastName}`.trim() : '';
  return (
    <WideShell userLabel={label} logoutLabel="יציאה מהחשבון" onLogout={() => void signOutUser()}>
      <Outlet />
    </WideShell>
  );
}
