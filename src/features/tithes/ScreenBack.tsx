import { useNavigate } from 'react-router-dom';
import { ChevronRight } from '../../components/icons';

/** קישור חזרה בתוך מסך שיש לו את כותרת החודש (ולכן אין לו ScreenHeader). */
export function ScreenBack({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="link-btn back-link" onClick={() => navigate(to, { replace: true })}>
      <ChevronRight /> {label}
    </button>
  );
}
