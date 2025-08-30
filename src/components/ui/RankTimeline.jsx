import React from "react";

/**
 * RankTimeline
 * props:
 *  - ranks: [{ title, min }, ...] ascending by min
 *  - total: current cumulative total
 *  - className: optional
 */
export default function RankTimeline({ ranks = [], total = 0, className = "" }) {
  if (!Array.isArray(ranks) || ranks.length === 0) return <div className={className} />;

  const mins = ranks.map(r => Number(r.min || 0));
  const titles = ranks.map(r => r.title || "");
  const spans = mins.map((m, i) => {
    if (i < mins.length - 1) return Math.max(1, mins[i+1] - m);
    const prev = i > 0 ? mins[i] - mins[i-1] : 100;
    return Math.max(1, prev);
  });

  const start = mins[0] || 0;
  const end   = mins[mins.length-1] + spans[spans.length-1];
  const range = Math.max(1, end - start);
  const pct = (x) => Math.min(100, Math.max(0, ((x - start) / range) * 100));

  const cursorPct = pct(total);
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const segColors = ["#0ea5e9","#6366f1","#22c55e","#f59e0b","#ef4444","#84cc16","#a855f7","#06b6d4"];

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm opacity-80">Ranks</div>
        <div className="text-xs opacity-70">Total: {Math.floor(total)}</div>
      </div>

      <div className="relative h-4 rounded-full bg-slate-800 ring-1 ring-white/10 overflow-hidden">
        <div className="absolute inset-0 flex">
          {spans.map((span, i) => (
            <div
              key={i}
              className="h-full"
              style={{
                width: `${(span / range) * 100}%`,
                background: `${segColors[i % segColors.length]}22`,
                borderRight: i < spans.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={() => setHoverIdx(i)}
            />
          ))}
        </div>

        {ranks.map((r, i) => {
          const x = pct(mins[i]);
          return (
            <div key={i} className="absolute top-0" style={{ left: `${x}%`, transform: "translateX(-50%)" }}>
              <div className="w-px h-4 bg-white/70" />
              <div className="absolute top-4 pt-1 text-[10px] whitespace-nowrap text-center translate-x-[-50%] opacity-80">
                {r.title}
              </div>
            </div>
          );
        })}

        <div
          className="absolute top-0 h-4 w-0.5 bg-emerald-400"
          style={{ left: `${cursorPct}%` }}
          title={`Total: ${Math.floor(total)}`}
        />
      </div>

      {hoverIdx != null && (
        <div className="mt-2 text-xs px-2 py-1 rounded-lg bg-slate-900/80 ring-1 ring-white/10 inline-block">
          <span className="font-medium">{titles[hoverIdx]}</span>
          <span className="opacity-80"> — requires ≥ {mins[hoverIdx]}</span>
        </div>
      )}
    </div>
  );
}
