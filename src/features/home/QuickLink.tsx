import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';

/**
 * כפתור קישור מהיר במסך הבית (תקציב, מעשרות). כולם באותו עיצוב:
 * כותרת עם אייקון, ומתחתיה שורת מצב קצרה.
 */
export function QuickLink({
  icon,
  title,
  tone,
  progress,
  children,
  onClick,
}: {
  icon: IconName;
  title: string;
  tone?: 'bad' | 'good';
  /** אורך הפס הדק, 0 עד 1. בלי ערך אין פס. */
  progress?: number;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="quick-link" onClick={onClick}>
      <span className="quick-link-title">
        <Icon name={icon} /> {title}
      </span>
      <span className={`quick-link-sub${tone ? ` tone-${tone}` : ''}`}>{children}</span>
      {progress !== undefined && (
        <span className={`row-bar${tone ? ` row-bar-${tone}` : ''}`} aria-hidden="true">
          <i style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
        </span>
      )}
    </button>
  );
}
