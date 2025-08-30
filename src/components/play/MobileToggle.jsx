import React from "react";

export default function MobileToggle({ mode, onChange }){
  return (
    <div className="lg:hidden flex items-center justify-center gap-2">
      <button onClick={()=>onChange('pano')} className={`px-4 py-2 rounded-xl text-sm ${mode==='pano' ? 'bg-indigo-600 text-white' : 'bg-slate-800/70'}`}>Photo</button>
      <button onClick={()=>onChange('map')} className={`px-4 py-2 rounded-xl text-sm ${mode==='map' ? 'bg-indigo-600 text-white' : 'bg-slate-800/70'}`}>Map</button>
    </div>
  );
}
