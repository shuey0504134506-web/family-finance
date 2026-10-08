/**
 * שם מרחב (עסק או משק בית) בתוך כפתור: שם ארוך מוקטן במקום להישבר לשורה נוספת,
 * ואם עדיין אינו נכנס, נחתך בשלוש נקודות.
 */
export function spaceLabelSize(name: string): 'normal' | 'long' | 'xlong' {
  const len = [...name].length;
  if (len > 22) return 'xlong';
  if (len > 13) return 'long';
  return 'normal';
}

export function SpaceLabel({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`seg-label seg-${spaceLabelSize(name)} ${className}`.trim()}>{name}</span>;
}
