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
  onOpen?: () => void;
}

function Tile({ className, label, icon, agorot, loading, onOpen }: TileProps) {
  const content = (
    <>
      <div className="tile-title">
        <Icon name={icon} /> {label}
      </div>
      <div className="tile-amount">
        {loading ? <span className="skeleton">—</span> : <Amount agorot={agorot} />}
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
  return (
    <div className="tiles">
      <Tile
        className="tile-income"
        label="סך הכנסות"
        icon="income"
        agorot={incomeAgorot}
        loading={loading}
        onOpen={onOpenIncome}
      />
      <Tile
        className="tile-expense"
        label="סך הוצאות"
        icon="expense"
        agorot={expenseAgorot}
        loading={loading}
        onOpen={onOpenExpense}
      />
    </div>
  );
}
