import { describe, expect, it } from 'vitest';
import { annualPeriodOf, previousAnnualPeriod } from './annual';

describe('annualPeriodOf', () => {
  it('קלנדרי: ינואר עד דצמבר של שנת החודש הנבחר', () => {
    const p = annualPeriodOf('2026-10', 'calendar');
    expect(p.id).toBe('2026');
    expect(p.months[0]).toBe('2026-01');
    expect(p.months[11]).toBe('2026-12');
  });

  it('12 חודשים מתחילת התיעוד: מתחיל בחודש הראשון ומתקדם בקפיצות של 12', () => {
    const p = annualPeriodOf('2026-10', 'from-start', '2025-03');
    expect(p.startYm).toBe('2026-03');
    expect(p.endYm).toBe('2027-02');
    expect(p.id).toBe('2026-03y');
    expect(annualPeriodOf('2026-02', 'from-start', '2025-03').startYm).toBe('2025-03');
    expect(annualPeriodOf('2025-03', 'from-start', '2025-03').startYm).toBe('2025-03');
  });

  it('חודש שלפני תחילת התיעוד נופל בתקופה קודמת', () => {
    expect(annualPeriodOf('2025-01', 'from-start', '2025-03').startYm).toBe('2024-03');
  });

  it('בלי חודש תיעוד ראשון התקופה מתחילה בחודש הנבחר', () => {
    expect(annualPeriodOf('2026-10', 'from-start').startYm).toBe('2026-10');
  });

  it('התקופה הקודמת', () => {
    const p = annualPeriodOf('2026-10', 'from-start', '2025-03');
    expect(previousAnnualPeriod(p, 'from-start').startYm).toBe('2025-03');
    expect(previousAnnualPeriod(annualPeriodOf('2026-10', 'calendar'), 'calendar').id).toBe('2025');
  });
});
