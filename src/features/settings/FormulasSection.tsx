import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import { formatBpsAsPercent, parsePercentToBps } from '../../domain/settingsInput';
import type { BusinessTransferMode } from '../../domain/types';
import { saveSettings } from '../../services/accountService';
import { useReadyAuth } from '../auth/AuthContext';
import { useSyncNotice } from '../sync/SyncNotice';
import { useSettings } from './SettingsContext';

/** הגדרות חישוב: אחוז מעשר, ספירת מעשר שניתן מהעסק, והעברת נטו העסק למשק הבית. */
export function FormulasSection() {
  const { user } = useReadyAuth();
  const settings = useSettings();
  const { reportFailure } = useSyncNotice();
  const [percent, setPercent] = useState(formatBpsAsPercent(settings.titheBps));
  const [countBusiness, setCountBusiness] = useState(settings.countBusinessTithePayments);
  const [mode, setMode] = useState<BusinessTransferMode>(settings.businessTransferMode);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const bps = parsePercentToBps(percent);
    if (bps === null) return setError('אחוז המעשר חייב להיות בין 0 ל-100, עם עד שתי ספרות אחרי הנקודה.');
    setError('');
    saveSettings(user.uid, {
      titheBps: bps,
      countBusinessTithePayments: countBusiness,
      businessTransferMode: mode,
    }).catch(() => reportFailure('לא הצלחנו לסנכרן את ההגדרות. יש לנסות שוב.'));
    setSaved(true);
  };

  return (
    <section className="card" aria-labelledby="formulas-title">
      <h2 id="formulas-title" className="card-title">
        מעשרות וחישובים
      </h2>
      <form className="settings-form" onSubmit={onSubmit} noValidate>
        <Field
          label="אחוז מעשר (%)"
          inputMode="decimal"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          error={error || undefined}
        />

        <label className="check-row">
          <input type="checkbox" checked={countBusiness} onChange={(e) => setCountBusiness(e.target.checked)} />
          <span>הוצאה בעסק שסימנתי "תשלום מעשר" נחשבת כמעשר ששולם</span>
        </label>

        <div className="field">
          <label htmlFor="transfer-mode">חודש הפסדי בעסק</label>
          <select
            id="transfer-mode"
            className="input"
            value={mode}
            onChange={(e) => setMode(e.target.value as BusinessTransferMode)}
          >
            <option value="allow-negative">ההפסד עובר למשק הבית ומקטין את ההכנסות שלו</option>
            <option value="positive-only">רק רווח עובר למשק הבית (הפסד לא עובר)</option>
          </select>
          <div className="field-hint">משפיע על מסך הבית, הסיכומים והמעשרות.</div>
        </div>

        {saved && !error && (
          <div className="form-success" role="status">
            נשמר.
          </div>
        )}
        <button type="submit" className="btn btn-primary">
          שמירה
        </button>
      </form>
    </section>
  );
}
