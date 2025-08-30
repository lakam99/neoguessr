import React from "react";
import StreetViewStatic from "../StreetViewStatic.jsx";

export default function StreetViewPanel({ text, lat, lng, panoId, className = "" }){
  return (
    <div className={`rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 bg-slate-900/30 ${className}`}>
      {text && <div className="p-2 text-sm opacity-80">{text}</div>}
      <div className="aspect-video">
        <StreetViewStatic lat={lat} lng={lng} panoId={panoId} className="w-full h-full" />
      </div>
    </div>
  );
}
