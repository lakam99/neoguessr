import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ready as fbReady,
  auth,
  db,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
} from "../firebase";
import { useSettings } from "../ctx/SettingsContext.jsx";
import { RANKS, rankFor } from "../lib/ranks.js";
import RankMedal from "../components/ui/RankMedal.jsx";

// ----- Classic mode presets (same as before)
const PRESETS = {
  tutorial: { includeOceans: false, lowQuotaMode: true,  svAttemptBudget: 4  },
  // Moderate is land-biased; only Hard+ include oceans
  moderate: { includeOceans: false, lowQuotaMode: false, svAttemptBudget: 10 },
  hard:     { includeOceans: true,  lowQuotaMode: false, svAttemptBudget: 12 },
  cia:      { includeOceans: true,  lowQuotaMode: false, svAttemptBudget: 12 },
};

const MULTIPLIER_LABEL = {
  tutorial: "x0.5",
  moderate: "x1.0",
  hard:     "x1.2",
  cia:      "x1.6",
};

export default function Menu() {
  const nav = useNavigate();
  const { settings, setSettings } = useSettings();

  // Campaign leaderboard preview + my rank
  const [top, setTop] = React.useState([]);
  const [myTotal, setMyTotal] = React.useState(0);
  const user = auth?.currentUser || null;
  const uid = user?.uid || null;

  React.useEffect(() => {
    if (!fbReady) return;
    const qTop = query(
      collection(db, "leaderboards", "campaign", "totals"),
      orderBy("total", "desc"),
      limit(5)
    );
    const unsubTop = onSnapshot(qTop, (snap) => {
      setTop(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubTop && unsubTop();
  }, [fbReady]);

  React.useEffect(() => {
    if (!fbReady || !uid) return;
    const unsubMine = onSnapshot(doc(db, "leaderboards", "campaign", "totals", uid), (d) => {
      const data = d.data();
      setMyTotal(data?.total || 0);
    });
    return () => unsubMine && unsubMine();
  }, [fbReady, uid]);

  const myRank = rankFor(myTotal);
  const nextRank = React.useMemo(() => {
    const i = RANKS.findIndex((r) => r.title === myRank.title);
    return i >= 0 && i < RANKS.length - 1 ? RANKS[i + 1] : null;
  }, [myRank]);

  const rankProgress = React.useMemo(() => {
    const curMin = myRank.min || 0;
    const nextMin = nextRank ? nextRank.min : Math.max(curMin, myTotal);
    const span = Math.max(1, nextMin - curMin);
    const val  = Math.min(span, Math.max(0, myTotal - curMin));
    const pct  = Math.round((val / span) * 100);
    return { curMin, nextMin, val, span, pct };
  }, [myRank, nextRank, myTotal]);

  // ----- Classic mode UI state
  const [draft, setDraft] = React.useState(settings);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // NEW: track a "selected" preset so one is always highlighted
  const [selectedPreset, setSelectedPreset] = React.useState(() => (
    PRESETS[settings?.preset] ? settings.preset : "moderate"
  ));

  // Ensure there is *always* a valid selected preset on mount
  React.useEffect(() => {
    if (!PRESETS[draft?.preset]) {
      // Default the working config toward the selectedPreset (or moderate)
      const key = PRESETS[selectedPreset] ? selectedPreset : "moderate";
      setDraft(prev => ({ ...prev, preset: key, ...PRESETS[key], svBaseBackoffMs: 2000 }));
      setSelectedPreset(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  function applyPreset(name) {
    const p = PRESETS[name] || PRESETS.moderate;
    setSelectedPreset(name); // keep selection even if advanced options are changed later
    setDraft(prev => ({ ...prev, preset: name, ...p, svBaseBackoffMs: 2000 }));
  }

  function updateField(key, value) {
    // Switch to "custom" but do NOT change selectedPreset (so a tile stays highlighted)
    setDraft(prev => ({ ...prev, preset: "custom", [key]: value }));
  }

  function startClassic() {
    // If draft.preset is invalid/custom, fall back to the selectedPreset tile
    const pkey = PRESETS[draft.preset] ? draft.preset : (PRESETS[selectedPreset] ? selectedPreset : "moderate");
    const toSave = { ...draft, preset: pkey, ...PRESETS[pkey], svBaseBackoffMs: 2000 };
    setSettings(toSave);
    nav("/play");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Campaign Hero */}
      <section className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="relative p-5 sm:p-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Campaign Mode
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <RankMedal variant="gold" size={28} animated />
            <span className="text-sm opacity-80">Campaign Mode</span>
          </div>
          <p className="mt-2 text-sm sm:text-base opacity-85 max-w-prose">
            Track a target from a wide search area down to a tight circle. Earn points,
            climb ranks, and become an elite operative.
          </p>

          {/* Rank + progress (when signed in) */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-600/80 text-white text-sm">
                {uid ? myRank.title : "Sign in for ranks"}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-700/70 text-sm">
                Total: {uid ? myTotal : 0}
              </span>
            </div>

            {/* Progress to next rank */}
            {uid && nextRank && (
              <div className="w-full sm:w-80 mt-2 sm:mt-0">
                <div className="text-xs opacity-80 mb-1">
                  Progress to {nextRank.title}: {rankProgress.val} / {rankProgress.span} ({rankProgress.pct}%)
                </div>
                <div className="h-2 rounded bg-slate-800 overflow-hidden ring-1 ring-white/10">
                  <div
                    className="h-full bg-indigo-500 transition-[width]"
                    style={{ width: `${rankProgress.pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* CTA: ONLY Campaign */}
          <div className="mt-4">
            <Link
              to="/campaign"
              className="inline-block px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-center"
            >
              Open Campaigns
            </Link>
          </div>
        </div>

        {/* Leaderboard preview */}
        <div className="relative border-t border-white/10 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-semibold">Top Operatives</h2>
            <Link to="/campaign" className="text-xs underline opacity-80 hover:opacity-100">
              View all
            </Link>
          </div>
          <div className="w-full min-w-0 overflow-x-auto rounded-lg ring-1 ring-white/10">
            <table className="w-full text-sm">
              <tbody>
                {top.map((row, i) => (
                  <tr key={row.id || row.uid} className="odd:bg-white/5">
                    <td className="px-3 py-2 whitespace-nowrap w-10">{i + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.username || "Unknown"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{row.total}</td>
                  </tr>
                ))}
                {top.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-sm opacity-70" colSpan={3}>No entries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Classic Mode card */}
      <section className="rounded-2xl ring-1 ring-white/10 bg-slate-900/70">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Classic Mode</h2>
              <p className="text-sm opacity-80">Pick a difficulty and jump in.</p>
            </div>
            <button
              onClick={startClassic}
              className="hidden sm:inline-flex px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500"
            >
              Start game
            </button>
          </div>

          {/* Preset grid */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(PRESETS).map(([key, val]) => {
              const title = key === "cia" ? "Operative" : key[0].toUpperCase() + key.slice(1);
              const active = selectedPreset === key; // <- always one active
              return (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  aria-pressed={active}
                  className={`p-3 rounded-xl text-left w-full transition ${
                    active
                      ? "ring-2 ring-indigo-400 bg-indigo-600 text-white"
                      : "ring-1 ring-white/10 bg-slate-800/70 hover:bg-slate-700/70"
                  }`}
                >
                  <div className="font-semibold">
                    {title}{" "}
                    <span className="opacity-90 text-xs">
                      ({MULTIPLIER_LABEL[key]})
                    </span>
                    {active && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-center">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="text-xs opacity-80 mt-1">
                    {val.lowQuotaMode
                      ? "Curated SV"
                      : val.includeOceans
                      ? "Includes oceans"
                      : "Land-biased"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Advanced (collapsible) */}
          <div className="mt-4">
            <button
              onClick={() => setShowAdvanced((s) => !s)}
              className="text-sm underline opacity-80 hover:opacity-100"
            >
              {showAdvanced ? "Hide advanced options" : "Show advanced options"}
            </button>

            {showAdvanced && (
              <div className="mt-3 grid md:grid-cols-3 gap-3 rounded-xl bg-slate-900/60 ring-1 ring-white/10 p-3">
                <div>
                  <label className="block mb-1 text-sm opacity-80">Location mode</label>
                  <select
                    value={draft.locationMode}
                    onChange={(e) => updateField("locationMode", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-white/10 outline-none"
                  >
                    <option value="random">Random (world)</option>
                    <option value="country">Specific country</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm opacity-80">Country (if Specific)</label>
                  <input
                    value={draft.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-white/10 outline-none"
                    placeholder="e.g., Canada"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!draft.includeOceans}
                      onChange={(e) => updateField("includeOceans", e.target.checked)}
                    />
                    <span>Include oceans</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Start button */}
          <div className="mt-4 sm:hidden">
            <button
              onClick={startClassic}
              className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500"
            >
              Start game
            </button>
          </div>

          {/* Helper text */}
          <div className="mt-3 text-xs opacity-75">
            Presets tweak the advanced options; difficulty multiplier shown in parentheses.
          </div>
        </div>
      </section>
    </div>
  );
}
