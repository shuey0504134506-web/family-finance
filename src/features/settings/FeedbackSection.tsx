import { useState } from 'react';
import { getFeedbackPrefs, setFeedbackPrefs, type FeedbackPrefs } from '../../services/feedback';

/** צליל ורטט בזמן ספירת הסכומים. נשמר במכשיר הזה בלבד. */
export function FeedbackSection() {
  const [prefs, setPrefs] = useState<FeedbackPrefs>(getFeedbackPrefs);
  const update = (next: FeedbackPrefs) => {
    setPrefs(next);
    setFeedbackPrefs(next);
  };
  return (
    <div className="stack">
      <label className="check-row">
        <input type="checkbox" checked={prefs.sound} onChange={(e) => update({ ...prefs, sound: e.target.checked })} />
        <span>צליל בספירת הסכומים</span>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={prefs.haptics} onChange={(e) => update({ ...prefs, haptics: e.target.checked })} />
        <span>רטט בספירת הסכומים</span>
      </label>
      <p className="muted small">
        נשמר במכשיר הזה בלבד. בדפדפן הצליל מתחיל אחרי המגע הראשון במסך. כשמוגדרת במכשיר הפחתת תנועה, אין הנפשה ולכן גם לא צליל או רטט.
      </p>
    </div>
  );
}
