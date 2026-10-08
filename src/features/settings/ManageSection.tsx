import { Link } from 'react-router-dom';
import { DataSection } from './DataSection';
import { FormulasSection } from './FormulasSection';

/** ניהול האפליקציה: חישובי מעשרות, קטגוריות, וגיבוי ושחזור. */
export function ManageSection() {
  return (
    <div className="stack">
      <h3 className="subhead">מעשרות וחישובים</h3>
      <FormulasSection />
      <hr className="divider" />
      <h3 className="subhead">קטגוריות</h3>
      <Link className="btn btn-secondary" to="/categories">
        ניהול קטגוריות
      </Link>
      <hr className="divider" />
      <h3 className="subhead">גיבוי ושחזור</h3>
      <DataSection />
    </div>
  );
}
