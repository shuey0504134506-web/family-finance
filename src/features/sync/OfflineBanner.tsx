import { useEffect, useState } from 'react';

/** מציג בראש המסך שאין חיבור לאינטרנט, ושהפעולות נשמרות במכשיר ויסונכרנו אחר כך. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      אין חיבור לאינטרנט. אפשר להמשיך לעבוד: פעולות נשמרות במכשיר ויסונכרנו כשהחיבור יחזור.
    </div>
  );
}
