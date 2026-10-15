/** ברכה לפי שעות היום, עם שמש או ירח מונפשים. */
export function HomeGreeting({ firstName }: { firstName: string }) {
  const hour = new Date().getHours();
  const night = hour >= 20 || hour < 5;
  const name = firstName.trim();
  return (
    <div className="home-greeting">
      <svg className={night ? 'greet-icon greet-moon' : 'greet-icon greet-sun'} viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
        {night ? (
          <path d="M31 8a17 17 0 1 0 9 30A15 15 0 0 1 31 8z" fill="#c9cdf2" />
        ) : (
          <>
            <g className="greet-rays" stroke="#e0a43a" strokeWidth="3" strokeLinecap="round">
              <path d="M24 3v7M24 38v7M3 24h7M38 24h7M9 9l5 5M34 34l5 5M9 39l5-5M34 14l5-5" />
            </g>
            <circle cx="24" cy="24" r="9" fill="#f2bf5e" />
          </>
        )}
      </svg>
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
