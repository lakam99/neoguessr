import React from "react";
import StreetViewStatic from "../StreetViewStatic.jsx";
import InteractiveStreetView from "./InteractiveStreetView.jsx";

export default function PanoPanel({
  googleReady,
  loading,
  error,
  picking = false,
  freezePano = false,
  answer,         // { lat, lng, panoId?, pov? }
  onRetry,        // ()=>void
  className = "rounded-2xl shadow-xl ring-1 ring-white/10 bg-slate-900/30",
  // NEW: match MapPanel height
  heightClass = "h-[34vh] lg:h-[70vh]",
}) {
  return (
    <div className={`${className} overflow-hidden`}>
      <div className={heightClass}>
        {/* Loading */}
        {(!googleReady || loading) && (
          <div className="w-full h-full grid place-items-center bg-slate-900/60">
            <div className="animate-pulse text-center">
              <div className="text-sm opacity-80">
                {!googleReady ? "Loading Google Maps…" : "Loading Street View…"}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="w-full h-full grid place-items-center p-6 text-center bg-slate-900/60">
            <div className="space-y-2">
              <p className="text-red-300 font-semibold">Street View failed to load.</p>
              <p className="text-sm opacity-80">{String(error)}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
                  disabled={picking}
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {/* View */}
        {googleReady && !loading && !error && answer && (
          freezePano ? (
            <StreetViewStatic
              lat={answer.lat}
              lng={answer.lng}
              panoId={answer.panoId || null}
              heading={answer.pov?.heading ?? 0}
              pitch={answer.pov?.pitch ?? 15}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full">
              <InteractiveStreetView
                googleReady={googleReady}
                panoLatLng={{ lat: answer.lat, lng: answer.lng }}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
