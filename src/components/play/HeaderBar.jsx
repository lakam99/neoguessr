import React from "react";

export default function HeaderBar({ leftBadges = [], rightContent = null, extraClass = "" }){
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 ring-1 ring-white/10 p-3 text-sm lg:text-base ${extraClass}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {leftBadges.map((b, i)=>(
          <span key={i} className="px-3 py-1 rounded-full bg-slate-700/70 text-center">{b}</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {rightContent}
      </div>
    </div>
  );
}
