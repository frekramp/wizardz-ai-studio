/**
 * Self-contained placeholder art (inline SVG) — NOT a user file.
 * Fire palette pulled from the Wizardz logo. Stands in for a generated wizard
 * until the real generation pipeline is wired.
 */
export function WizardArt({
  className,
  seed = 0,
}: {
  className?: string;
  seed?: number;
}) {
  const uid = `w${seed}`;
  const sparkles = [
    [70, 90, 3],
    [320, 110, 4],
    [110, 300, 3],
    [310, 300, 3],
    [60, 200, 2],
    [340, 220, 2],
    [200, 60, 2],
  ];
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="Wizard placeholder"
    >
      <defs>
        <linearGradient id={`${uid}-hat`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#ffc21e" />
          <stop offset="0.55" stopColor="#ff7a18" />
          <stop offset="1" stopColor="#ea3b23" />
        </linearGradient>
        <radialGradient id={`${uid}-bg`} cx="0.5" cy="0.4" r="0.75">
          <stop offset="0" stopColor="#2a1410" />
          <stop offset="1" stopColor="#0a0708" />
        </radialGradient>
      </defs>

      <rect width="400" height="400" fill={`url(#${uid}-bg)`} />

      {sparkles.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#ffc21e" opacity="0.75" />
      ))}

      {/* hat cone */}
      <path
        d="M200 66 C 210 66 252 232 258 248 L142 248 C148 232 190 66 200 66 Z"
        fill={`url(#${uid}-hat)`}
        stroke="#1a0d0a"
        strokeWidth="4"
      />
      {/* brim */}
      <ellipse cx="200" cy="250" rx="86" ry="17" fill="#ff7a18" stroke="#1a0d0a" strokeWidth="4" />
      <ellipse cx="200" cy="247" rx="84" ry="13" fill="#ffc21e" opacity="0.55" />

      {/* star emblem */}
      <path
        d="M200 138 l7 16 18 2 -13 12 4 18 -16 -9 -16 9 4 -18 -13 -12 18 -2 z"
        fill="#fff"
      />

      {/* face hint */}
      <circle cx="200" cy="296" r="30" fill="#1c1512" stroke="#3a2a22" strokeWidth="3" />
      <circle cx="190" cy="294" r="3.6" fill="#ffc21e" />
      <circle cx="210" cy="294" r="3.6" fill="#ffc21e" />
    </svg>
  );
}
