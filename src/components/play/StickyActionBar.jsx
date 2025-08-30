import React from "react";

export default function StickyActionBar({ leftLabel,       // string, e.g., "Round 2/5" or "Stage 1/4"
  reveal,
  disabled,
  onSubmit,
  onSaveFavourite,
  onNext,
  picking=false,
  showSaveFavourite=true, nextLabel = "Next" }){
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pt-8 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm px-3 py-2 rounded-xl bg-slate-800/80">{leftLabel}</div>
        {!reveal ? (
          <button
            disabled={disabled}
            onClick={onSubmit}
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        ) : (
          <div className="flex-1 flex gap-2">
            {showSaveFavourite && (
              <button
                onClick={onSaveFavourite}
                className="flex-1 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white"
              >
                Save favourite
              </button>
            )}
            <button
              onClick={onNext}
              disabled={picking}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
