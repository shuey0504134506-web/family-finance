import type { ReactNode } from 'react';

export function PrivacyConsent({ checked, onChange, policy }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  policy: ReactNode;
}) {
  return (
    <div>
      <p>
        ״ניהול כספים״ עושה את מירב המאמצים להגן על המידע שלכם. השימוש בשירות מותנה
        בקריאה ובאישור של מדיניות הפרטיות.
      </p>
      <details>
        <summary>קריאת מדיניות הפרטיות</summary>
        {policy}
      </details>
      <label>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} required />
        <span> קראתי ואני מאשר/ת את מדיניות הפרטיות</span>
      </label>
    </div>
  );
}
