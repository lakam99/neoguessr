import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../ctx/SettingsContext.jsx'

const PRESETS = {
  ez:   { includeOceans: false, lowQuotaMode: true,  svAttemptBudget: 4 },
  // 'moderate' is now HARD per request
  moderate:{ includeOceans: true,  lowQuotaMode: false, svAttemptBudget: 10 },
  hard: { includeOceans: true,  lowQuotaMode: false, svAttemptBudget: 12 },
  cia:  { includeOceans: true,  lowQuotaMode: false, svAttemptBudget: 12 },
};

const MULTIPLIER_LABEL = {
  ez: 'x0.5',
  moderate: 'x1.0',
  hard: 'x1.2',
  cia: 'x1.6'
};

export default function Menu(){
  const nav = useNavigate();
  const { settings, setSettings } = useSettings();
  const [draft, setDraft] = React.useState(settings);

  function applyPreset(name){
    const p = PRESETS[name];
    setDraft(prev => ({ ...prev, preset: name, ...p, svBaseBackoffMs: 2000 }));
  }

  function updateField(key, value){
    setDraft(prev => ({ ...prev, preset: 'custom', [key]: value }));
  }

  function start(){
    // force fixed backoff
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

      <div className="grid md:grid-cols-4 gap-3">
        {Object.entries(PRESETS).map(([key, val]) => {
          const title = key==='cia' ? 'CIA/Rainbolt' : key[0].toUpperCase() + key.slice(1);
          const active = draft.preset === key;
          return (
            <button key={key} onClick={()=>applyPreset(key)} className={`p-3 rounded-xl ring-1 ring-white/10 text-left transition ${active?'bg-indigo-600':'bg-slate-800/70 hover:bg-slate-700/70'}`}>
              <div className="font-semibold">{title} <span className="opacity-90 text-xs">({MULTIPLIER_LABEL[key]})</span></div>
              <div className="text-xs opacity-80 mt-1">
                {val.lowQuotaMode ? 'Curated SV, ' : ''}
                {val.includeOceans ? 'Includes oceans, ' : 'Land‑biased, '}
                {val.svAttemptBudget} attempts
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

      <details className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4">
        <summary className="cursor-pointer font-semibold">Advanced settings</summary>
        <div className="grid md:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="block mb-1 text-sm opacity-80">Street View mode</label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={draft.lowQuotaMode} onChange={e=>updateField('lowQuotaMode', e.target.checked)} />
              <span>Curated (low quota / EZ)</span>
            </label>
          </div>
          <div>
            <label className="block mb-1 text-sm opacity-80">SV attempt budget</label>
            <input type="number" min="1" max="20" value={draft.svAttemptBudget} onChange={e=>updateField('svAttemptBudget', parseInt(e.target.value||'0',10))} className="w-full px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-white/10 outline-none"/>
          </div>
          <div>
            <label className="block mb-1 text-sm opacity-80">SV base backoff (ms)</label>
            <input type="number" value={2000} disabled className="w-full px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-white/10 outline-none opacity-60"/>
            <div className="text-xs opacity-70 mt-1">Fixed at 2000ms for all presets</div>
          </div>
        </div>
      </details>

      <div className="flex items-center justify-between">
        <div className="text-sm opacity-75">Presets tweak the advanced options; difficulty multiplier shown in parentheses.</div>
        <button onClick={start} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500">Start game</button>
      </div>
    </div>
  )
}
