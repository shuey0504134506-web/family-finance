import { useState } from 'react';
import { Field } from '../../components/Field';
import { formatBpsAsPercent, parsePercentToBps } from '../../domain/settingsInput';
import type { BusinessTransferMode } from '../../domain/types';
import { saveSettings } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { useSettings } from './SettingsContext';

/**
 * הגדרות חישוב: אחוז מעשר, ספירת מעשר שניתן מהעסק, והעברת נטו העסק למשק הבית.
 * אין כפתור שמירה: האחוז נשמר ביציאה מהשדה, והבחירות נשמרות מיד.
 */
export function FormulasSection() {
  const { user } = useReadyAuth();
  const settings = useSettings();
  const { reportFailure } = useSyncNotice();
  const [percent, setPercent] = useState(formatBpsAsPercent(settings.titheBps));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const persist = (patch: Partial<{ titheBps: number; countBusinessTithePayments: boolean; businessTransferMode: BusinessTransferMode }>) => {
    saveSettings(user.uid, {
      titheBps: settings.titheBps,
      countBusinessTithePayments: settings.countBusinessTithePayments,
      businessTransferMode: settings.businessTransferMode,
      ...patch,
    }).catch(() => reportFailure('לא הצלחנו לסנכרן את ההגדרות. יש לנסות שוב.'));
    setSaved(true);
  };

  const onPercentBlur = () => {
    setSaved(false);
    const bps = parsePercentToBps(percent);
    if (bps === null) return setError('אחוז המעשר חייב להיות בין 0 ל-100, עם עד שתי ספרות אחרי הנקודה. השינוי לא נשמר.');
    setError('');
    if (bps !== settings.titheBps) persist({ titheBps: bps });
  };

  return (
    <form className="settings-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <Field
        label="אחוז מעשר (%)"
        inputMode="decimal"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        onBlur={onPercentBlur}
        error={error || undefined}
      />

      <label className="check-row">
        <input
          type="checkbox"
          checked={settings.countBusinessTithePayments}
          onChange={(e) => persist({ countBusinessTithePayments: e.target.checked })}
        />
        <span>הוצאה בעסק שסימנתי "תשלום מעשר" נחשבת כמעשר ששולם</span>
      </label>

      <div className="field">
        <label htmlFor="transfer-mode">חודש הפסדי בעסק</label>
        <select
          id="transfer-mode"
          className="input"
          value={settings.businessTransferMode}
          onChange={(e) => persist({ businessTransferMode: e.target.value as BusinessTransferMode })}
        >
          <option value="allow-negative">ההפסד עובר למשק הבית ומקטין את ההכנסות שלו</option>
          <option value="positive-only">רק רווח עובר למשק הבית (הפסד לא עובר)</option>
        </select>
        <div className="field-hint">משפיע על מסך הבית, הסיכומים והמעשרות.</div>
      </div>

      {saved && !error && (
        <div className="form-success" role="status">
          נשמר אוטומטית.
        </div>
      )}
    </form>
  );
}
