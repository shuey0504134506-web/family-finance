/** כפתור קטגוריה בטופס: הבחירה, ולצידה ✕ שפותח את חלון שינוי השם והמחיקה. */
export function CategoryChip({
  label,
  selected,
  onSelect,
  onManage,
  manageLabel = 'ניהול הקטגוריה',
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  onManage?: () => void;
  manageLabel?: string;
}) {
  return (
    <span className={`chip-option chip-with-x${selected ? ' is-active' : ''}`}>
      <button type="button" role="radio" aria-checked={selected} className="chip-main" onClick={onSelect}>
        {label}
      </button>
      {onManage && (
        <button type="button" className="chip-x" aria-label={manageLabel} onClick={onManage}>
          ✕
        </button>
      )}
    </span>
  );
}
