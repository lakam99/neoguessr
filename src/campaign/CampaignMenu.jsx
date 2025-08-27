import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ready as fbReady, auth, db, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, setDoc } from "../firebase";
import { getDoc } from "firebase/firestore";
import { useToast } from "../ctx/ToastContext.jsx";
import { loadGoogleMaps } from "../lib/maps.js";
import { generateCampaignFromTarget } from "../lib/campaign.js";
import { RANKS, rankFor, groupByRank } from "../lib/ranks.js";
import StreetViewStatic from "../components/StreetViewStatic.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function CampaignMenu(){
  const navigate = useNavigate();
  const toast = useToast();
  const [myCases, setMyCases] = React.useState([]);
  const [leader, setLeader] = React.useState([]);
  const [creating, setCreating] = React.useState(false);
  const [progress, setProgress] = React.useState({ pct: 0, note: "" });
  const [error, setError] = React.useState("");

  const user = auth?.currentUser || null;
  const uid = user?.uid || null;

  React.useEffect(()=>{
    if(!fbReady || !uid) return;
    const qCases = query(collection(db, 'campaigns', uid, 'cases'), orderBy('updatedAt','desc'));
    const unsub1 = onSnapshot(qCases, snap => {
      setMyCases(snap.docs.map(d=>({ id: d.id, ...d.data() })));
    });
    const qLead = query(collection(db, 'leaderboards', 'campaign', 'totals'), orderBy('total','desc'));
    const unsub2 = onSnapshot(qLead, snap => {
      setLeader(snap.docs.map(d=>({ id: d.id, ...d.data() })));
    });
    return ()=>{ unsub1 && unsub1(); unsub2 && unsub2(); };
  }, [fbReady, uid]);

  const myTotal = React.useMemo(()=>{
    const entry = leader.find(l => l.uid === uid);
    return entry?.total || 0;
  }, [leader, uid]);

  const myRank = rankFor(myTotal);

  async function createCampaign(){
    if (!API_KEY){ toast.error("Missing Google Maps API key."); return; }
    if (!uid){ toast.info("Sign in to create a campaign."); return; }
    setCreating(true); setError(""); setProgress({ pct: 0, note: "Starting…" });
    try{
      const google = await loadGoogleMaps(API_KEY);
      // Pick a target pano first with gentle polling
      const LAND_BOXES = [[7,-168,70,-52],[-56,-82,13,-34],[35,-10,71,40],[-35,-75,-10,-34],[12,-17,37,57],[-34,17,6,51],[-35,50,-12,84],[24,60,55,150],[12,26,42,60],[-44,112,-10,154],[-47,166,-34,179]];
      const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
      async function svGet(options){
        return new Promise((resolve,reject)=>{
          const sv = new google.maps.StreetViewService();
          sv.getPanorama(options,(data,status)=>{
            if(status===google.maps.StreetViewStatus.OK && data && data.location) resolve(data);
            else reject(new Error('No pano'));
          });
        });
      }
      async function pickTarget(){
        for(let attempts=0; attempts<20; attempts++){
          const b = LAND_BOXES[Math.floor(Math.random()*LAND_BOXES.length)];
          const seed = { lat: (Math.random()*(b[2]-b[0]))+b[0], lng: (Math.random()*(b[3]-b[1]))+b[1] };
          try{
            const p = await svGet({ location: seed, radius: 5000, preference: google.maps.StreetViewPreference.NEAREST, source: google.maps.StreetViewSource.OUTDOOR });
            return { lat: p.location.latLng.lat(), lng: p.location.latLng.lng(), panoId: p.location.pano };
          }catch(e){ await sleep(Number(import.meta.env.VITE_SV_THROTTLE_MS||900)); }
        }
        return { lat: 0, lng: 0, panoId: null };
      }

      setProgress({ pct: 5, note: "Selecting target…" });
      const target = await pickTarget();

      setProgress({ pct: 10, note: "Building rings…" });
      const generated = await generateCampaignFromTarget(API_KEY, { lat: target.lat, lng: target.lng }, {
        attemptsPerRing: 4,
        svMaxRadiusM: 20000,
        throttleMs: Number(import.meta.env.VITE_SV_THROTTLE_MS||900),
        onProgress: (p)=> setProgress(p)
      });

      const dref = doc(collection(db, 'campaigns', uid, 'cases'));
      const payload = {
        title: "Procedural Case",
        description: "A dynamically generated hunt that narrows in stages.",
        target: generated.target,
        stages: generated.stages,
        progress: 0,
        score: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(dref, payload);
      setProgress({ pct: 100, note: "Done!" });
      toast.success("Campaign created.");
      navigate(`/campaign/play/${dref.id}`);
    }catch(e){
      console.error(e);
      setError("Failed to create campaign. Try again later.");
      toast.error("Campaign creation failed.");
    }finally{
      setTimeout(()=> setCreating(false), 400);
    }
  }

  const buckets = React.useMemo(()=> groupByRank(leader), [leader]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 bg-slate-900/70 ring-1 ring-white/10 p-3 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Campaign Mode</div>
          <div className="text-sm opacity-80">Ranks & leaderboards</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-indigo-600/70">{myRank.title}</span>
          <span className="px-3 py-1 rounded-full bg-slate-700/70">Total: {myTotal}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl ring-1 ring-white/10 bg-slate-900/50">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="font-semibold">Your Campaigns</div>
              <button onClick={createCampaign} disabled={creating || !uid} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                {creating ? "Creating…" : "Create New Campaign"}
              </button>
            </div>
            {creating && (
              <div className="p-3">
                <div className="h-2 rounded bg-slate-800 overflow-hidden ring-1 ring-white/10">
                  <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress.pct||0}%` }} />
                </div>
                <div className="mt-2 text-sm opacity-80">{progress.note||"Working…"}</div>
              </div>
            )}
            <div className="divide-y divide-white/5">
              {myCases.map(cs => (
                <div key={cs.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{cs.title||"Procedural Case"}</div>
                    <div className="text-xs opacity-80">Progress: Stage { (cs.progress||0)+1 } / { cs.stages?.length||"?" } · Score: {cs.score||0}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/campaign/play/${cs.id}`} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white">Play</Link>
                  </div>
                </div>
              ))}
              {myCases.length === 0 && (
                <div className="p-3 text-sm opacity-80">No campaigns yet. Create a new one to begin your ascent through the ranks.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl ring-1 ring-white/10 bg-slate-900/50">
            <div className="p-3 border-b border-white/10 font-semibold">Campaign Leaderboards</div>
            <div className="p-3 space-y-3 max-h-[60vh] overflow-auto">
              {Object.entries(buckets).map(([rank, rows]) => (
                <div key={rank}>
                  <div className="text-sm mb-1 opacity-80">{rank}</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.uid || r.id} className="odd:bg-white/5">
                          <td className="px-2 py-1 w-8">{i+1}</td>
                          <td className="px-2 py-1">{r.username||'Unknown'}</td>
                          <td className="px-2 py-1 text-right">{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {leader.length===0 && <div className="text-sm opacity-70">No entries yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
