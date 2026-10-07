import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { FullScreenMessage } from './components/FullScreenMessage';
import { scopesForMode, type AccountMode, type Scope } from './domain/types';
import { useAuth } from './features/auth/AuthContext';
import { CompleteSetupScreen } from './features/auth/CompleteSetupScreen';
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { SignupScreen } from './features/auth/SignupScreen';
import { WelcomeScreen } from './features/auth/WelcomeScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { PrivacyScreen } from './features/privacy/PrivacyScreen';
import { SettingsProvider } from './features/settings/SettingsContext';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { BudgetScreen } from './features/budget/BudgetScreen';
import { CategoriesScreen } from './features/categories/CategoriesScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { SummaryScreen } from './features/summary/SummaryScreen';
import { TitheScreen } from './features/tithes/TitheScreen';
import { TransactionFormScreen } from './features/transactions/TransactionFormScreen';
import { readDeviceUser } from './services/deviceUser';

function LoadingScreen() {
  return <FullScreenMessage title="טוען…" />;
}

/** בכניסה ברירת המחדל היא העסק, ואם החשבון הוא "משק בית בלבד" אז משק הבית. */
function defaultScope(mode: AccountMode): Scope {
  return scopesForMode(mode)[0];
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
          <Outlet />
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

function HomeRedirect() {
  const { state } = useAuth();
  if (state.status !== 'ready') return null;
  return <Navigate to={`/${defaultScope(state.profile.accountMode)}`} replace />;
}

/** נתיב עסק/משק בית. אם התחום אינו חלק מייעוד החשבון, חוזרים לברירת המחדל. */
function ScopeRoute({ scope }: { scope: Scope }) {
  const { state } = useAuth();
  if (state.status !== 'ready') return null;
  if (!scopesForMode(state.profile.accountMode).includes(scope)) {
    return <Navigate to={`/${defaultScope(state.profile.accountMode)}`} replace />;
  }
  return <HomeScreen scope={scope} />;
}

export function AppRoutes() {
  return (
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
        <Route path="/business" element={<ScopeRoute scope="business" />} />
        <Route path="/household" element={<ScopeRoute scope="household" />} />
        <Route path="/:scope/add/:type" element={<TransactionFormScreen mode="add" />} />
        <Route path="/:scope/edit/:id" element={<TransactionFormScreen mode="edit" />} />
        <Route path="/:scope/budget" element={<BudgetScreen />} />
        <Route path="/categories" element={<CategoriesScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/summary" element={<SummaryScreen />} />
        <Route path="/tithes" element={<TitheScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
