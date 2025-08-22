import React from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { ready as fbReady, db, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "../firebase";
import { useSettings } from "../ctx/SettingsContext.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

const KM_PER_EARTH_RADIAN = 6371;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => Math.floor(ms * (0.8 + Math.random() * 0.4));
const deg2rad = (d) => (d * Math.PI) / 180;
function haversine(lat1, lon1, lat2, lon2) { const dLat = deg2rad(lat2 - lat1); const dLon = deg2rad(lon2 - lon1); const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(Math.abs(dLon)/2)**2; return 2 * KM_PER_EARTH_RADIAN * Math.asin(Math.sqrt(a)); }
function formatKm(km) { if (km < 1) return `${Math.round(km*1000)} m`; if (km < 100) return `${km.toFixed(1)} km`; return `${Math.round(km)} km`; }
function scoreFromDistanceKm(km) { const s = Math.floor(5000 * Math.exp(-km / 2000)); return Math.max(0, Math.min(5000, s)); }

let mapsPromise = null;
function loadGoogleMaps(apiKey) { if (typeof window === "undefined") return Promise.reject(new Error("No window")); if (window.google && window.google.maps) return Promise.resolve(window.google); if (mapsPromise) return mapsPromise; const loader = new Loader({ apiKey, version: "weekly", libraries: ["marker", "geocoding"] }); mapsPromise = loader.load().then(() => window.google); return mapsPromise; }

const LAND_BOXES = [[7,-168,70,-52],[-56,-82,13,-34],[35,-10,71,40],[-35,-18,37,52],[5,60,55,150],[12,26,42,60],[-44,112,-10,154],[-47,166,-34,179]];
function rndBetween(a, b){ return a + Math.random()*(b-a); }
function randomLatLngLandBiased(){ const b = LAND_BOXES[Math.floor(Math.random()*LAND_BOXES.length)]; return { lat: rndBetween(b[0], b[2]), lng: rndBetween(b[1], b[3]) }; }
function randomLatLngWorldwide(){ const lat=(Math.random()*140)-70; const lng=(Math.random()*360)-180; return {lat, lng}; }

function svGetPanorama(google, options){ return new Promise((resolve, reject)=>{ const sv = new google.maps.StreetViewService(); sv.getPanorama(options,(data,status)=>{ if(status===google.maps.StreetViewStatus.OK && data && data.location) resolve(data); else reject(new Error('No pano')); }); }); }
const CURATED=[{lat:48.85837,lng:2.294481,panoId:null},{lat:40.689247,lng:-74.044502,panoId:null},{lat:51.500729,lng:-0.124625,panoId:null},{lat:35.658581,lng:139.745438,panoId:null},{lat:-33.856784,lng:151.215297,panoId:null},{lat:43.642566,lng:-79.387057,panoId:null},{lat:37.8199286,lng:-122.4782551,panoId:null},{lat:41.89021,lng:12.492231,panoId:null},{lat:52.516275,lng:13.377704,panoId:null},{lat:-22.951916,lng:-43.210487,panoId:null}];

async function pickStreetViewLocation(google, settings){
  const { locationMode, country, includeOceans, lowQuotaMode, svAttemptBudget, svBaseBackoffMs, svMaxRadiusM } = settings;
  if (lowQuotaMode){ const seed = CURATED[Math.floor(Math.random()*CURATED.length)]; const pano = await svGetPanorama(google,{location:seed,radius:2000,preference:google.maps.StreetViewPreference.NEAREST,source:google.maps.StreetViewSource.OUTDOOR}); return { lat:pano.location.latLng.lat(), lng:pano.location.latLng.lng(), panoId:pano.location.pano }; }
  let bounds=null;
  if(locationMode==='country' && country){ try{ bounds=await new Promise((res,rej)=>{ const geocoder=new google.maps.Geocoder(); geocoder.geocode({address:country},(results,status)=>{ if(status==='OK'&&results&&results.length) res(results[0].geometry.viewport||results[0].geometry.bounds); else rej(new Error('Geocode failed: '+status)); }); }); }catch{ console.warn('Country geocode failed, falling back'); } }
  const radiusSeq=[20000,60000,120000,svMaxRadiusM]; const budget=Math.max(2,Math.min(20,svAttemptBudget));
  for(let i=0;i<budget;i++){ const candidate = bounds ? (()=>{ const sw=bounds.getSouthWest(); const ne=bounds.getNorthEast(); return {lat:rndBetween(sw.lat(),ne.lat()), lng:rndBetween(sw.lng(),ne.lng())}; })() : (includeOceans? randomLatLngWorldwide(): randomLatLngLandBiased()); try{ const pano=await svGetPanorama(google,{location:candidate,radius:radiusSeq[Math.min(i,radiusSeq.length-1)],preference:google.maps.StreetViewPreference.NEAREST,source:google.maps.StreetViewSource.OUTDOOR}); return { lat:pano.location.latLng.lat(), lng:pano.location.latLng.lng(), panoId:pano.location.pano }; }catch{ await sleep(jitter(svBaseBackoffMs)); } }
  const seed = CURATED[Math.floor(Math.random()*CURATED.length)]; const pano = await svGetPanorama(google,{location:seed,radius:3000,preference:google.maps.StreetViewPreference.NEAREST,source:google.maps.StreetViewSource.OUTDOOR}); return { lat:pano.location.latLng.lat(), lng:pano.location.latLng.lng(), panoId:pano.location.pano };
}

function StreetViewPane({ googleReady, panoLatLng }){
  const ref=React.useRef(null); const panoRef=React.useRef(null);
  React.useEffect(()=>{ if(!googleReady||!ref.current||!panoLatLng) return; const google=window.google; if(!panoRef.current){ panoRef.current = new google.maps.StreetViewPanorama(ref.current,{ position:panoLatLng, pov:{heading:0,pitch:0}, zoom:0, motionTracking:false, motionTrackingControl:false, addressControl:false, showRoadLabels:false, linksControl:true, zoomControl:true, clickToGo:true, fullscreenControl:true }); } else { try{ panoRef.current.setPosition(panoLatLng); }catch{} } },[googleReady,panoLatLng]);
  return <div ref={ref} className="w-full h-full bg-black rounded-2xl" />;
}

function GuessMap({ googleReady, guess, answer, onGuess }){
  const ref=React.useRef(null); const mapRef=React.useRef(null); const gRef=React.useRef(null); const aRef=React.useRef(null); const lineRef=React.useRef(null);
  React.useEffect(()=>{ if(!googleReady||!ref.current||mapRef.current) return; const google=window.google; const map=new google.maps.Map(ref.current,{center:{lat:20,lng:0},zoom:2,streetViewControl:false,mapTypeControl:false,fullscreenControl:false,gestureHandling:'greedy',mapId:MAP_ID}); mapRef.current=map; try{ const hiddenDiv=document.createElement('div'); hiddenDiv.style.width='0px'; hiddenDiv.style.height='0px'; const dummy=new google.maps.StreetViewPanorama(hiddenDiv,{visible:false}); map.setStreetView(dummy);}catch(e){} map.addListener('click',e=>onGuess&&onGuess([e.latLng.lat(),e.latLng.lng()])); },[googleReady,onGuess]);
  React.useEffect(()=>{ const google=window.google, map=mapRef.current; if(!google||!map) return; const hasAdv=!!(google.maps.marker&&google.maps.marker.AdvancedMarkerElement);
    if(guess){ const pos={lat:guess[0],lng:guess[1]}; if(!gRef.current){ if(hasAdv){ const el=document.createElement('div'); Object.assign(el.style,{width:'14px',height:'14px',borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 0 2px rgba(34,197,94,0.35)'}); gRef.current=new google.maps.marker.AdvancedMarkerElement({map,position:pos,content:el,title:'Your guess'});} else { gRef.current=new google.maps.Marker({map,position:pos,title:'Your guess'});} } else { if(hasAdv) gRef.current.position=pos; else gRef.current.setPosition(pos);} } else if(gRef.current){ if(hasAdv) gRef.current.map=null; else gRef.current.setMap(null); gRef.current=null; }
    if(answer){ const pos={lat:answer.lat,lng:answer.lng}; if(!aRef.current){ if(hasAdv){ const el=document.createElement('div'); Object.assign(el.style,{width:'14px',height:'14px',borderRadius:'50%',background:'#3b82f6',boxShadow:'0 0 0 2px rgba(59,130,246,0.35)'}); aRef.current=new google.maps.marker.AdvancedMarkerElement({map,position:pos,content:el,title:'Actual location'});} else { aRef.current=new google.maps.Marker({map,position:pos,title:'Actual location',icon:{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:'#3b82f6',fillOpacity:1,strokeWeight:1}});} } else { if(hasAdv) aRef.current.position=pos; else aRef.current.setPosition(pos);} } else if(aRef.current){ if(hasAdv) aRef.current.map=null; else aRef.current.setMap(null); aRef.current=null; }
    if(answer&&guess){ const path=[{lat:guess[0],lng:guess[1]},{lat:answer.lat,lng:answer.lng}]; if(!lineRef.current){ lineRef.current=new google.maps.Polyline({map,path,geodesic:true}); } else { lineRef.current.setPath(path); lineRef.current.setMap(map); } const b=new google.maps.LatLngBounds(); b.extend(path[0]); b.extend(path[1]); map.fitBounds(b,40);} else if(lineRef.current){ lineRef.current.setMap(null); lineRef.current=null; }
  },[guess,answer]);
  return <div ref={ref} className="w-full h-full bg-slate-900 rounded-2xl" />;
}

export default function Game({ user }){
  const { settings } = useSettings();
  const [round,setRound]=React.useState(1);
  const [maxRounds]=React.useState(5);
  const [totalScore,setTotalScore]=React.useState(0);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState('');
  const [googleReady,setGoogleReady]=React.useState(false);
  const [picking,setPicking]=React.useState(false);
  const [answer,setAnswer]=React.useState(null);
  const [guess,setGuess]=React.useState(null);
  const [reveal,setReveal]=React.useState(false);
  const [lastResult,setLastResult]=React.useState(null);
  const [scores,setScores]=React.useState([]);

  React.useEffect(()=>{ (async()=>{
    try{ if(!API_KEY) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY in .env'); await loadGoogleMaps(API_KEY); setGoogleReady(true); await startNewRoundInternal(); }
    catch(e){ console.error(e); setError(e.message||'Failed to initialize Google Maps'); }
    finally{ setLoading(false); }
  })() },[]);

  React.useEffect(()=>{
    if(!fbReady) return;
    const q = query(collection(db,'scores'), orderBy('score','desc'), limit(50));
    const unsub = onSnapshot(q, snap => setScores(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>unsub && unsub();
  },[]);

  async function startNewRoundInternal(){
    if(picking) return;
    setPicking(true); setLoading(true); setError(''); setGuess(null); setReveal(false); setLastResult(null);
    try{ const google=window.google; const picked=await pickStreetViewLocation(google, settings); setAnswer(picked); }
    catch(e){ console.error(e); setError(e.message||'Failed to pick Street View'); }
    finally{ setLoading(false); setPicking(false); }
  }

  function onSubmitGuess(){
    if(!guess||!answer) return;
    const distanceKm=haversine(guess[0],guess[1],answer.lat,answer.lng);
    const points=scoreFromDistanceKm(distanceKm);
    setTotalScore(s=>s+points);
    setReveal(true);
    setLastResult({distanceKm,points});
  }

  function onNext(){
    if(round>=maxRounds){ setRound(1); setTotalScore(0); }
    else { setRound(r=>r+1); }
    startNewRoundInternal();
  }

  async function saveScore(){
    if(!fbReady) return alert('Firebase not configured. Provide Firebase env values.');
    if(!user) return alert('Sign in to submit your score.');
    try{ await addDoc(collection(db,'scores'),{ username:user.displayName||user.email||'Anonymous', score:Math.round(totalScore), uid:user.uid, createdAt: serverTimestamp() }); alert('Score saved!'); }
    catch(e){ console.error(e); alert('Failed to save score. Check Firestore rules.'); }
  }

  async function saveFavourite(){
    if(!fbReady) return alert('Firebase not configured.');
    if(!user) return alert('Sign in to save favourites.');
    if(!answer) return;
    const label = prompt('Label for this favourite:', `Round ${round} — ${answer.lat.toFixed(3)}, ${answer.lng.toFixed(3)}`) || `Round ${round}`;
    try{ await addDoc(collection(db,'users',user.uid,'favourites'),{ lat:answer.lat, lng:answer.lng, panoId:answer.panoId||null, label, order:Date.now(), createdAt: serverTimestamp() }); alert('Saved to favourites!'); }
    catch(e){ console.error(e); alert('Failed to save favourite.'); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[50vh] lg:h-[70vh] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
          {(!googleReady || loading) && (
            <div className="w-full h-full grid place-items-center bg-slate-900/60">
              <div className="animate-pulse text-center"><div className="text-lg">{!googleReady ? 'Loading Google Maps…' : 'Loading Street View…'}</div></div>
            </div>
          )}
          {error && !loading && (
            <div className="w-full h-full grid place-items-center p-6 text-center bg-slate-900/60">
              <div className="space-y-2"><p className="text-red-300 font-semibold">{error}</p><button onClick={startNewRoundInternal} className="px-4 py-2 bg-slate-700 rounded-xl hover:bg-slate-600" disabled={picking}>Try again</button></div>
            </div>
          )}
          {googleReady && !loading && !error && answer && (<StreetViewPane googleReady={googleReady} panoLatLng={{ lat: answer.lat, lng: answer.lng }} />)}
        </div>
        <div className="lg:col-span-1 h-[50vh] lg:h-[70vh] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 bg-slate-900">
          <GuessMap googleReady={googleReady} guess={guess} answer={reveal ? answer : null} onGuess={setGuess} />
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-sm opacity-80">Imagery: Google Street View. Basemap: Google Maps.</div>
        <div className="flex items-center gap-2">
          {!reveal ? (
            <button disabled={!googleReady || !answer || !guess || picking} onClick={onSubmitGuess} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed">Submit guess</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={onNext} disabled={picking} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed">{round >= maxRounds ? 'Play again' : 'Next round'}</button>
              <button onClick={saveFavourite} disabled={!fbReady || !user} className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed">Save to Favourites</button>
              {round >= maxRounds && (<button onClick={saveScore} disabled={!fbReady || !user} className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:bg-slate-600 disabled:cursor-not-allowed">Save score</button>)}
            </div>
          )}
        </div>
      </div>

      {reveal && lastResult && (
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4 flex flex-wrap items-center gap-4">
          <div className="text-lg font-semibold">Distance: <span className="text-amber-300">{formatKm(lastResult.distanceKm)}</span></div>
          <div className="text-lg font-semibold">Points: <span className="text-emerald-300">{lastResult.points}</span></div>
          <div className="text-sm opacity-80">Actual location: {`${answer.lat.toFixed(4)}, ${answer.lng.toFixed(4)}`}</div>
        </div>
      )}

      <div className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Top Scores</h2>
          <span className="text-xs opacity-70">{fbReady ? "Live" : "Offline (configure Firebase)"}</span>
        </div>
        <div className="overflow-auto max-h-72">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-800/80">
              <tr><th className="px-2 py-1">#</th><th className="px-2 py-1">User</th><th className="px-2 py-1">Score</th></tr>
            </thead>
            <tbody>
              {(scores || []).map((r, i) => (
                <tr key={r.id || i} className="odd:bg-slate-800/50">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">{r.username || "Unknown"}</td>
                  <td className="px-2 py-1 font-semibold">{r.score}</td>
                </tr>
              ))}
              {(!scores || scores.length === 0) && (<tr><td colSpan="3" className="px-2 py-2 opacity-70">No scores yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
