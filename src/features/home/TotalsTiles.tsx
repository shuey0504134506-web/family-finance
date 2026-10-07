import { Amount } from '../../components/Amount';

interface Props {
  incomeAgorot: number;
  expenseAgorot: number;
  loading: boolean;
}

/**
 * שתי המשבצות הגדולות: סך הכנסות וסך הוצאות של החודש הנבחר.
 * (בשלב 6 הן הופכות לכפתורים שפותחים את רשימות הפעולות.)
 */
export function TotalsTiles({ incomeAgorot, expenseAgorot, loading }: Props) {
  return (
    <div className="tiles">
      <section className="tile tile-income" aria-label="סך הכנסות">
        <div className="tile-title">
          <span aria-hidden="true">💰</span> סך הכנסות
        </div>
        <div className="tile-amount">
          {loading ? <span className="skeleton">—</span> : <Amount agorot={incomeAgorot} />}
        </div>
      </section>

      <section className="tile tile-expense" aria-label="סך הוצאות">
        <div className="tile-title">
          <span aria-hidden="true">💸</span> סך הוצאות
        </div>
        <div className="tile-amount">
          {loading ? <span className="skeleton">—</span> : <Amount agorot={expenseAgorot} />}
        </div>
      </section>
    </div>
  );
}
