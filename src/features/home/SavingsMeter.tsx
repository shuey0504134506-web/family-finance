import { Amount } from '../../components/Amount';
import { savingsProgress } from '../../domain/budget';

/** שורה אחת: כמה קרובים (או רחוקים, או מעבר) ליעד החיסכון החודשי. לחיצה פותחת את הגדרת היעד. */
export function SavingsMeter({
  goalAgorot,
  savedAgorot,
  onOpen,
}: {
  goalAgorot: number;
  savedAgorot: number;
  onOpen: () => void;
}) {
  const p = savingsProgress(goalAgorot, savedAgorot);
  const text =
    p.status === 'exceeded' ? (
      <>
        עברנו את יעד החיסכון ב-<Amount agorot={p.exceededAgorot} />
      </>
    ) : p.status === 'reached' ? (
      <>הגענו ליעד החיסכון החודשי</>
    ) : (
      <>
        עוד <Amount agorot={p.missingAgorot} /> ליעד החיסכון
      </>
    );
  return (
    <button
      type="button"
      className={`savings-meter savings-${p.status}`}
      onClick={onOpen}
      aria-label={`יעד חיסכון חודשי, ${p.percent}% מהיעד`}
    >
      <span className="savings-text">{text}</span>
      <span className="savings-bar" aria-hidden="true">
        <span style={{ width: `${p.percent}%` }} />
      </span>
      <span className="savings-percent">{p.percent}%</span>
    </button>
  );
}
