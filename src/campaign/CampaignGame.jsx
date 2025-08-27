import React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ready as fbReady, auth, db, collection, addDoc, serverTimestamp, doc, setDoc, updateDoc, increment } from "../firebase";
import { getDoc } from 'firebase/firestore';
import { useToast } from "../ctx/ToastContext.jsx";
import { useSettings } from "../ctx/SettingsContext.jsx";
import StreetViewStatic from "../components/StreetViewStatic.jsx";
import GuessMap from "../components/GuessMap.jsx";
import { loadGoogleMaps } from "../lib/maps.js";
import { generateCampaignFromTarget, distanceKm } from "../lib/campaign.js";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const KM_PER_EARTH_RADIAN = 6371;
const deg2rad = (d) => (d * Math.PI) / 180;
function haversine(lat1, lon1, lat2, lon2) { const dLat = deg2rad(lat2 - lat1); const dLon = deg2rad(lon2 - lon1); const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLon/2)**2; return 2 * KM_PER_EARTH_RADIAN * Math.asin(Math.sqrt(a)); }
function formatKm(km) { if (km < 1) return `${Math.round(km*1000)} m`; if (km < 10) return `${km.toFixed(2)} km`; if (km < 100) return `${km.toFixed(1)} km`; return `${Math.round(km)} km`; }
function baseScoreFromDistanceKm(km){ if(km<=0.1) return 5000; if(km<=1) return 4800; if(km<=10) return 4500 - (km-1)*300; if(km<=100) return 4000 - (km-10)*20; if(km<=1000) return 2000 - (km-100)*2; return Math.max(0, 1000 - (km-1000)*0.5); }

export default function CampaignGame(){
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { settings } = useSettings();
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [campaign, setCampaign] = React.useState(null);
  const [stageIndex, setStageIndex] = React.useState(0);
  const [guess, setGuess] = React.useState(null);
  const [reveal, setReveal] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);
  const [totalScore, setTotalScore] = React.useState(0);
  const [freezePano] = React.useState(true); // campaign uses stills like CIA
  const [googleReady, setGoogleReady] = React.useState(false);

  const uid = auth && auth.currentUser ? auth.currentUser.uid : null;

  
  
  React.useEffect(()=>{
    let mounted = true;
    (async () => {
      try{
        if(API_KEY){
          await loadGoogleMaps(API_KEY);
          if(mounted) setGoogleReady(true);
        }
      }catch(e){ /* ignore for now */ }
    })();
    return ()=>{ mounted = false; };
  }, []);

React.useEffect(()=>{
    let cancelled = false;
    async function init(){
      try {
        if(!API_KEY){ setLoading(false); return; }
        if (uid && caseId){
          const dref = doc(db, 'campaigns', uid, 'cases', caseId);
          const snap = await getDoc(dref);
          if(snap.exists()){
            const data = snap.data();
            if(!cancelled){
              setCampaign({ ...data, id: dref.id });
              setStageIndex(data.progress || 0);
              setTotalScore(data.score || 0);
              setLoading(false);
            }
            return;
          }
        }
        // No existing case found -> go to menu
        setLoading(false);
      } catch (e){
        console.error(e);
        toast.error("Failed to load campaign.");
        setLoading(false);
      }
    }
    init();
    return ()=>{ cancelled = true; };
  }, [uid, caseId]);


  if (loading) return <div className="p-6">Preparing case... | Initializing case...</div>;
  if (!campaign) return <div className="p-6">No campaign found. Create one in <Link to="/campaign" className="underline">Campaign Menu</Link>.</div>;

  const stage = campaign.stages[stageIndex];
  const maxStages = campaign.stages.length;

  async function commitProgress(newProgress, deltaScore){
    const newTotal = totalScore + (deltaScore||0);
    setTotalScore(newTotal);
    setStageIndex(newProgress);
    if(uid){
      try{
        const dref = doc(db, 'campaigns', uid, 'cases', campaign.id);
        await updateDoc(dref, { progress: newProgress, score: newTotal, updatedAt: serverTimestamp() });
      }catch(e){ console.warn("Progress update failed", e); }
    }
  }

  function onGuessCommit(){
    if(!guess){ toast.info("Place a guess on the map first."); return; }
    const answer = { lat: stage.lat, lng: stage.lng }; const guessPt = guess ? { lat: guess[0], lng: guess[1] } : null;
    const dist = guessPt ? distanceKm(guessPt, answer) : Infinity;
    const thresholds = stage.thresholdKm || [1000,500];
    const passed = dist <= thresholds[0];
    const bonus = dist <= thresholds[1] ? 1.2 : 1.0;
    const base = baseScoreFromDistanceKm(dist);
    const points = Math.round(base * bonus);
    setLastResult({ distanceKm: dist, base, mult: bonus, points });
    setReveal(true);
  }

  async function onNext(){
    const dist = lastResult?.distanceKm ?? Infinity;
    const thresholds = stage.thresholdKm || [1000,500];
    const passed = dist <= thresholds[0];
    if(!passed){
      setReveal(false);
      return; // retry same stage
    }
    // Advance
    const nextIndex = Math.min(stageIndex + 1, maxStages - 1);
    await commitProgress(nextIndex, lastResult?.points || 0);

    setGuess(null);
    setLastResult(null);
    setReveal(false);

    // If finished
    if(nextIndex === maxStages - 1 && (lastResult?.distanceKm ?? Infinity) <= (campaign.stages[nextIndex].thresholdKm?.[0] ?? 5)){
      // Completion: write leaderboards if signed in
      if(uid && fbReady){
        try{
          const username = auth.currentUser?.displayName || "Agent";
          await addDoc(collection(db, 'leaderboards', 'campaign', 'scores'), { 
            username, uid, caseId: campaign.id || "local", score: totalScore + (lastResult?.points||0), createdAt: serverTimestamp() 
          });
          // totals
          const totalsRef = doc(db, 'leaderboards', 'campaign', 'totals', uid);
          await setDoc(totalsRef, { username, uid, total: 0, updatedAt: serverTimestamp() }, { merge: false }).catch(()=>{});
          await updateDoc(totalsRef, { username, uid, total: increment(lastResult?.points||0), updatedAt: serverTimestamp() }).catch(async ()=>{
            // if update fails (no doc), set it
            await setDoc(totalsRef, { username, uid, total: (totalScore + (lastResult?.points||0)), updatedAt: serverTimestamp() });
          });
        }catch(e){ console.warn("Leaderboard write failed", e); }
      }
      toast.success("Case closed!");
    }
  }

  function onGiveUp(){
    navigate("/");
  }

  return (
    <div className="flex flex-col gap-4 pb-28 lg:pb-0" style={{ paddingBottom: "calc(84px + env(safe-area-inset-bottom))" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 ring-1 ring-white/10 p-3 text-sm lg:text-base">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-slate-700/70 text-center">Stage {stageIndex+1} / {maxStages}</span>
          <span className="px-3 py-1 rounded-full bg-slate-700/70 text-center">Total: {Math.round(totalScore)} pts</span>
          {reveal && lastResult && (
            <span className="px-3 py-1 rounded-full bg-slate-700/70 text-center">
              This stage: {Math.round(lastResult.points)} pts
              <span className="opacity-70"> (base {Math.round(lastResult.base)} × {lastResult.mult.toFixed(1)})</span>
               · {formatKm(lastResult.distanceKm)}
            </span>
          )}
        </div>
        <div className="text-xs opacity-70">Campaign Mode · Still photos only</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-slate-900/30" style={{ minHeight: 320 }}>
          <div className="p-2 text-sm opacity-80">{stage.text || "Investigate the photo and make your best guess."}</div>
          <div className="aspect-video">
            <StreetViewStatic lat={stage.lat} lng={stage.lng} panoId={stage.panoId} className="w-full h-full" />
          </div>
        </div>
        <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-slate-900/30" style={{ minHeight: 320 }}>
                    <GuessMap googleReady={googleReady} guess={guess} answer={reveal ? { lat: stage.lat, lng: stage.lng } : null} onGuess={(arr)=> setGuess(arr)} interactive={true} />
          <div className="p-2 flex items-center justify-between">
            <span className="text-sm opacity-80">{ Array.isArray(guess) ? `Your guess: ${guess[0].toFixed(3)}, ${guess[1].toFixed(3)}` : "Tap the map to place your guess." }</span>
            {!reveal ? (
              <button disabled={!googleReady || !stage || !guess} onClick={onGuessCommit} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white">Make Guess</button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={()=>{ setReveal(false); }} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600">Adjust Guess</button>
                <button onClick={onNext} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white">Next Clue</button>
              </div>
            )}
          </div>
        </div>
      </div>

      
      {/* Sticky action bar on mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pt-8 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm px-3 py-2 rounded-xl bg-slate-800/80">Stage {stageIndex+1}/{maxStages}</div>
          {!reveal ? (
            <button
              disabled={!googleReady || !stage || !guess}
              onClick={onGuessCommit}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          ) : (
            <div className="flex-1 flex gap-2">
              <button
                onClick={()=>{ setReveal(false); }}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white"
              >
                Adjust
              </button>
              <button
                onClick={onNext}
                className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

<div className="fixed lg:static bottom-0 left-0 right-0 z-40 lg:z-10 bg-slate-900/70 ring-1 ring-white/10">
        <div className="max-w-6xl mx-auto p-3 flex items-center justify-between gap-2">
          <div className="text-xs opacity-70">
            {(!fbReady || !uid) ? "Sign in to save progress + leaderboards." : "Progress auto-saves."}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onGiveUp} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600">Exit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
