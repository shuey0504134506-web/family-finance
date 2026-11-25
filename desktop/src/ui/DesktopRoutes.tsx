import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { FullScreenMessage } from '../../../src/components/FullScreenMessage';
import { isAdminEmail } from '../../../src/config/admin';
import { AdminMessageHost } from '../../../src/features/admin/AdminMessageHost';
import { AdminScreen } from '../../../src/features/admin/AdminScreen';
import { AiReviewScreen } from '../../../src/features/ai/AiReviewScreen';
import { AiHistoryScreen } from '../../../src/features/ai/AiHistoryScreen';
import { useReadyAuth } from '../../../src/features/auth/AuthContext';
import { useAiAccess } from '../../../src/services/aiService';
import { useUi } from './useController';
import { ApprovalGate } from '../../../src/features/auth/ApprovalGate';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { CompleteSetupScreen } from '../../../src/features/auth/CompleteSetupScreen';
import { BudgetScreen } from '../../../src/features/budget/BudgetScreen';
import { DebtsScreen } from '../../../src/features/debts/DebtsScreen';
import { DesktopHelp } from './desktopHelp';
import { HelpScreen } from '../../../src/features/help/HelpScreen';
import { HomeScreen } from '../../../src/features/home/HomeScreen';
import { ImportScreen } from '../../../src/features/import/ImportScreen';
import { ListsProvider } from '../../../src/features/lists/ListsContext';
import { StandingOrdersScreen } from '../../../src/features/standing/StandingOrdersScreen';
import { StandingOrdersHost } from '../../../src/features/standing/StandingOrdersHost';
import { RemindersHost } from '../../../src/features/lists/RemindersHost';
import { ShoppingScreen } from '../../../src/features/lists/ShoppingScreen';
import { TasksScreen } from '../../../src/features/lists/TasksScreen';
import { LockProvider } from '../../../src/features/lock/LockContext';
import { LockGate } from '../../../src/features/lock/LockScreen';
import { AccessibilityScreen } from '../../../src/features/privacy/AccessibilityScreen';
import { DesktopPrivacy } from './DesktopPrivacy';
import { SearchScreen } from '../../../src/features/search/SearchScreen';
import { AutoBackupHost } from '../../../src/features/settings/AutoBackupHost';
import { SettingsProvider } from '../../../src/features/settings/SettingsContext';
import { QuickAddRedirect } from '../../../src/features/spaces/QuickAddRedirect';
import { SettingsScreen } from '../../../src/features/settings/SettingsScreen';
import { SpaceRoute } from '../../../src/features/spaces/SpaceRoute';
import { SpacesProvider, useSpaces } from '../../../src/features/spaces/SpacesContext';
import { SummaryScreen } from '../../../src/features/summary/SummaryScreen';
import { TitheScreen } from '../../../src/features/tithes/TitheScreen';
import { TransactionFormScreen } from '../../../src/features/transactions/TransactionFormScreen';
import { TransactionListScreen } from '../../../src/features/transactions/TransactionListScreen';
import { DesktopShell } from './DesktopShell';
import { RecoverySettings } from './RecoverySettings';
import { PhoneMenu } from './PhoneMenu';

const Loading = () => <FullScreenMessage title="טוען…" />;

/** כמו RequireAccount באפליקציה, אבל ה-Outlet עטוף במעטפת עם תפריט צד קבוע. */
function RequireAccount({ phone }: { phone: boolean }) {
  const { state, signOutUser } = useAuth();
  switch (state.status) {
    case 'loading':
    case 'signedOut':
      return <Loading />;
    case 'checking': {
      const waiting = (
        <FullScreenMessage title="ממתין לחיבור">
          <p className="muted">לא הצלחנו לאמת את החשבון מול השרת. יש לבדוק את החיבור לאינטרנט. התוכנה תמשיך אוטומטית כשהחיבור יחזור.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void signOutUser()}>יציאה</button>
        </FullScreenMessage>
      );
      return <ApprovalGate uid={state.user.uid} whileLoading={waiting}>{waiting}</ApprovalGate>;
    }
    case 'needsSetup':
      return <CompleteSetupScreen />;
    case 'ready':
      return (
        <ApprovalGate uid={state.user.uid} whileLoading={<Loading />}>
          <SettingsProvider uid={state.user.uid}>
            <LockProvider user={state.user}>
              <SpacesProvider uid={state.user.uid} profile={state.profile}>
                <ListsProvider uid={state.user.uid}>
                  <LockGate>
                    <RemindersHost />
                    <StandingOrdersHost />
                    {isAdminEmail(state.user.email) ? <AdminMessageHost /> : null}
                    <AutoBackupHost />
                    {phone ? (
                      <Outlet />
                    ) : (
                      <DesktopShell>
                        <Outlet />
                      </DesktopShell>
                    )}
                  </LockGate>
                </ListsProvider>
              </SpacesProvider>
            </LockProvider>
          </SettingsProvider>
        </ApprovalGate>
      );
  }
}

function HomeRedirect() {
  const { ready, defaultSpace } = useSpaces();
  if (!ready) return <Loading />;
  return <Navigate to={`/${defaultSpace.key}`} replace />;
}

/** התפריט תמיד פתוח בצד, ולכן מסך התפריט של הטלפון מפנה לבית. */
function MenuToHome() {
  const { scope } = useParams();
  return <Navigate to={`/${scope ?? ''}`} replace />;
}

function ConnectedAi({ history = false }: { history?: boolean }) {
  const { user } = useReadyAuth();
  const ui = useUi();
  const allowed = useAiAccess(user.uid, ui.me?.kind !== 'online');
  const { scope } = useParams();
  if (!allowed || ui.me?.kind !== 'online' || !ui.online) return <Navigate to={`/${scope ?? ''}`} replace />;
  return history ? <AiHistoryScreen /> : <AiReviewScreen />;
}

export function DesktopRoutes({ phone = false }: { phone?: boolean } = {}) {
  return (
    <Routes>
      <Route path="/privacy" element={<DesktopPrivacy />} />
      <Route path="/accessibility" element={<AccessibilityScreen />} />
      <Route element={<RequireAccount phone={phone} />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/quick/:type" element={<QuickAddRedirect />} />
        <Route element={<SpaceRoute />}>
          <Route path="/:scope" element={<HomeScreen />} />
          <Route path="/:scope/list/:type" element={<TransactionListScreen />} />
          <Route path="/:scope/add/:type" element={<TransactionFormScreen mode="add" />} />
          <Route path="/:scope/edit/:id" element={<TransactionFormScreen mode="edit" />} />
          <Route path="/:scope/budget" element={<BudgetScreen />} />
          <Route path="/:scope/menu" element={phone ? <PhoneMenu /> : <MenuToHome />} />
          <Route path="/:scope/import" element={<ImportScreen />} />
          <Route path="/:scope/debts" element={<DebtsScreen />} />
          <Route path="/:scope/standing" element={<StandingOrdersScreen />} />
          <Route path="/:scope/tasks" element={<TasksScreen />} />
          <Route path="/:scope/shopping" element={<ShoppingScreen />} />
          {!phone && <Route path="/:scope/ai" element={<ConnectedAi />} />}
          {!phone && <Route path="/:scope/ai/history" element={<ConnectedAi history />} />}
        </Route>
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/summary" element={<SummaryScreen />} />
        <Route path="/tithes" element={<TitheScreen />} />
        <Route path="/help" element={phone ? <HelpScreen /> : <DesktopHelp />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/recovery" element={<RecoverySettings />} />
        {!phone && <Route path="/admin" element={<ConnectedAdmin />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ConnectedAdmin() {
  const ui = useUi();
  return ui.me?.kind === 'online' ? <AdminScreen /> : <Navigate to="/" replace />;
}
