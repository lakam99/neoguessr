import React from "react";

export function variantForRankTitle(title){
  if(!title) return "bronze";
  const t = String(title).toLowerCase();
  if (t.includes("legend")) return "legend";
  if (t.includes("black")) return "black";
  if (t.includes("insurgent")) return "platinum";
  if (t.includes("operative")) return "gold";
  if (t.includes("trainee") || t.includes("easy")) return "silver";
  return "bronze";
}

export default function RankMedal({ variant="bronze", size=24, animated=false, className="" }){
  const colors = {
    bronze:   { a:"#784a27", b:"#c08a5a", c:"#f0c9a1" },
    silver:   { a:"#667085", b:"#98a2b3", c:"#d0d5dd" },
    gold:     { a:"#8a6b00", b:"#d4af37", c:"#fde68a" },
    platinum: { a:"#1f2937", b:"#64748b", c:"#cbd5e1" },
    black:    { a:"#000000", b:"#111827", c:"#4b5563" },
    legend:   { a:"#4f46e5", b:"#a78bfa", c:"#f472b6" },
  }[variant] || { a:"#4b5563", b:"#9ca3af", c:"#e5e7eb" };

  const spin = animated ? "animate-[spin_6s_linear_infinite]" : "";
  const shimmer = animated ? "animate-pulse" : "";
  const s = typeof size === "number" ? size : 24;

  return (
    <div className={`inline-flex items-center justify-center \${shimmer} \${className}`} style={{ width:s, height:s }}>
      <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={spin}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors.c} />
            <stop offset="100%" stopColor={colors.b} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="url(#g1)" stroke={colors.a} strokeWidth="3" />
        <circle cx="32" cy="32" r="20" fill={colors.b} opacity="0.35" />
        <path d="M32 18 L36 28 L47 28 L38 34 L42 44 L32 38 L22 44 L26 34 L17 28 L28 28 Z" fill={colors.c} stroke={colors.a} strokeWidth="1.5" />
      </svg>
    </div>
  );
}
