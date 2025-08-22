import React from "react";
import { Loader } from "@googlemaps/js-api-loader";
import {
  ready as fbReady, auth, db,
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot
} from "./firebase";

// ------------------------------ ENV ------------------------------
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const LOCATION_MODE = (import.meta.env.VITE_LOCATION_MODE || 'random').toLowerCase(); // 'random' | 'country'
const COUNTRY = import.meta.env.VITE_COUNTRY || '';

// ------------------------------ Utilities ------------------------------
const KM_PER_EARTH_RADIAN = 6371;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function deg2rad(d) { return (d * Math.PI) / 180; }
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(Math.abs(dLon)/2)**2;
  return 2 * KM_PER_EARTH_RADIAN * Math.asin(Math.sqrt(a));
}
function formatKm(km) {
  if (km < 1) return `${Math.round(km*1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
function scoreFromDistanceKm(km) {
  const s = Math.floor(5000 * Math.exp(-km / 2000));
  return Math.max(0, Math.min(5000, s));
}

// ------------------------------ Google Maps Loader (official) ------------------------------
let mapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google && window.google.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;
  const loader = new Loader({ apiKey, version: "weekly", libraries: ["marker","geocoding"] });
  mapsPromise = loader.load().then(() => window.google);
  return mapsPromise;
}

// ------------------------------ Street View Picker (throttled) ------------------------------
function randomLatLngWorldwide() {
  const lat = (Math.random() * 140) - 70; // -70..70
  const lng = (Math.random() * 360) - 180;
  return { lat, lng };
}

async function geocodeCountryBounds(google, countryName) {
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: countryName }, (results, status) => {
      if (status === 'OK' && results && results.length) {
        const geom = results[0].geometry;
        const vp = geom.viewport || geom.bounds;
        if (vp) resolve(vp);
        else reject(new Error('No viewport for country'));
      } else {
        reject(new Error('Geocoding failed: ' + status));
      }
    });
  });
}

function randomLatLngInBounds(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const lat = sw.lat() + Math.random() * (ne.lat() - sw.lat());
  const lng = sw.lng() + Math.random() * (ne.lng() - sw.lng());
  return { lat, lng };
}

function svGetPanorama(google, options) {
  return new Promise((resolve, reject) => {
    const sv = new google.maps.StreetViewService();
    sv.getPanorama(options, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data && data.location) {
        resolve(data);
      } else {
        reject(new Error('No pano'));
      }
    });
  });
}

const FALLBACK_SEEDS = [
  { lat: 48.8584, lng: 2.2945 },    // Paris
  { lat: 51.5007, lng: -0.1246 },   // London
  { lat: 40.6892, lng: -74.0445 },  // NYC
  { lat: 35.6762, lng: 139.6503 },  // Tokyo
  { lat: 34.0522, lng: -118.2437 }, // LA
  { lat: -33.8688, lng: 151.2093 }, // Sydney
  { lat: -23.5505, lng: -46.6333 }, // São Paulo
  { lat: 52.5200, lng: 13.4050 },   // Berlin
  { lat: 41.9028, lng: 12.4964 },   // Rome
  { lat: 43.6532, lng: -79.3832 },  // Toronto
];

async function pickStreetViewLocation(google, mode, country) {
  const svRadiusSequence = [50000, 150000, 300000, 500000];
  const attemptsPerRadius = 6; // keep total calls smaller to avoid rate limits
  const backoffs = [150, 300, 600, 900, 1200, 1500];
  let bounds = null;

  if (mode === 'country' && country) {
    try { bounds = await geocodeCountryBounds(google, country); }
    catch (e) { console.warn('Country geocode failed, falling back to random', e); }
  }

  let attempt = 0;
  for (const radius of svRadiusSequence) {
    for (let i = 0; i < attemptsPerRadius; i++) {
      const candidate = bounds ? randomLatLngInBounds(bounds) : randomLatLngWorldwide();
      try {
        const pano = await svGetPanorama(google, {
          location: candidate,
          radius,
          preference: google.maps.StreetViewPreference.NEAREST,
          source: google.maps.StreetViewSource.DEFAULT,
        });
        const lat = pano.location.latLng.lat();
        const lng = pano.location.latLng.lng();
        const panoId = pano.location.pano;
        return { lat, lng, panoId };
      } catch {
        const delay = backoffs[Math.min(attempt, backoffs.length - 1)];
        await sleep(delay);
        attempt++;
      }
    }
  }

  // Fallback near popular coverage seeds (short, with backoff)
  for (const seed of FALLBACK_SEEDS) {
    for (const radius of [1000, 5000, 20000]) {
      try {
        const pano = await svGetPanorama(google, {
          location: seed,
          radius,
          preference: google.maps.StreetViewPreference.NEAREST,
          source: google.maps.StreetViewSource.DEFAULT,
        });
        const lat = pano.location.latLng.lat();
        const lng = pano.location.latLng.lng();
        const panoId = pano.location.pano;
        return { lat, lng, panoId };
      } catch {
        await sleep(200);
      }
    }
  }

  throw new Error('Could not find a Street View location after many attempts.');
}

// ------------------------------ Street View component (reuse instance) ------------------------------
function StreetViewPane({ googleReady, panoLatLng, onLoaded }) {
  const ref = React.useRef(null);
  const panoRef = React.useRef(null);

  React.useEffect(() => {
    if (!googleReady || !ref.current || !panoLatLng) return;
    const google = window.google;
    if (!panoRef.current) {
      // First-time create
      const pano = new google.maps.StreetViewPanorama(ref.current, {
        position: panoLatLng,
        pov: { heading: 0, pitch: 0 },
        zoom: 0,
        motionTracking: false,
        motionTrackingControl: false,
        addressControl: false,
        showRoadLabels: false, // hide street names
        linksControl: true,
        zoomControl: true,
        clickToGo: true,
        fullscreenControl: true,
      });
      panoRef.current = pano;
      onLoaded && onLoaded();
    } else {
      // Reuse instance and just move the position
      try { panoRef.current.setPosition(panoLatLng); } catch (e) { console.warn('pano.setPosition failed', e); }
    }
  }, [googleReady, panoLatLng, onLoaded]);

  return <div ref={ref} className="w-full h-full bg-black rounded-2xl" />;
}

// ------------------------------ Google Map guess component (mapId included) ------------------------------
function GuessMap({ googleReady, guess, answer, onGuess }) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  const guessMarkerRef = React.useRef(null);
  const answerMarkerRef = React.useRef(null);
  const lineRef = React.useRef(null);

  React.useEffect(() => {
    try {
      if (!googleReady || !ref.current || mapRef.current) return;
      const google = window.google;
      const map = new google.maps.Map(ref.current, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        mapId: MAP_ID,
      });
      mapRef.current = map;
      map.addListener('click', (e) => {
        const ll = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        onGuess && onGuess([ll.lat, ll.lng]);
      });
    } catch (e) { console.error('Map init failed', e); }
  }, [googleReady, onGuess]);

  React.useEffect(() => {
    try {
      const google = window.google;
      const map = mapRef.current;
      if (!google || !map) return;
      const hasAdvanced = !!(google.maps.marker && google.maps.marker.AdvancedMarkerElement);

      // Guess marker
      if (guess) {
        const pos = { lat: guess[0], lng: guess[1] };
        if (!guessMarkerRef.current) {
          if (hasAdvanced) {
            const el = document.createElement('div');
            el.style.width = '14px'; el.style.height = '14px'; el.style.borderRadius = '50%';
            el.style.background = '#22c55e'; el.style.boxShadow = '0 0 0 2px rgba(34,197,94,0.35)';
            guessMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({ map, position: pos, content: el, title: 'Your guess' });
          } else {
            guessMarkerRef.current = new google.maps.Marker({ map, position: pos, title: 'Your guess' });
          }
        } else {
          if (hasAdvanced) { guessMarkerRef.current.position = pos; }
          else { guessMarkerRef.current.setPosition(pos); }
        }
      } else if (guessMarkerRef.current) {
        if (hasAdvanced) { guessMarkerRef.current.map = null; } else { guessMarkerRef.current.setMap(null); }
        guessMarkerRef.current = null;
      }

      // Answer marker
      if (answer) {
        const pos = { lat: answer.lat, lng: answer.lng };
        if (!answerMarkerRef.current) {
          if (hasAdvanced) {
            const el = document.createElement('div');
            el.style.width = '14px'; el.style.height = '14px'; el.style.borderRadius = '50%';
            el.style.background = '#3b82f6'; el.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.35)';
            answerMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({ map, position: pos, content: el, title: 'Actual location' });
          } else {
            answerMarkerRef.current = new google.maps.Marker({
              map, position: pos, title: 'Actual location',
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#3b82f6', fillOpacity: 1, strokeWeight: 1 }
            });
          }
        } else {
          if (hasAdvanced) { answerMarkerRef.current.position = pos; }
          else { answerMarkerRef.current.setPosition(pos); }
        }
      } else if (answerMarkerRef.current) {
        if (hasAdvanced) { answerMarkerRef.current.map = null; } else { answerMarkerRef.current.setMap(null); }
        answerMarkerRef.current = null;
      }

      // Geodesic line
      if (answer && guess) {
        const path = [ { lat: guess[0], lng: guess[1] }, { lat: answer.lat, lng: answer.lng } ];
        if (!lineRef.current) {
          lineRef.current = new google.maps.Polyline({ map, path, geodesic: true });
        } else {
          lineRef.current.setPath(path);
          lineRef.current.setMap(map);
        }
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(path[0]); bounds.extend(path[1]);
        map.fitBounds(bounds, 40);
      } else if (lineRef.current) {
        lineRef.current.setMap(null);
        lineRef.current = null;
      }
    } catch (e) { console.error('Marker/line update failed', e); }
  }, [guess, answer]);

  return <div ref={ref} className="w-full h-full bg-slate-900 rounded-2xl" />;
}

// ------------------------------ Main Game ------------------------------
export default function App() {
  const [round, setRound] = React.useState(1);
  const [maxRounds] = React.useState(5);
  const [totalScore, setTotalScore] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [googleReady, setGoogleReady] = React.useState(false);
  const [picking, setPicking] = React.useState(false); // prevent overlap

  const [answer, setAnswer] = React.useState(null); // {lat,lng,panoId}
  const [guess, setGuess] = React.useState(null); // [lat,lng]
  const [reveal, setReveal] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null); // {distanceKm, points}

  const [user, setUser] = React.useState(null);
  const [scores, setScores] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        if (!API_KEY) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY in .env');
        await loadGoogleMaps(API_KEY);
        setGoogleReady(true);
        await startNewRoundInternal();
      } catch (e) {
        console.error(e);
        setError(e.message || 'Failed to initialize Google Maps');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Firebase listeners (optional if not configured)
  React.useEffect(() => {
    if (!fbReady) return;
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(50));
    const unsubScores = onSnapshot(q, (snap) => {
      setScores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Leaderboard read failed', err));
    return () => { unsubAuth && unsubAuth(); unsubScores && unsubScores(); };
  }, []);

  async function startNewRoundInternal() {
    if (picking) return; // guard against double clicks
    setPicking(true);
    setLoading(true);
    setError('');
    setGuess(null);
    setReveal(false);
    setLastResult(null);
    try {
      const google = window.google;
      const picked = await pickStreetViewLocation(google, LOCATION_MODE, COUNTRY);
      setAnswer(picked);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to pick Street View');
    } finally {
      setLoading(false);
      setPicking(false);
    }
  }

  function onSubmitGuess() {
    if (!guess || !answer) return;
    const distanceKm = haversine(guess[0], guess[1], answer.lat, answer.lng);
    const points = scoreFromDistanceKm(distanceKm);
    setTotalScore((s) => s + points);
    setReveal(true);
    setLastResult({ distanceKm, points });
  }

  function onNext() {
    if (round >= maxRounds) {
      setRound(1);
      setTotalScore(0);
    } else {
      setRound((r) => r + 1);
    }
    startNewRoundInternal();
  }

  async function saveScore() {
    if (!fbReady) return alert('Firebase not configured. Provide Firebase env values.');
    if (!user) return alert('Sign in to submit your score.');
    try {
      await addDoc(collection(db, 'scores'), {
        username: user.displayName || user.email || 'Anonymous',
        score: Math.round(totalScore),
        uid: user.uid,
        createdAt: serverTimestamp(),
      });
      alert('Score saved!');
    } catch (e) {
      console.error(e);
      alert('Failed to save score. Check Firestore rules.');
    }
  }

  async function signIn() {
    if (!fbReady) return alert('Firebase not configured. Provide Firebase env values.');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert('Sign-in failed. If you see auth/operation-not-allowed, enable Google provider in Firebase Console → Authentication → Sign-in method.');
    }
  }
  async function signOutNow() {
    try { await signOut(auth); } catch (e) { console.error(e); }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">WorldGuessr — Google</h1>
          <div className="flex items-center gap-3 text-sm md:text-base">
            <span className="px-3 py-1 rounded-full bg-slate-700/60">Round {round} / {maxRounds}</span>
            <span className="px-3 py-1 rounded-full bg-emerald-600/80">Score {totalScore}</span>
            <span className="px-3 py-1 rounded-full bg-slate-700/60">Mode: {LOCATION_MODE === 'country' && COUNTRY ? `Country (${COUNTRY})` : 'Random'}</span>
            {fbReady ? (
              user ? (
                <span className="px-3 py-1 rounded-full bg-indigo-600/80">{user.displayName || user.email}</span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-slate-700/60">Guest</span>
              )
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-700/60">Scoreboard offline</span>
            )}
            {fbReady && (user ? (
              <button onClick={signOutNow} className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">Sign out</button>
            ) : (
              <button onClick={signIn} className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600">Sign in</button>
            ))}
          </div>
        </header>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[50vh] lg:h-[70vh] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
            {(!googleReady || loading) && (
              <div className="w-full h-full grid place-items-center bg-slate-900/60">
                <div className="animate-pulse text-center">
                  <div className="text-lg">{!googleReady ? 'Loading Google Maps…' : 'Loading Street View…'}</div>
                </div>
              </div>
            )}
            {error && !loading && (
              <div className="w-full h-full grid place-items-center p-6 text-center bg-slate-900/60">
                <div className="space-y-2">
                  <p className="text-red-300 font-semibold">{error}</p>
                  <button onClick={startNewRoundInternal} className="px-4 py-2 bg-slate-700 rounded-xl hover:bg-slate-600">Try again</button>
                </div>
              </div>
            )}
            {googleReady && !loading && !error && answer && (
              <StreetViewPane googleReady={googleReady} panoLatLng={{ lat: answer.lat, lng: answer.lng }} onLoaded={() => {}} />
            )}
          </div>

          <div className="lg:col-span-1 h-[50vh] lg:h-[70vh] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 bg-slate-900">
            <GuessMap googleReady={googleReady} guess={guess} answer={reveal ? answer : null} onGuess={setGuess} />
          </div>
        </div>

        {/* Controls and results */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm opacity-80">
            <span>Imagery: Google Street View. Basemap: Google Maps. {fbReady ? '' : '(Scoreboard disabled: missing Firebase config)'}</span>
          </div>

          <div className="flex items-center gap-2">
            {!reveal ? (
              <button
                disabled={!googleReady || !answer || !guess || false}
                onClick={onSubmitGuess}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                Submit guess
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onNext}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500"
                >
                  {round >= maxRounds ? 'Play again' : 'Next round'}
                </button>
                {round >= maxRounds && (
                  <button
                    onClick={saveScore}
                    disabled={!fbReady || !user}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                  >
                    Save score
                  </button>
                )}
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

        {/* Leaderboard */}
        <div className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Top Scores</h2>
            <span className="text-xs opacity-70">{fbReady ? 'Live' : 'Offline (configure Firebase)'}</span>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-800/80">
                <tr><th className="px-2 py-1">#</th><th className="px-2 py-1">User</th><th className="px-2 py-1">Score</th></tr>
              </thead>
              <tbody>
                {(scores || []).map((r, i) => (
                  <tr key={r.id || i} className="odd:bg-slate-800/50">
                    <td className="px-2 py-1">{i+1}</td>
                    <td className="px-2 py-1">{r.username || 'Unknown'}</td>
                    <td className="px-2 py-1 font-semibold">{r.score}</td>
                  </tr>
                ))}
                {(!scores || scores.length === 0) && (
                  <tr><td colSpan="3" className="px-2 py-2 opacity-70">No scores yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="text-xs opacity-70 text-center mt-2">
          Uses Google Maps Platform and Firebase. Provide your own keys and enforce rules in Firestore.
        </footer>
      </div>
    </div>
  );
}
