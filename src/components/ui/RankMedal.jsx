import React from "react";

export function variantForRankTitle(title = "", fallbackIndex = 0) {
  const t = String(title).toLowerCase();
  if (/(trainee|rookie|novice|bronze)/i.test(t)) return "bronze";
  if (/(operative|agent|silver)/i.test(t)) return "silver";
  if (/(insurgent|elite|gold)/i.test(t)) return "gold";
  if (/(black\s*ops|shadow|obsidian)/i.test(t)) return "obsidian";
  if (/(emerald)/i.test(t)) return "emerald";
  if (/(amethyst|mythic|legend)/i.test(t)) return "amethyst";
  const cycle = ["bronze", "silver", "gold", "emerald", "amethyst", "obsidian"];
  return cycle[fallbackIndex % cycle.length];
}

const PALETTE = {
  bronze:   { medal: "#b45309", rim: "#78350f", ribbon: "#92400e", accent: "#ffd7a1" },
  silver:   { medal: "#9ca3af", rim: "#6b7280", ribbon: "#64748b", accent: "#e5e7eb" },
  gold:     { medal: "#f59e0b", rim: "#b45309", ribbon: "#b45309", accent: "#fff1a6" },
  emerald:  { medal: "#10b981", rim: "#047857", ribbon: "#065f46", accent: "#a7f3d0" },
  amethyst: { medal: "#8b5cf6", rim: "#6d28d9", ribbon: "#4c1d95", accent: "#ddd6fe" },
  obsidian: { medal: "#0f172a", rim: "#111827", ribbon: "#0ea5e9", accent: "#67e8f9" },
};

function starPoints(cx, cy, spikes, outerR, innerR) {
  const step = Math.PI / 5;
  let rot = -Math.PI / 2;
  const pts = [];
  for (let i = 0; i < spikes; i++) {
    pts.push([cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR]);
    rot += step;
    pts.push([cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR]);
    rot += step;
  }
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

/**
 * RankMedal — animated SVG medal
 * Props:
 *  - variant: palette key
 *  - size: px width (height ~1.2x)
 *  - title: aria label
 *  - shimmer: boolean (adds moving light sweep)
 *  - spin: boolean (one-time spin on mount)
 *  - glow: boolean (stronger drop shadow)
 */
export default function RankMedal({ variant = "gold", size = 32, title, shimmer = false, spin = false, glow = false, className = "" }) {
  const id = React.useId();
  const c = PALETTE[variant] || PALETTE.gold;

  return (
    <svg
      width={size}
      height={Math.round(size * 1.2)}
      viewBox="0 0 100 120"
      className={className}
      role="img"
      aria-label={title || `${variant} medal`}
    >
      <defs>
        <filter id={`${id}-drop`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="black" floodOpacity={glow ? 0.35 : 0.18}/>
        </filter>
        <linearGradient id={`${id}-shine`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
        {/* shimmer sweep */}
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-medal-clip`}>
          <circle cx="50" cy="72" r="26" />
        </clipPath>
        <style>
          {`
            @keyframes confetti-fall {
              0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0.95; }
            }
            @keyframes medal-spin-once {
              0% { transform: rotate(-20deg) scale(0.95); }
              60% { transform: rotate(380deg) scale(1.02); }
              100% { transform: rotate(360deg) scale(1); }
            }
            @keyframes shimmer-move {
              0% { transform: translateX(-70%); }
              100% { transform: translateX(70%); }
            }
          `}
        </style>
      </defs>

      {/* Ribbon */}
      <g filter={`url(#${id}-drop)`}>
        <path d="M30 0 L48 0 L60 40 L40 40 Z" fill={c.ribbon} />
        <path d="M70 0 L52 0 L40 40 L60 40 Z" fill={c.ribbon} opacity="0.85" />
      </g>

      {/* Medal body (group so we can spin) */}
      <g filter={`url(#${id}-drop)`} style={spin ? { transformOrigin: "50px 72px", animation: "medal-spin-once 1.2s ease-out 1" } : undefined}>
        <circle cx="50" cy="72" r="26" fill={c.medal} stroke={c.rim} strokeWidth="3" />
        <circle cx="50" cy="72" r="26" fill={`url(#${id}-shine)`} />

        {/* Shimmer sweep */}
        {shimmer && (
          <g clipPath={`url(#${id}-medal-clip)`}>
            <rect x="-40" y="46" width="80" height="52" fill={`url(#${id}-sweep)`} style={{ transform: "skewX(-20deg)", transformOrigin: "50px 72px", animation: "shimmer-move 1.6s linear infinite" }} />
          </g>
        )}

        {/* Inner star */}
        <polygon
          points={starPoints(50, 72, 5, 16, 8)}
          fill={c.accent}
          stroke={c.rim}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
