import type { ReactNode } from 'react';
import { AuthShell } from './AuthShell';

export function FullScreenMessage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <AuthShell>
      <div className="center-card">
        <h1 className="center-title">{title}</h1>
        {children}
      </div>
    </AuthShell>
  );
}
