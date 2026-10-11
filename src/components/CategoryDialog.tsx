import { useState } from 'react';
import { Modal } from './Modal';

type Step = 'menu' | 'rename' | 'delete';

/**
 * חלון ניהול של קטגוריה אחת: שינוי שם ומחיקה.
 * בחובות אין שינוי שם, רק הסרה מהרשימה (onRename לא מועבר).
 */
export function CategoryDialog({
  name,
  onClose,
  onRename,
  onDelete,
  deleteLabel = 'מחיקה',
  confirmLabel = 'כן, למחוק',
  deleteText,
  nameError,
}: {
  name: string;
  onClose: () => void;
  onRename?: (name: string) => void;
  onDelete: () => void;
  deleteLabel?: string;
  confirmLabel?: string;
  deleteText: string;
  /** מחזיר הודעת שגיאה לשם חדש, או null כשהוא תקין */
  nameError?: (name: string) => string | null;
}) {
  const [step, setStep] = useState<Step>('menu');
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');

  const saveName = () => {
    const err = nameError?.(draft) ?? null;
    if (err) return setError(err);
    onRename?.(draft.trim());
    onClose();
  };

  return (
    <Modal title="ניהול קטגוריה" onClose={onClose}>
      <p className="category-dialog-name">{name}</p>
      {step === 'menu' && (
        <div className="dialog-actions">
          {onRename && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep('rename')}>
              שינוי שם
            </button>
          )}
          <button type="button" className="btn btn-danger-outline" onClick={() => setStep('delete')}>
            {deleteLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      )}
      {step === 'rename' && (
        <div className="dialog-actions">
          <input
            className={`input${error ? ' input-error' : ''}`}
            aria-label="שם הקטגוריה"
            value={draft}
            autoFocus
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveName();
              }
            }}
          />
          {error && <div className="field-error">{error}</div>}
          <button type="button" className="btn btn-primary" onClick={saveName}>
            שמירה
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('menu')}>
            ביטול
          </button>
        </div>
      )}
      {step === 'delete' && (
        <div className="dialog-actions" role="alert">
          <p className="category-delete-text">{deleteText}</p>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('menu')}>
            ביטול
          </button>
        </div>
      )}
    </Modal>
  );
}
