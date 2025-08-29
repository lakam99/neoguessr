import React from "react";

export default function DesktopActionRow({
  reveal,
  disabledSubmit,
  onSubmit,
  onNext,
  onSaveFavourite,
  nextLabel="Next round",
  saveDisabled=false,
  leftMeta=null,
  showSaveScore=false,
  onSaveScore,
}){
  return (
    <div className="hidden lg:flex flex-col md:flex-row items-center justify-between gap-3">
      <div className="text-sm opacity-80">{leftMeta}</div>
      <div className="flex items-center gap-2">
        {!reveal ? (
          <button
            disabled={disabledSubmit}
            onClick={onSubmit}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            Submit guess
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onNext}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              {nextLabel}
            </button>
            <button
              onClick={onSaveFavourite}
              disabled={saveDisabled}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              Save to Favourites
            </button>
            {showSaveScore && (
              <button
                onClick={onSaveScore}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                Save score
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
