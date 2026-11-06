import type { ReactNode } from 'react';

/** ברכה לפי שעות היום, בלי אייקון. `action`: כפתור אופציונלי בקצה השורה (סקירת AI, רק למי שהמנהל אישר). */
export function HomeGreeting({ firstName, action }: { firstName: string; action?: ReactNode }) {
  const hour = new Date().getHours();
  const night = hour >= 20 || hour < 5;
  const name = firstName.trim();
  return (
    <div className={`home-greeting${action ? ' has-action' : ''}`}>
      <span className="greet-text">
        {hour >= 5 && hour < 12 && <span>בוקר טוב</span>}
        {hour >= 12 && hour < 17 && <span>צהריים טובים</span>}
        {hour >= 17 && hour < 20 && <span>ערב טוב</span>}
        {night && <span>לילה טוב</span>}
        {name ? `, ${name}` : ''}
      </span>
      {action}
    </div>
  );
}
