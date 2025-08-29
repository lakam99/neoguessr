import React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ready as fbReady, auth, db, doc, collection, addDoc, serverTimestamp, updateDoc } from "../firebase";
import { getDoc } from "firebase/firestore";
import { loadGoogleMaps } from "../lib/maps.js";
import { distanceKm } from "../lib/campaign.js";

import HeaderBar from "../components/play/HeaderBar.jsx";
import StreetViewPanel from "../components/play/StreetViewPanel.jsx";
import MapPanel from "../components/play/MapPanel.jsx";
import StickyActionBar from "../components/play/StickyActionBar.jsx";
import PlayScreen from "../components/play/PlayScreen.jsx";
import MobileToggle from "../components/play/MobileToggle.jsx";
import DesktopActionRow from "../components/play/DesktopActionRow.jsx";
import PanoPanel from "../components/play/PanoPanel.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function getRevealRadiusKm(stageIndex, stage){
  if (stage && typeof stage.revealRadiusKm === 'number') return stage.revealRadiusKm;
  const ladder = [1000, 500, 250, 100, 25, 10, 5];
  return ladder[Math.min(stageIndex, ladder.length - 1)];
}

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
  const [mobileMode, setMobileMode] = React.useState('pano');
  const [picking, setPicking] = React.useState(false);

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
  const answer = stage ? { lat: stage.lat, lng: stage.lng, panoId: stage.panoId || null, pov: stage.pov || null } : null;
  const freezePano = true;

  function onSubmit(){
    if(!guess || !stage) return;
    const guessPt = { lat: guess[0], lng: guess[1] };
    const dist = distanceKm(guessPt, answer);
    const thresholds = stage.thresholdKm || [1000,500];
    const bonus = dist <= thresholds[1] ? 1.2 : 1.0;
    const base = 1000;
    const points = Math.round(base * bonus);
    setLastResult({ distanceKm: dist, base, mult: bonus, points });
    setReveal(true);
  }

  async function onNext(){
    setReveal(false);
    setGuess(null);
    setLastResult(null);
    setStageIndex(Math.min(stageIndex+1, maxStages-1));
  }

  async function saveFavourite(){
    const user = auth?.currentUser || null;
    if(!user || !stage) return;
    const label = `Favourite — Stage ${stageIndex+1} (${stage.lat.toFixed(3)}, ${stage.lng.toFixed(3)})`;
    try{
      await addDoc(collection(db,'users',user.uid,'favourites'),{
        lat:stage.lat, lng:stage.lng, panoId:stage.panoId||null, label, order:Date.now(),
        guessLat: Array.isArray(guess) ? guess[0] : null, guessLng: Array.isArray(guess) ? guess[1] : null,
        distanceKm: lastResult ? Number(lastResult.distanceKm.toFixed(3)) : null,
        points: lastResult ? Math.round(lastResult.points) : null,
        createdAt: serverTimestamp()
      });
    }catch(e){ console.error(e); }
  }

  return (
    
      <PlayScreen
        label="Stage"
        index={stageIndex+1}
        max={maxStages}
        totalScore={totalScore}
        reveal={reveal}
        lastResult={lastResult}
        googleReady={googleReady}
        loading={loading}
        error={null}
        freezePano={true}
        answer={answer}
        text={stage?.text || "Investigate the photo and make your best guess."}
        guess={guess}
        onGuess={(arr)=> setGuess(arr)}
        picking={picking}
        onSubmit={onSubmit}
        onNext={onNext}
        onSaveFavourite={saveFavourite}
        showSaveScore={false}
        nextLabel={stageIndex >= maxStages-1 ? 'Finish campaign' : 'Next stage'}
        mobileMode={mobileMode}
        setMobileMode={setMobileMode}
        mapRevealMode="circle"
        mapRevealCircleKm={getRevealRadiusKm(stageIndex, stage)}
      />
);
}
