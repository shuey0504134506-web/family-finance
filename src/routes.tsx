import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { FullScreenMessage } from './components/FullScreenMessage';
import { useAuth } from './features/auth/AuthContext';
import { CompleteSetupScreen } from './features/auth/CompleteSetupScreen';
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { SignupScreen } from './features/auth/SignupScreen';
import { WelcomeScreen } from './features/auth/WelcomeScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { SwipeHistory } from './features/navigation/SwipeHistory';
import { MenuScreen } from './features/menu/MenuScreen';
import { ListsProvider } from './features/lists/ListsContext';
import { RemindersHost } from './features/lists/RemindersHost';
import { ShoppingScreen } from './features/lists/ShoppingScreen';
import { TasksScreen } from './features/lists/TasksScreen';
import { LockProvider } from './features/lock/LockContext';
import { LockGate } from './features/lock/LockScreen';
import { PrivacyScreen } from './features/privacy/PrivacyScreen';
import { AutoBackupHost } from './features/settings/AutoBackupHost';
import { SettingsProvider } from './features/settings/SettingsContext';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { BudgetScreen } from './features/budget/BudgetScreen';
import { CategoriesScreen } from './features/categories/CategoriesScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { SummaryScreen } from './features/summary/SummaryScreen';
import { TitheScreen } from './features/tithes/TitheScreen';
import { TransactionListScreen } from './features/transactions/TransactionListScreen';
import { TransactionFormScreen } from './features/transactions/TransactionFormScreen';
import { SpaceRoute } from './features/spaces/SpaceRoute';
import { SpacesProvider, useSpaces } from './features/spaces/SpacesContext';
import { readDeviceUser } from './services/deviceUser';

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
      return <Navigate to={readDeviceUser() ? '/login' : '/welcome'} replace />;
    case 'checking':
      return (
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
    case 'needsSetup':
      return <CompleteSetupScreen />;
    case 'ready':
      return (
        <SettingsProvider uid={state.user.uid}>
          <LockProvider user={state.user}>
            <SpacesProvider uid={state.user.uid} profile={state.profile}>
              <ListsProvider uid={state.user.uid}>
                <LockGate>
                  <RemindersHost />
                  <AutoBackupHost />
                  <Outlet />
                </LockGate>
              </ListsProvider>
            </SpacesProvider>
          </LockProvider>
        </SettingsProvider>
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
    <SwipeHistory />
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      </Route>

      {/* מדיניות הפרטיות פתוחה גם למי שלא מחובר */}
      <Route path="/privacy" element={<PrivacyScreen />} />

      <Route element={<RequireAccount />}>
        <Route index element={<HomeRedirect />} />
        <Route element={<SpaceRoute />}>
          <Route path="/:scope" element={<HomeScreen />} />
          <Route path="/:scope/list/:type" element={<TransactionListScreen />} />
          <Route path="/:scope/add/:type" element={<TransactionFormScreen mode="add" />} />
          <Route path="/:scope/edit/:id" element={<TransactionFormScreen mode="edit" />} />
          <Route path="/:scope/budget" element={<BudgetScreen />} />
          <Route path="/:scope/menu" element={<MenuScreen />} />
          <Route path="/:scope/tasks" element={<TasksScreen />} />
          <Route path="/:scope/shopping" element={<ShoppingScreen />} />
        </Route>
        <Route path="/categories" element={<CategoriesScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/summary" element={<SummaryScreen />} />
        <Route path="/tithes" element={<TitheScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
