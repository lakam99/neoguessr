import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../ctx/SettingsContext.jsx'
import { ready as fbReady, db, collection, query, orderBy, limit, onSnapshot } from '../firebase'

const PRESETS = {
  tutorial:   { includeOceans: false, lowQuotaMode: true,  svAttemptBudget: 4 },
  // Moderate is land‑biased; only Hard+ include oceans
  moderate:{ includeOceans: false, lowQuotaMode: false, svAttemptBudget: 10 },
  hard: { includeOceans: true,  lowQuotaMode: false, svAttemptBudget: 12 },
  cia:  { includeOceans: true,  lowQuotaMode: false, svAttemptBudget: 12 },
};

const MULTIPLIER_LABEL = {
  tutorial: 'x0.5',
  moderate: 'x1.0',
  hard: 'x1.2',
  cia: 'x1.6'
};

export default function Menu(){
  const nav = useNavigate();
  const { settings, setSettings } = useSettings();
  const [draft, setDraft] = React.useState(settings);
  const [ciaTop, setCiaTop] = React.useState([]);
  const [globalTop, setGlobalTop] = React.useState([]);

  React.useEffect(()=>{
    if(!fbReady) return;
    const qCia = query(collection(db, 'leaderboards', 'cia', 'scores'), orderBy('score','desc'), limit(10));
    const unsub1 = onSnapshot(qCia, snap => setCiaTop(snap.docs.map(d=>({id:d.id, ...d.data()}))));
    const qGlobal = query(collection(db, 'leaderboards', 'global', 'totals'), orderBy('total','desc'), limit(100));
    const unsub2 = onSnapshot(qGlobal, snap => setGlobalTop(snap.docs.map(d=>({id:d.id, ...d.data()}))));
    return ()=>{ unsub1 && unsub1(); unsub2 && unsub2(); };
  }, []);

  function applyPreset(name){
    const p = PRESETS[name];
    setDraft(prev => ({ ...prev, preset: name, ...p, svBaseBackoffMs: 2000 }));
  }

  function updateField(key, value){
    setDraft(prev => ({ ...prev, preset: 'custom', [key]: value }));
  }

  function start(){
    const toSave = { ...draft, svBaseBackoffMs: 2000 };
    setSettings(toSave);
    nav('/play');
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">WorldGuessr</h1>
        <p className="opacity-80">Pick your challenge, then jump in.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(PRESETS).map(([key, val]) => {
          const title = key==='cia' ? 'Operative' : key[0].toUpperCase() + key.slice(1);
          const active = draft.preset === key;
          return (
            <button
              key={key}
              onClick={()=>applyPreset(key)}
              aria-pressed={active}
              className={`p-3 rounded-xl text-left w-full transition ${
                active
                  ? 'ring-2 ring-indigo-400 bg-indigo-600 text-white'
                  : 'ring-1 ring-white/10 bg-slate-800/70 hover:bg-slate-700/70'
              }`}
            >
              <div className="font-semibold">
                {title} <span className="opacity-90 text-xs">({MULTIPLIER_LABEL[key]})</span>
                {active && (<span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-center">Selected</span>)}
              </div>
              <div className="text-xs opacity-80 mt-1">
                {val.lowQuotaMode ? 'Curated SV' : (val.includeOceans ? 'Includes oceans' : 'Land‑biased')}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-3 gap-4 rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4">
        <div>
          <label className="block mb-1 text-sm opacity-80">Location mode</label>
          <select value={draft.locationMode} onChange={e=>updateField('locationMode', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-white/10 outline-none">
            <option value="random">Random (world)</option>
            <option value="country">Specific country</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 text-sm opacity-80">Country (if Specific)</label>
          <input value={draft.country} onChange={e=>updateField('country', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-white/10 outline-none" placeholder="e.g., Canada"/>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={draft.includeOceans} onChange={e=>updateField('includeOceans', e.target.checked)} />
            <span>Include oceans</span>
          </label>
        </div>
      </div>

            <div className="flex items-center justify-between">
        <div className="text-sm opacity-75">Presets tweak the advanced options; difficulty multiplier shown in parentheses.</div>
        <button onClick={start} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500">Start game</button>
      </div>

      
      {/* Leaderboards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* CIA Top 10 */}
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Top 10 — Operative (Global)</h3>
            <span className="text-xs opacity-70">{fbReady ? 'Live' : 'Offline (configure Firebase)'}</span>
          </div>
          <div className="overflow-y-auto h-56 md:h-72">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-800/80"><tr><th className="px-2 py-1">#</th><th className="px-2 py-1">User</th><th className="px-2 py-1">Score</th></tr></thead>
              <tbody>
                {(ciaTop || []).map((r,i)=>(
                  <tr key={r.id||i} className="odd:bg-slate-800/50">
                    <td className="px-2 py-1">{i+1}</td>
                    <td className="px-2 py-1">{r.username||'Unknown'}</td>
                    <td className="px-2 py-1 font-semibold">{r.score}</td>
                  </tr>
                ))}
                {(!ciaTop || ciaTop.length===0) && <tr><td colSpan="3" className="px-2 py-2 opacity-70">No scores yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global cumulative Top 100 */}
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Top 100 — Global (All Modes, Cumulative)</h3>
            <span className="text-xs opacity-70">{fbReady ? 'Live' : 'Offline (configure Firebase)'}</span>
          </div>
          <div className="overflow-y-auto h-56 md:h-72">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-800/80"><tr><th className="px-2 py-1">#</th><th className="px-2 py-1">User</th><th className="px-2 py-1">Total</th></tr></thead>
              <tbody>
                {(globalTop || []).map((r,i)=>(
                  <tr key={r.id||i} className="odd:bg-slate-800/50">
                    <td className="px-2 py-1">{i+1}</td>
                    <td className="px-2 py-1">{r.username||'Unknown'}</td>
                    <td className="px-2 py-1 font-semibold">{r.total}</td>
                  </tr>
                ))}
                {(!globalTop || globalTop.length===0) && <tr><td colSpan="3" className="px-2 py-2 opacity-70">No totals yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    
    </div>
  )
}
