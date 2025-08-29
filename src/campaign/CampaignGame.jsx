import React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ready as fbReady, auth, db, doc, updateDoc } from "../firebase";
import { getDoc } from "firebase/firestore";
import { loadGoogleMaps } from "../lib/maps.js";
import StreetViewStatic from "../components/StreetViewStatic.jsx";
import GuessMap from "../components/GuessMap.jsx";
import { distanceKm } from "../lib/campaign.js";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function CampaignGame(){
  const navigate = useNavigate();
  const { caseId } = useParams();

  const [loading, setLoading] = React.useState(true);
  const [campaign, setCampaign] = React.useState(null);
  const [stageIndex, setStageIndex] = React.useState(0);
  const [guess, setGuess] = React.useState(null); // [lat,lng]
  const [reveal, setReveal] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);
  const [totalScore, setTotalScore] = React.useState(0);
  const [googleReady, setGoogleReady] = React.useState(false);

  const uid = auth?.currentUser?.uid || null;

  React.useEffect(()=>{
    let mounted = true;
    (async ()=>{
      if(API_KEY){
        await loadGoogleMaps(API_KEY);
        if(mounted) setGoogleReady(true);
      }
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
        setLoading(false);
      } catch (e){
        setLoading(false);
      }
    }
    init();
    return ()=>{ cancelled = true; };
  }, [uid, caseId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!campaign) return <div className="p-6">No campaign found. Create one in <Link to="/campaign" className="underline">Campaign Menu</Link>.</div>;

  const stage = campaign.stages[stageIndex];
  const maxStages = campaign.stages.length;

  function onGuessCommit(){
    if(!guess) return;
    const answer = { lat: stage.lat, lng: stage.lng };
    const guessPt = { lat: guess[0], lng: guess[1] };
    const dist = distanceKm(guessPt, answer);
    const thresholds = stage.thresholdKm || [1000,500];
    const bonus = dist <= thresholds[1] ? 1.2 : 1.0;
    const base = 1000; // keep aligned with your scoring or replace with shared func
    const points = Math.round(base * bonus);
    setLastResult({ distanceKm: dist, base, mult: bonus, points });
    setReveal(true);
  }

  function onNext(){
    setReveal(false);
    setGuess(null);
    setLastResult(null);
    setStageIndex(Math.min(stageIndex+1, maxStages-1));
  }

  return (
    <div className="flex flex-col gap-4 pb-28 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 ring-1 ring-white/10 p-3 text-sm lg:text-base">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-slate-700/70 text-center">Stage {stageIndex+1} / {maxStages}</span>
          <span className="px-3 py-1 rounded-full bg-slate-700/70 text-center">Total: {Math.round(totalScore)} pts</span>
          {reveal && lastResult && (
            <span className="px-3 py-1 rounded-full bg-slate-700/70 text-center">
              This stage: {Math.round(lastResult.points)} pts · {Math.round(lastResult.distanceKm)} km
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!reveal ? (
            <button disabled={!googleReady || !stage || !guess} onClick={onGuessCommit} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed">Submit</button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={()=> setReveal(false)} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600">Adjust</button>
              <button onClick={onNext} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white">Next</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-slate-900/30">
          <div className="p-2 text-sm opacity-80">{stage.text || "Investigate the photo and make your best guess."}</div>
          <div className="aspect-video">
            <StreetViewStatic lat={stage.lat} lng={stage.lng} panoId={stage.panoId} className="w-full h-full" />
          </div>
        </div>
        <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-slate-900/30">
          <div className="h-[34vh] lg:h-[70vh]">
            <GuessMap
              googleReady={googleReady}
              guess={guess}
              answer={reveal ? { lat: stage.lat, lng: stage.lng } : null}
              onGuess={(arr)=> setGuess(arr)}
              interactive={true}
            />
          </div>
          <div className="p-2 flex items-center justify-between">
            <span className="text-sm opacity-80">
{ Array.isArray(guess) ? `Your guess: ${guess[0].toFixed(3)}, ${guess[1].toFixed(3)}` : "Click the map to place your guess." }
            </span>
            {!reveal ? (
              <button disabled={!googleReady || !stage || !guess} onClick={onGuessCommit} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed">Submit</button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={()=> setReveal(false)} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600">Adjust</button>
                <button onClick={onNext} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white">Next</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
