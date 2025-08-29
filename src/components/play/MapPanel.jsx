import React from "react";
import GuessMap from "../GuessMap.jsx";

export default function MapPanel({
  googleReady,
  guess,
  answer,          // {lat,lng} or null
  onGuess,         // (arr)=>void
  heightClass="h-[34vh] lg:h-[70vh]",
  className = "rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 bg-slate-900/30",
  showGuessHint=true,
}){
  return (
    <div className={className}>
      <div className={heightClass}>
        <GuessMap
          googleReady={googleReady}
          guess={guess}
          answer={answer}
          onGuess={onGuess}
          interactive={true}
        />
      </div>
      {showGuessHint && (
        <div className="p-2 flex items-center justify-between">
          <span className="text-sm opacity-80">
            {Array.isArray(guess) ? `Your guess: ${guess[0].toFixed(3)}, ${guess[1].toFixed(3)}` : "Click the map to place your guess."}
          </span>
        </div>
      )}
    </div>
  );
}
