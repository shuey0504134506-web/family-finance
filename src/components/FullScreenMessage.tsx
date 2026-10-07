import type { ReactNode } from 'react';

export function FullScreenMessage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <main className="center-screen">
      <div className="center-card">
        <h1 className="center-title">{title}</h1>
        {children}
      </div>
    </main>
  );
}
