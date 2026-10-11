import { useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { MAX_ATTACHMENTS } from '../../domain/attachment';
import { fileToAttachment } from '../../services/attachmentImage';

/** צירוף תמונות (קבלה, תלוש) לפעולה: הוספה מהמצלמה או מהגלריה, תצוגה מוגדלת והסרה. */
export function AttachmentsField({
  images,
  onChange,
  loading,
  failed,
  isIncome,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  loading: boolean;
  failed: boolean;
  /** הכנסה: "תלוש או אסמכתה". הוצאה: "קבלה או חשבונית". */
  isIncome: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  const full = images.length >= MAX_ATTACHMENTS;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_ATTACHMENTS) break;
      try {
        next.push(await fileToAttachment(file));
      } catch {
        setError('לא הצלחנו להשתמש באחד הקבצים. יש לבחור תמונה (JPG, PNG או WebP).');
      }
    }
    onChange(next);
  };

  return (
    <div className="field attachments">
      <span className="field-label">{isIncome ? 'תלוש או אסמכתה (תמונה, לא חובה)' : 'קבלה או חשבונית (תמונה, לא חובה)'}</span>
      {loading ? (
        <div className="muted small" role="status">
          טוען תמונות…
        </div>
      ) : failed ? (
        <div className="field-error" role="alert">
          לא הצלחנו לטעון את התמונות השמורות. יש לבדוק את החיבור. השינויים בתמונות לא יישמרו עכשיו.
        </div>
      ) : (
        <>
          {images.length > 0 && (
            <ul className="att-grid">
              {images.map((src, i) => (
                <li key={i}>
                  <button type="button" className="att-thumb" onClick={() => setViewing(i)} aria-label={`הצגת תמונה ${i + 1}`}>
                    <img src={src} alt="" />
                  </button>
                  <button
                    type="button"
                    className="att-remove"
                    aria-label={`הסרת תמונה ${i + 1}`}
                    onClick={() => onChange(images.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {full ? (
            <div className="muted small">הגעת למקסימום ({MAX_ATTACHMENTS} תמונות)</div>
          ) : (
            <div className="att-actions">
              <button type="button" className="btn btn-secondary" onClick={() => camera.current?.click()}>
                צילום עכשיו
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>
                בחירה מהמכשיר
              </button>
            </div>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      )}
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
      {viewing !== null && images[viewing] && (
        <Modal title="תמונה מצורפת" onClose={() => setViewing(null)}>
          <img className="att-full" src={images[viewing]} alt="" />
          <button type="button" className="btn btn-secondary" onClick={() => setViewing(null)}>
            סגירה
          </button>
        </Modal>
      )}
    </div>
  );
}
