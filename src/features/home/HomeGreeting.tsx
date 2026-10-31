/** ברכה לפי שעות היום, בלי אייקון. */
export function HomeGreeting({ firstName }: { firstName: string }) {
  const hour = new Date().getHours();
  const night = hour >= 20 || hour < 5;
  const name = firstName.trim();
  return (
    <div className="home-greeting">
      <span className="greet-text">
        {hour >= 5 && hour < 12 && <span>בוקר טוב</span>}
        {hour >= 12 && hour < 17 && <span>צהריים טובים</span>}
        {hour >= 17 && hour < 20 && <span>ערב טוב</span>}
        {night && <span>לילה טוב</span>}
        {name ? `, ${name}` : ''}
      </span>
    </div>
  );
}
