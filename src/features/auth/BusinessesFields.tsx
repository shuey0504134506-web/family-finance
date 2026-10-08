import { Field } from '../../components/Field';
import { MAX_SPACE_NAME } from '../../domain/spaces';

/**
 * שדות להרשמה: שם משק הבית (לא חובה) ועסקים נוספים (לא חובה).
 * העסק הראשון והשדות האישיים נמצאים בטופס עצמו.
 */
export function BusinessesFields({
  householdName,
  onHouseholdName,
  extras,
  onExtras,
}: {
  householdName: string;
  onHouseholdName: (value: string) => void;
  extras: string[];
  onExtras: (value: string[]) => void;
}) {
  const setAt = (index: number, value: string) => onExtras(extras.map((x, i) => (i === index ? value : x)));
  return (
    <>
      {extras.map((name, index) => (
        <div key={index} className="inline-add">
          <Field
            label={`עסק נוסף ${index + 1}`}
            value={name}
            maxLength={MAX_SPACE_NAME}
            onChange={(e) => setAt(index, e.target.value)}
            autoComplete="off"
          />
          <button type="button" className="btn btn-secondary" onClick={() => onExtras(extras.filter((_, i) => i !== index))}>
            הסרת השדה
          </button>
        </div>
      ))}
      {extras.length < 8 && (
        <button type="button" className="btn btn-secondary" onClick={() => onExtras([...extras, ''])}>
          הוספת עסק נוסף
        </button>
      )}
      <Field
        label="שם משק הבית (לא חובה)"
        value={householdName}
        maxLength={MAX_SPACE_NAME}
        onChange={(e) => onHouseholdName(e.target.value)}
        autoComplete="off"
        hint='למשל "משפחת כהן" או "הבית שלי". אפשר לשנות בהגדרות.'
      />
    </>
  );
}
