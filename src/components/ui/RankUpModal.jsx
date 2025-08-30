import React from "react";

import RankMedal, { variantForRankTitle } from "./RankMedal.jsx";

export default function RankUpModal({ toTitle, onClose }) {
  const pieces = Array.from({ length: 70 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <style>
          {`
            @keyframes confetti-fall {
              0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0.95; }
            }
          `}
        </style>
        {pieces.map((i) => {
          const left = Math.random() * 100;
          const dur = 2.6 + Math.random() * 1.9;
          const delay = Math.random() * 0.8;
          const size = 6 + Math.random() * 7;
          const colors = ["#22c55e","#3b82f6","#f59e0b","#ef4444","#a78bfa","#06b6d4"];
          return (
            <div
              key={i}
              className="absolute rounded-sm"
              style={{
                left: `${left}%`,
                top: `-5%`,
                width: `${size}px`,
                height: `${size}px`,
                background: colors[i % colors.length],
                animation: `confetti-fall ${dur}s linear ${delay}s forwards`,
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 w-[92%] max-w-md rounded-2xl bg-slate-900/90 ring-1 ring-white/10 p-6 text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-xl font-bold mb-1">Promotion Achieved!</h2>
        <p className="opacity-90 mb-4">
          You’ve ranked up to <span className="font-semibold">{toTitle}</span>.
        </p>
        <button onClick={onClose} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500">
          Nice!
        </button>
      </div>
    </div>
  );
}
