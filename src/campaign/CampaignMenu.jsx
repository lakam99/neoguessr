import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db, collection, addDoc, serverTimestamp, doc, setDoc, updateDoc, deleteDoc } from "../firebase";
import { useToast } from "../ctx/ToastContext.jsx";
import { loadGoogleMaps } from "../lib/maps.js";
import { generateBackwardTrail } from "../lib/campaign.js";
import { RANKS, rankFor, groupByRank } from "../lib/ranks.js";
import RankTimeline from "../components/ui/RankTimeline.jsx";
import RankUpModal from "../components/ui/RankUpModal.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function CampaignMenu() {
  const navigate = useNavigate();
  const toast = useToast();

  // universal, quiet adapter
  const notify = (type, msg) => {
    try {
      if (!toast) return;

      // 1) Object w/ methods: toast.success/info/error/warn
      if (typeof toast[type] === 'function') return toast[type](msg);

      // 2) Function: toast(type, msg) or toast({type,message})
      if (typeof toast === 'function') {
        try { return toast(type, msg); } catch { }
        return toast({ type, message: msg });
      }

      // 3) Common alternates
      if (typeof toast.push === 'function') return toast.push(type, msg);
      if (typeof toast.add === 'function') return toast.add({ type, message: msg });
      if (typeof toast.show === 'function') return toast.show(msg, { type });
      if (typeof toast.notify === 'function') return toast.notify({ type, message: msg });
      if (typeof toast.enqueueSnackbar === 'function') return toast.enqueueSnackbar(msg, { variant: type });
      if (typeof toast.enqueue === 'function') return toast.enqueue(msg, { variant: type });

      // 4) Tuple: [fn, ...]
      if (Array.isArray(toast) && typeof toast[0] === 'function') return toast[0](type, msg);

      // 5) Last-resort: log silently
      console.log(`[${type}]`, msg);
    } catch {
      // swallow
    }
  };

  const [myCases, setMyCases] = React.useState([]);
  const [leader, setLeader] = React.useState([]);
  const [creating, setCreating] = React.useState(false);
  const [difficulty, setDifficulty] = React.useState("standard");
  const [progress, setProgress] = React.useState({ pct: 0, note: "" });

  const [showRankUp, setShowRankUp] = React.useState(false);
  const [rankUpTo, setRankUpTo] = React.useState(null);
  const [ackRankIdx, setAckRankIdx] = React.useState(-1);
  const [ackRankTitle, setAckRankTitle] = React.useState(null);

  const user = auth?.currentUser || null;
  const uid = user?.uid || null;

  // Subscribe to user's campaigns + leaderboard
  

  // Actions
  async function createCampaign() {
    if (!API_KEY) return notify('error', "Missing Google Maps API key.");
    if (!uid) return notify('info', "Sign in to create a campaign.");
    setCreating(true); setProgress({ pct: 0, note: "Starting…" });

    try {
      const google = await loadGoogleMaps(API_KEY);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // Difficulty presets: number of stages (including final target) and reveal radii
      const presets = {
        easy:    { distances: [0, 50, 500, 1500],            radii: [3000, 1000, 600, 200] },
        standard:{ distances: [0, 50, 400, 1200, 2500],      radii: [2000, 1000, 500, 250, 50] },
        hard:    { distances: [0, 30, 200, 800, 2000, 3500], radii: [1000, 500, 300, 200, 100, 2.4] },
      };
      const preset = presets[difficulty] || presets.standard;

      const { target, stages } = await generateBackwardTrail(
        google,
        { distancesKm: preset.distances, throttleMs: 300, radiiForRevealKm: preset.radii },
        (p) => setProgress(p)
      );

      setProgress({ pct: 92, note: "Saving campaign…" });
      const docPayload = {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        uid,
        difficulty,
        score: 0,
        progress: 0,
        target,
        stages,
      };

      const dref = await addDoc(collection(db, "campaigns", uid, "cases"), docPayload);

      setProgress({ pct: 100, note: "Done" });
      await sleep(400);
      setCreating(false);
      navigate(`/campaign/play/${dref.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      notify('error', "Failed to create campaign. Try again.");
    }
  }

  async function renameCampaign(id) {
    const name = prompt("Rename campaign to:");
    if (!name) return;
    try {
      await updateDoc(doc(db, "campaigns", uid, "cases", id), { title: name, updatedAt: serverTimestamp() });
      notify('success', "Renamed.");
    } catch (e) { notify('error', "Rename failed."); }
  }

  async function deleteCampaign(id) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "campaigns", uid, "cases", id));
      notify('success', "Deleted.");
    } catch (e) { notify('error', "Delete failed."); }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header with rank + progress */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/70 ring-1 ring-white/10 p-3 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Campaign Mode</div>
          <div className="text-sm opacity-80">Ranks & leaderboards</div>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:items-end gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-indigo-600/70">{myRank.title}</span>
            <span className="px-3 py-1 rounded-full bg-slate-700/70">Total: {myTotal}</span>
          </div>
          {nextRank && (
            <div className="w-full sm:w-64">
              <div className="text-xs opacity-80 mb-1">
                Progress to {nextRank.title}: {rankProgress.val} / {rankProgress.span} ({rankProgress.pct}%)
              </div>
              <div className="h-2 rounded bg-slate-800 overflow-hidden ring-1 ring-white/10">
                <div className="h-full bg-indigo-600" style={{ width: `${rankProgress.pct}%` }} />
              </div>
          <div className="w-full mt-3">
            <RankTimeline ranks={RANKS} total={myTotal} />
            <div className="text-[11px] opacity-70 mt-1">Hover or tap segments to see each rank’s requirement.</div>
          </div>

            </div>
          )}
        </div>
      </div>

      {/* Body: stacked on mobile; 2+1 columns on lg */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
        {/* LEFT — Your campaigns (2 cols on desktop) */}
        <section className="order-2 lg:order-none lg:col-span-2 min-w-0 space-y-4">
          <div className="rounded-xl ring-1 ring-white/10 bg-slate-900/50 min-w-0">
            {/* Header row: responsive */}
            <div className="p-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm opacity-80">Difficulty:</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  className="px-2 py-1 rounded bg-slate-800 ring-1 ring-white/10 text-sm"
                >
                  <option value="easy">Trainee (Easy)</option>
                  <option value="standard">Operative (Standard)</option>
                  <option value="hard">Insurgent (Hard)</option>
                  <option value="cia">Black Ops (CIA)</option>
                </select>
              </div>

              <div className="font-semibold text-center sm:text-left">Your Campaigns</div>

              <button
                onClick={createCampaign}
                disabled={creating || !uid}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create New Campaign"}
              </button>
            </div>

            {/* Progress bar */}
            {creating && (
              <div className="p-3">
                <div className="h-2 rounded bg-slate-800 overflow-hidden ring-1 ring-white/10">
                  <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress.pct || 0}%` }} />
                </div>
                <div className="mt-2 text-sm opacity-80">{progress.note || "Working…"}</div>
              </div>
            )}

            {/* Campaign list */}
            <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
              {myCases.map(cs => (
                <div key={cs.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{cs.title || "Procedural Case"}</div>
                    <div className="text-xs opacity-80">
                      Progress: Stage {(cs.progress || 0) + 1} / {cs.stages?.length || "?"} · Score: {cs.score || 0}
                    </div>
                  </div>
                  <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                    <Link
                      to={`/campaign/play/${cs.id}`}
                      className="w-full sm:w-auto px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm text-center"
                    >
                      Play
                    </Link>
                    <button
                      onClick={() => renameCampaign(cs.id)}
                      className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => deleteCampaign(cs.id)}
                      className="w-full sm:w-auto px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {myCases.length === 0 && (
                <div className="p-3 text-sm opacity-80">No campaigns yet. Create a new one to begin your ascent through the ranks.</div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — Leaderboards by rank */}
        <aside className="order-1 lg:order-none min-w-0 space-y-4">
          <div className="rounded-xl ring-1 ring-white/10 bg-slate-900/50">
            <div className="p-3 border-b border-white/10 font-semibold">Campaign Leaderboards</div>
            <div className="p-3 space-y-3 max-h-[60vh] overflow-auto">
              {Object.entries(buckets).map(([rank, rows]) => (
                <div key={rank} className="min-w-0">
                  <div className="text-sm mb-1 opacity-80">{rank}</div>
                  <div className="w-full min-w-0 overflow-x-auto rounded-lg ring-1 ring-white/10">
                    <table className="w-full text-sm">
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.uid || r.id} className="odd:bg-white/5">
                            <td className="px-3 py-2 whitespace-nowrap w-10">{i + 1}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.username || 'Unknown'}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {leader.length === 0 && <div className="text-sm opacity-70">No entries yet.</div>}
            </div>
          </div>
        </aside>
      </div>
    
      {showRankUp && (
        <RankUpModal
          toTitle={rankUpTo}
          onClose={async () => {
          try {
            const idx = RANKS.findIndex(r => r.title === rankUpTo);
            if (uid) {
              const mref = doc(db, "campaigns", uid, "cases", "__meta__");
              await setDoc(mref, { lastAckRankIndex: idx, lastAckRankTitle: rankUpTo, updatedAt: serverTimestamp() }, { merge: true });
              setAckRankIdx(idx);
              setAckRankTitle(rankUpTo);
            }
          } catch {}
          setShowRankUp(false);
        }}
        />
      )}
</div>
  );
}
