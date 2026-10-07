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
  children,
  onClick,
}: {
  icon: IconName;
  title: string;
  tone?: 'bad' | 'good';
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="quick-link" onClick={onClick}>
      <span className="quick-link-title">
        <Icon name={icon} /> {title}
      </span>
      <span className={`quick-link-sub${tone ? ` tone-${tone}` : ''}`}>{children}</span>
    </button>
  );
}
