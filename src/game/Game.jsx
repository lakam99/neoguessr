import React from "react";
import { db, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, doc, setDoc, increment } from "../firebase";
import { useSettings } from "../ctx/SettingsContext.jsx";
import { useToast } from "../ctx/ToastContext.jsx";
import { loadGoogleMaps } from "../lib/maps.js";
import StreetViewStatic from "../components/StreetViewStatic.jsx";
import GuessMap from "../components/GuessMap.jsx";
import HeaderBar from "../components/play/HeaderBar.jsx";
import StreetViewPanel from "../components/play/StreetViewPanel.jsx";
import MapPanel from "../components/play/MapPanel.jsx";
import StickyActionBar from "../components/play/StickyActionBar.jsx";
import PlayScreen from "../components/play/PlayScreen.jsx";
import InteractiveStreetView from "../components/play/InteractiveStreetView.jsx";
import MobileToggle from "../components/play/MobileToggle.jsx";
import DesktopActionRow from "../components/play/DesktopActionRow.jsx";
import PanoPanel from "../components/play/PanoPanel.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const KM_PER_EARTH_RADIAN = 6371;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => Math.floor(ms * (0.8 + Math.random() * 0.4));
const deg2rad = (d) => (d * Math.PI) / 180;
function haversine(lat1, lon1, lat2, lon2) { const dLat = deg2rad(lat2 - lat1); const dLon = deg2rad(lon2 - lon1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(Math.abs(dLon) / 2) ** 2; return 2 * KM_PER_EARTH_RADIAN * Math.asin(Math.sqrt(a)); }
function formatKm(km) { if (km < 1) return `${Math.round(km * 1000)} m`; if (km < 100) return `${km.toFixed(1)} km`; return `${Math.round(km)} km`; }
function baseScoreFromDistanceKm(km) { const s = Math.floor(5000 * Math.exp(-km / 2000)); return Math.max(0, Math.min(5000, s)); }

function difficultyMultiplier(preset) {
  switch ((preset || '').toLowerCase()) {
    case 'tutorial': return 0.5;
    case 'hard': return 1.2;
    case 'cia': return 1.6;
    case 'moderate': return 1.0;
    default: return 1.0;
  }
}

const LAND_BOXES = [[7, -168, 70, -52], [-56, -82, 13, -34], [35, -10, 71, 40], [-35, -18, 37, 52], [5, 60, 55, 150], [12, 26, 42, 60], [-44, 112, -10, 154], [-47, 166, -34, 179]];
function rndBetween(a, b) { return a + Math.random() * (b - a); }
function randomLatLngLandBiased() { const b = LAND_BOXES[Math.floor(Math.random() * LAND_BOXES.length)]; return { lat: rndBetween(b[0], b[2]), lng: rndBetween(b[1], b[3]) }; }
function randomLatLngWorldwide() { const lat = (Math.random() * 140) - 70; const lng = (Math.random() * 360) - 180; return { lat, lng }; }

function svGetPanorama(google, options) { return new Promise((resolve, reject) => { const sv = new google.maps.StreetViewService(); sv.getPanorama(options, (data, status) => { if (status === google.maps.StreetViewStatus.OK && data && data.location) resolve(data); else reject(new Error('No pano')); }); }); }
const CURATED = [{ lat: 48.85837, lng: 2.294481, panoId: null }, { lat: 40.689247, lng: -74.044502, panoId: null }, { lat: 51.500729, lng: -0.124625, panoId: null }, { lat: 35.658581, lng: 139.745438, panoId: null }, { lat: -33.856784, lng: 151.215297, panoId: null }, { lat: 43.642566, lng: -79.387057, panoId: null }, { lat: 37.8199286, lng: -122.4782551, panoId: null }, { lat: 41.89021, lng: 12.492231, panoId: null }, { lat: 52.516275, lng: 13.377704, panoId: null }, { lat: -22.951916, lng: -43.210487, panoId: null }];

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

async function pickStreetViewLocation(google, settings, curatedQueue) {
  const { locationMode, country, includeOceans, lowQuotaMode, svAttemptBudget, svMaxRadiusM } = settings;
  const svBaseBackoffMs = 2000; // fixed
  if (lowQuotaMode) {
    if (curatedQueue.current.length === 0) curatedQueue.current = shuffle(CURATED);
    const seed = curatedQueue.current.shift();
    const pano = await svGetPanorama(google, { location: seed, radius: 2000, preference: google.maps.StreetViewPreference.NEAREST, source: google.maps.StreetViewSource.OUTDOOR });
    return { lat: pano.location.latLng.lat(), lng: pano.location.latLng.lng(), panoId: pano.location.pano };
  }
  let bounds = null;
  if (locationMode === 'country' && country) { try { bounds = await new Promise((res, rej) => { const geocoder = new google.maps.Geocoder(); geocoder.geocode({ address: country }, (results, status) => { if (status === 'OK' && results && results.length) res(results[0].geometry.viewport || results[0].geometry.bounds); else rej(new Error('Geocode failed: ' + status)); }); }); } catch { console.warn('Country geocode failed, falling back'); } }
  const radiusSeq = [20000, 60000, 120000, svMaxRadiusM]; const budget = Math.max(2, Math.min(20, svAttemptBudget));
  for (let i = 0; i < budget; i++) { const candidate = bounds ? (() => { const sw = bounds.getSouthWest(); const ne = bounds.getNorthEast(); return { lat: rndBetween(sw.lat(), ne.lat()), lng: rndBetween(sw.lng(), ne.lng()) }; })() : (includeOceans ? randomLatLngWorldwide() : randomLatLngLandBiased()); try { const pano = await svGetPanorama(google, { location: candidate, radius: radiusSeq[Math.min(i, radiusSeq.length - 1)], preference: google.maps.StreetViewPreference.NEAREST, source: google.maps.StreetViewSource.OUTDOOR }); return { lat: pano.location.latLng.lat(), lng: pano.location.latLng.lng(), panoId: pano.location.pano }; } catch { await sleep(jitter(svBaseBackoffMs)); } }
  const seed = CURATED[Math.floor(Math.random() * CURATED.length)]; const pano = await svGetPanorama(google, { location: seed, radius: 3000, preference: google.maps.StreetViewPreference.NEAREST, source: google.maps.StreetViewSource.OUTDOOR }); return { lat: pano.location.latLng.lat(), lng: pano.location.latLng.lng(), panoId: pano.location.pano };
}

export default function Game({ user }) {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [round, setRound] = React.useState(1);
  const [maxRounds] = React.useState(5);
  const [totalScore, setTotalScore] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [googleReady, setGoogleReady] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [answer, setAnswer] = React.useState(null);
  const [guess, setGuess] = React.useState(null);
  const [reveal, setReveal] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);
  const [scores, setScores] = React.useState([]);
  const [mobileMode, setMobileMode] = React.useState('pano'); // 'pano' | 'map'

  const usedPanosRef = React.useRef(new Set());
  const curatedQueue = React.useRef([]);

  React.useEffect(() => {
    (async () => {
      try { if (!API_KEY) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY in .env'); await loadGoogleMaps(API_KEY); setGoogleReady(true); await startNewRoundInternal(); }
      catch (e) { console.error(e); setError(e.message || 'Failed to initialize Google Maps'); }
      finally { setLoading(false); }
    })()
  }, []);

  React.useEffect(() => {
    if (!fbReady) return;
    const mode = (settings.preset || 'custom').toLowerCase();
    const qref = query(collection(db, 'leaderboards', mode, 'scores'), orderBy('score', 'desc'), limit(50));
    const unsub = onSnapshot(qref, snap => setScores(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub && unsub();
  }, [settings.preset]);

  async function pickUnique(maxTries = 8) {
    const google = window.google;
    for (let i = 0; i < maxTries; i++) {
      const picked = await pickStreetViewLocation(google, settings, curatedQueue);
      const key = picked.panoId || `${picked.lat.toFixed(4)},${picked.lng.toFixed(4)}`;
      if (!usedPanosRef.current.has(key)) {
        usedPanosRef.current.add(key);
        picked.pov = { heading: Math.floor(Math.random() * 360), pitch: 10 + Math.floor(Math.random() * 25) };
        return picked;
      }
    }
    const fallback = await pickStreetViewLocation(window.google, settings, curatedQueue);
    usedPanosRef.current.add(fallback.panoId || `${fallback.lat.toFixed(4)},${fallback.lng.toFixed(4)}`);
    fallback.pov = { heading: Math.floor(Math.random() * 360), pitch: 10 + Math.floor(Math.random() * 25) };
    return fallback;
  }

  async function startNewRoundInternal() {
    if (picking) return;
    setMobileMode('pano');
    setPicking(true); setLoading(true); setError(''); setGuess(null); setReveal(false); setLastResult(null);
    try { const picked = await pickUnique(); setAnswer(picked); }
    catch (e) { console.error(e); setError(e.message || 'Failed to pick Street View'); }
    finally { setLoading(false); setPicking(false); }
  }

  function onSubmitGuess() {
    if (!guess || !answer) return;
    const distanceKm = haversine(guess[0], guess[1], answer.lat, answer.lng);
    const base = baseScoreFromDistanceKm(distanceKm);
    const mult = difficultyMultiplier(settings.preset);
    const points = Math.round(base * mult);
    setTotalScore(s => s + points);
    setReveal(true);
    setLastResult({ distanceKm, points, base, mult });
  }

  function onNext() {
    setMobileMode('pano');
    if (round >= maxRounds) { setRound(1); setTotalScore(0); usedPanosRef.current.clear(); }
    else { setRound(r => r + 1); }
    startNewRoundInternal();
  }

  async function saveScore() {
    if (!fbReady) return toast.error('Firebase not configured. Provide Firebase env values.');
    if (!user) return toast.info('Sign in to submit your score.');
    const mode = (settings.preset || 'custom').toLowerCase();
    const scoreVal = Math.round(totalScore);
    const payload = { username: user.displayName || user.email || 'Anonymous', score: scoreVal, uid: user.uid, mode, createdAt: serverTimestamp() };
    try {
      await addDoc(collection(db, 'scores'), payload); // legacy
      await addDoc(collection(db, 'leaderboards', mode, 'scores'), payload); // per-mode
      // Global totals (cumulative across all modes)
      const totalsRef = doc(db, 'leaderboards', 'global', 'totals', user.uid);
      await setDoc(totalsRef, { username: payload.username, uid: user.uid, total: increment(scoreVal), updatedAt: serverTimestamp() }, { merge: true });
      toast.success('Score saved!');
    }
    catch (e) { console.error(e); toast.error('Failed to save score. Check Firestore rules.'); }
  }

  async function saveFavourite() {
    if (!fbReady) return toast.error('Firebase not configured.');
    if (!user) return toast.info('Sign in to save favourites.');
    if (!answer) return;
    // Auto-label: "Favourite — Round X (lat,lng)"
    const label = `Favourite — Round ${round} (${answer.lat.toFixed(3)}, ${answer.lng.toFixed(3)})`;
    try {
      await addDoc(collection(db, 'users', user.uid, 'favourites'), {
        lat: answer.lat, lng: answer.lng, panoId: answer.panoId || null, label, order: Date.now(),
        guessLat: guess ? guess[0] : null, guessLng: guess ? guess[1] : null,
        distanceKm: lastResult ? Number(lastResult.distanceKm.toFixed(3)) : null,
        points: lastResult ? Math.round(lastResult.points) : null,
        createdAt: serverTimestamp()
      });
      toast.success('Saved to favourites!');
    } catch (e) { console.error(e); toast.error('Failed to save favourite.'); }
  }

  const freezePano = (settings.preset || '').toLowerCase() === 'cia';

  return (

    <PlayScreen
      label="Round"
      index={round}
      max={maxRounds}
      totalScore={totalScore}
      reveal={reveal}
      lastResult={lastResult}
      googleReady={googleReady}
      loading={loading}
      error={error}
      freezePano={freezePano}
      answer={answer}
      // text={stage?.text}   <-- remove this line
      guess={guess}
      onGuess={setGuess}
      picking={picking}
      onSubmit={onSubmitGuess}
      onNext={onNext}
      onSaveFavourite={saveFavourite}
      onSaveScore={saveScore}
      showSaveScore={round >= maxRounds}
      nextLabel={round >= maxRounds ? "Play again" : "Next round"}
      mobileMode={mobileMode}
      setMobileMode={setMobileMode}
      mapRevealShowAnswer={reveal}
    />

  );
}