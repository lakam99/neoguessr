import React from "react";
import * as THREE from "three";
import { MapContainer, TileLayer, useMapEvents, CircleMarker, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ------------------------------ Utilities ------------------------------
const KM_PER_EARTH_RADIAN = 6371;
function deg2rad(d) { return (d * Math.PI) / 180; }
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * KM_PER_EARTH_RADIAN * Math.asin(Math.sqrt(a));
}

function formatKm(km) {
  if (km < 1) return `${Math.round(km*1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function scoreFromDistanceKm(km) {
  // 5000 at 0 km, ~0 at ~20k km, smooth falloff
  const s = Math.floor(5000 * Math.exp(-km / 2000));
  return Math.max(0, Math.min(5000, s));
}

// ------------------------------ Wikimedia Commons Fetch ------------------------------
async function fetchRandomPanoWithCoords(signal) {
  // Try a few categories in order for reliability
  const categories = [
    "Category:360° panoramic photographs",
    "Category:360° panoramas",
    "Category:360° panoramas with equirectangular projection"
  ];

  for (const cat of categories) {
    // Get up to 200 files from the category and pick random ones client side
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("origin", "*");
    url.searchParams.set("format", "json");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "categorymembers");
    url.searchParams.set("gcmtitle", cat);
    url.searchParams.set("gcmtype", "file");
    url.searchParams.set("gcmlimit", "200");
    url.searchParams.set("prop", "coordinates|imageinfo|info");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("iiprop", "url|extmetadata");
    url.searchParams.set("iiurlwidth", "4096");
    url.searchParams.set("iiextmetadatafilter", "Artist|LicenseShortName|ImageDescription|DateTimeOriginal");

    const res = await fetch(url, { signal });
    if (!res.ok) continue;
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    // Shuffle pages to randomize selection
    for (let i = pages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pages[i], pages[j]] = [pages[j], pages[i]];
    }

    for (const p of pages) {
      const coords = p.coordinates?.[0];
      const ii = p.imageinfo?.[0];
      if (!coords || !ii) continue;
      const lat = coords.lat, lon = coords.lon;
      const imageUrl = ii.thumburl || ii.url;
      if (!imageUrl || typeof lat !== "number" || typeof lon !== "number") continue;

      const meta = ii.extmetadata || {};
      const artist = meta.Artist?.value || "Unknown";
      const license = meta.LicenseShortName?.value || "";
      const desc = meta.ImageDescription?.value || "";
      return {
        title: p.title,
        pageUrl: p.fullurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        imageUrl,
        lat,
        lon,
        artist,
        license,
        desc,
        source: "Wikimedia Commons",
      };
    }
  }
  throw new Error("Could not find a panorama with coordinates.");
}

// ------------------------------ Pano Viewer (Three.js) ------------------------------
function PanoViewer({ imageUrl }) {
  const mountRef = React.useRef(null);
  const rendererRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const cameraRef = React.useRef(null);
  const meshRef = React.useRef(null);
  const isDownRef = React.useRef(false);
  const lastRef = React.useRef({ x: 0, y: 0 });
  const yawRef = React.useRef(0);
  const pitchRef = React.useRef(0);
  const fovRef = React.useRef(75);
  const animRef = React.useRef(0);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(fovRef.current, mount.clientWidth / mount.clientHeight, 0.1, 1100);
    cameraRef.current = camera;

    // Create inside-out sphere
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const texture = new THREE.TextureLoader().load(imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);

    function render() {
      // Apply yaw/pitch to camera
      const yaw = yawRef.current;
      const pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitchRef.current));
      const euler = new THREE.Euler(pitch, yaw, 0, "YXZ");
      camera.quaternion.setFromEuler(euler);
      camera.fov = fovRef.current;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(render);
    }
    render();

    // Resizing
    function onResize() {
      if (!rendererRef.current || !cameraRef.current || !mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    // Mouse controls
    function onDown(e) {
      isDownRef.current = true;
      lastRef.current = { x: e.clientX, y: e.clientY };
    }
    function onUp() { isDownRef.current = false; }
    function onMove(e) {
      if (!isDownRef.current) return;
      const dx = e.clientX - lastRef.current.x;
      const dy = e.clientY - lastRef.current.y;
      lastRef.current = { x: e.clientX, y: e.clientY };
      const sensitivity = 0.0025;
      yawRef.current -= dx * sensitivity;
      pitchRef.current -= dy * sensitivity;
    }
    function onWheel(e) {
      const delta = e.deltaY;
      fovRef.current = Math.max(35, Math.min(100, fovRef.current + delta * 0.02));
    }
    const canvas = renderer.domElement;
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        if (meshRef.current.material.map) meshRef.current.material.map.dispose();
        meshRef.current.material.dispose();
      }
      mount.removeChild(renderer.domElement);
    };
  }, [imageUrl]);

  return (
    <div ref={mountRef} className="w-full h-full bg-black rounded-2xl shadow-inner" />
  );
}

// ------------------------------ Map Click Hook ------------------------------
function MapClick({ onClick }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

// ------------------------------ Main Game ------------------------------
export default function App() {
  const [round, setRound] = React.useState(1);
  const [maxRounds] = React.useState(5);
  const [totalScore, setTotalScore] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pano, setPano] = React.useState(null);
  const [guess, setGuess] = React.useState(null); // [lat,lng]
  const [reveal, setReveal] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null); // {distanceKm, points}

  React.useEffect(() => {
    startNewRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startNewRound() {
    setLoading(true);
    setError("");
    setGuess(null);
    setReveal(false);
    setLastResult(null);
    try {
      const ctrl = new AbortController();
      const p = await fetchRandomPanoWithCoords(ctrl.signal);
      setPano(p);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load panorama.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmitGuess() {
    if (!guess || !pano) return;
    const distanceKm = haversine(guess[0], guess[1], pano.lat, pano.lon);
    const points = scoreFromDistanceKm(distanceKm);
    setTotalScore((s) => s + points);
    setReveal(true);
    setLastResult({ distanceKm, points });
  }

  function onNext() {
    if (round >= maxRounds) {
      // restart
      setRound(1);
      setTotalScore(0);
    } else {
      setRound((r) => r + 1);
    }
    startNewRound();
  }

  const worldCenter = [20, 0];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">WorldGuessr</h1>
          <div className="flex items-center gap-4 text-sm md:text-base">
            <span className="px-3 py-1 rounded-full bg-slate-700/60">Round {round} / {maxRounds}</span>
            <span className="px-3 py-1 rounded-full bg-emerald-600/80">Score {totalScore}</span>
          </div>
        </header>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[50vh] lg:h-[70vh] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
            {loading && (
              <div className="w-full h-full grid place-items-center bg-slate-900/60">
                <div className="animate-pulse text-center">
                  <div className="text-lg">Loading a random panorama…</div>
                  <div className="text-xs opacity-70 mt-1">Source: Wikimedia Commons</div>
                </div>
              </div>
            )}
            {!loading && error && (
              <div className="w-full h-full grid place-items-center p-6 text-center bg-slate-900/60">
                <div className="space-y-2">
                  <p className="text-red-300 font-semibold">{error}</p>
                  <button onClick={startNewRound} className="px-4 py-2 bg-slate-700 rounded-xl hover:bg-slate-600">Try again</button>
                </div>
              </div>
            )}
            {!loading && !error && pano && (
              <PanoViewer imageUrl={pano.imageUrl} />
            )}
          </div>

          <div className="lg:col-span-1 h-[50vh] lg:h-[70vh] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 bg-slate-900">
            {/* Map */}
            <MapContainer style={{height:'100%', width:'100%'}} center={worldCenter} zoom={2} minZoom={2} maxZoom={12} scrollWheelZoom className="w-full h-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClick onClick={setGuess} />
              {guess && (
                <CircleMarker center={guess} radius={10} pathOptions={{ color: "#22c55e" }} />
              )}
              {reveal && pano && (
                <>
                  <CircleMarker center={[pano.lat, pano.lon]} radius={10} pathOptions={{ color: "#60a5fa" }} />
                  {guess && (
                    <Polyline positions={[guess, [pano.lat, pano.lon]]} pathOptions={{ color: "#f59e0b", dashArray: "6 6" }} />
                  )}
                </>
              )}
            </MapContainer>
          </div>
        </div>

        {/* Controls and results */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm opacity-80">
            {pano && (
              <span>
                Source: <a className="underline" href={pano.pageUrl} target="_blank" rel="noreferrer">{pano.title.replace("File:", "")}</a>
                {pano.license ? ` — ${pano.license}` : ""} {pano.artist ? ` — by ${stripHtml(pano.artist)}` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!reveal ? (
              <button
                disabled={!pano || !guess}
                onClick={onSubmitGuess}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                Submit guess
              </button>
            ) : (
              <button
                onClick={onNext}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500"
              >
                {round >= maxRounds ? "Play again" : "Next round"}
              </button>
            )}
          </div>
        </div>

        {reveal && lastResult && (
          <div className="rounded-2xl bg-slate-900/70 ring-1 ring-white/10 p-4 flex flex-wrap items-center gap-4">
            <div className="text-lg font-semibold">Distance: <span className="text-amber-300">{formatKm(lastResult.distanceKm)}</span></div>
            <div className="text-lg font-semibold">Points: <span className="text-emerald-300">{lastResult.points}</span></div>
            <div className="text-sm opacity-80">Actual location: {pano ? `${pano.lat.toFixed(4)}, ${pano.lon.toFixed(4)}` : ""}</div>
          </div>
        )}

        <footer className="text-xs opacity-70 text-center mt-2">
          Uses Wikimedia Commons panoramas and OpenStreetMap tiles. Respect each provider terms.
        </footer>
      </div>
    </div>
  );
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || html;
}
