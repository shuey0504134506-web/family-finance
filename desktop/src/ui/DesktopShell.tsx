import { type ReactNode } from 'react';
import { WideShell } from '../../../src/features/shell/WideShell';
import { SyncChip } from './SyncChip';
import { useController, useUi } from './useController';

/** מעטפת התוכנה למחשב: המעטפת הרחבה המשותפת, עם סטטוס סנכרון ושחזור סיסמה. */
export function DesktopShell({ children }: { children: ReactNode }) {
  const ui = useUi();
  const c = useController();
  return (
    <WideShell
      userLabel={ui.me?.displayName || ui.me?.email || ''}
      logoutLabel="נעילה / החלפת חשבון"
      onLogout={() => void c.logout()}
      showRecovery
      syncSlot={<SyncChip />}
    >
      {children}
    </WideShell>
  );
}
