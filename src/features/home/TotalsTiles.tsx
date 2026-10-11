import { Amount } from '../../components/Amount';
import { Icon } from '../../components/Icon';

interface Props {
  incomeAgorot: number;
  expenseAgorot: number;
  loading: boolean;
  /** כשמוגדר, המשבצת היא כפתור שפותח את רשימת ההכנסות / ההוצאות של החודש */
  onOpenIncome?: () => void;
  onOpenExpense?: () => void;
}

interface TileProps {
  className: string;
  label: string;
  icon: 'income' | 'expense';
  agorot: number;
  loading: boolean;
  /** אורך הפס הדק בשורה, 0 עד 1 */
  ratio: number;
  onOpen?: () => void;
}

function Tile({ className, label, icon, agorot, loading, ratio, onOpen }: TileProps) {
  const content = (
    <>
      <div className="tile-title">
        <Icon name={icon} /> {label}
      </div>
      <div className="tile-amount">
        {loading ? <span className="skeleton">—</span> : <Amount agorot={agorot} />}
      </div>
      <div className="row-bar" aria-hidden="true">
        <i style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` }} />
      </div>
      {onOpen && <div className="tile-hint">לרשימה</div>}
    </>
  );
  return onOpen ? (
    <button type="button" className={`tile ${className} tile-button`} onClick={onOpen}>
      {content}
    </button>
  ) : (
    <section className={`tile ${className}`} aria-label={label}>
      {content}
    </section>
  );
}

/** שתי המשבצות הגדולות: סך הכנסות וסך הוצאות של החודש. לחיצה פותחת את הרשימה. */
export function TotalsTiles({ incomeAgorot, expenseAgorot, loading, onOpenIncome, onOpenExpense }: Props) {
  // הפס של ההכנסות תמיד מלא, והפס של ההוצאות מראה איזה חלק מההכנסות הן אכלו.
  const expenseRatio = incomeAgorot > 0 ? expenseAgorot / incomeAgorot : expenseAgorot > 0 ? 1 : 0;
  return (
    <div className="tiles">
      <Tile
        className="tile-income"
        label="סך הכנסות"
        icon="income"
        agorot={incomeAgorot}
        ratio={incomeAgorot > 0 ? 1 : 0}
        loading={loading}
        onOpen={onOpenIncome}
      />
      <Tile
        className="tile-expense"
        label="סך הוצאות"
        icon="expense"
        agorot={expenseAgorot}
        ratio={expenseRatio}
        loading={loading}
        onOpen={onOpenExpense}
      />
    </div>
  );
}
