import { DataSection } from './DataSection';
import { FormulasSection } from './FormulasSection';

/** ניהול האפליקציה: חישובי מעשרות וגיבוי ושחזור. */
export function ManageSection() {
  return (
    <div className="stack">
      <h3 className="subhead">מעשרות וחישובים</h3>
      <FormulasSection />
      <hr className="divider" />
      <h3 className="subhead">גיבוי ושחזור</h3>
      <DataSection />
    </div>
  );
}
