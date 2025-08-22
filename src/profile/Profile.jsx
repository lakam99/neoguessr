import React from "react";
import { ready as fbReady, auth, db, GoogleAuthProvider, signInWithPopup, updateProfile, doc, setDoc, collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, serverTimestamp } from "../firebase";
import { Link } from "react-router-dom";
import { loadGoogleMaps } from "../lib/maps.js";
import StreetViewStatic from "../components/StreetViewStatic.jsx";
import GuessMap from "../components/GuessMap.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function Profile({ user }) {
  const [displayName, setDisplayName] = React.useState(user?.displayName || "");
  const [favs, setFavs] = React.useState([]);
  const [favErr, setFavErr] = React.useState(null);
  const [googleReady, setGoogleReady] = React.useState(false);
  const [expanded, setExpanded] = React.useState({}); // id -> bool

  React.useEffect(() => { setDisplayName(user?.displayName || ""); }, [user]);

  React.useEffect(() => {
    if (!fbReady || !user) return;
    setFavErr(null);
    const q1 = query(collection(db, "users", user.uid, "favourites"), orderBy("order", "desc"));
    const unsub = onSnapshot(
      q1,
      (snap) => { setFavErr(null); setFavs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
      (err) => { console.error("Favourites onSnapshot error:", err); setFavErr(err?.message || String(err)); }
    );
    return () => unsub && unsub();
  }, [user]);

  React.useEffect(()=>{
    (async ()=>{
      if(!API_KEY) return;
      try { await loadGoogleMaps(API_KEY); setGoogleReady(true); } catch(e){ console.error(e); }
    })();
  }, []);

  async function ensureSignin() {
    if (user) return true;
    if (!fbReady) { alert("Firebase not configured."); return false; }
    try { const provider = new GoogleAuthProvider(); await signInWithPopup(auth, provider); return true; }
    catch (e) { console.error(e); alert("Sign-in failed."); return false; }
  }

  async function saveDisplayName() {
    if (!await ensureSignin()) return;
    try {
      await updateProfile(auth.currentUser, { displayName: displayName || null });
      await setDoc(doc(db, "users", auth.currentUser.uid), { displayName: displayName || "", updatedAt: serverTimestamp() }, { merge: true });
      alert("Display name updated.");
    } catch (e) { console.error(e); alert("Failed to update display name."); }
  }

  async function renameFav(id, current) {
    const label = prompt("New label:", current) || current;
    if (!label) return;
    try { await updateDoc(doc(db, "users", user.uid, "favourites", id), { label }); }
    catch (e) { console.error(e); alert("Rename failed."); }
  }
  async function deleteFav(id) {
    if (!confirm("Delete this favourite?")) return;
    try { await deleteDoc(doc(db, "users", user.uid, "favourites", id)); }
    catch (e) { console.error(e); alert("Delete failed."); }
  }
  async function moveFav(id, direction) {
    const idx = favs.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= favs.length) return;
    const a = favs[idx], b = favs[swapWith];
    try { await updateDoc(doc(db, "users", user.uid, "favourites", a.id), { order: (b.order ?? 0) - (direction === "up" ? 1 : -1) }); }
    catch (e) { console.error(e); alert("Reorder failed."); }
  }

  function togglePreview(id){
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Profile</h2>
        <Link to="/" className="text-sm px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">Back to menu</Link>
      </div>

      {!user ? (
        <div className="rounded-xl bg-slate-900/70 ring-1 ring-white/10 p-4">
          <p className="mb-2">Sign in to manage your profile and favourites.</p>
          <button onClick={ensureSignin} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500">Sign in</button>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-900/70 ring-1 ring-white/10 p-4 space-y-3">
          <label className="block text-sm">Display name</label>
          <div className="flex gap-2">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-slate-800 ring-1 ring-white/10 outline-none" placeholder="Your display name" />
            <button onClick={saveDisplayName} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Save</button>
          </div>
        </div>
      )}

      {user && (
        <div className="rounded-xl bg-slate-900/70 ring-1 ring-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Your favourites</h3>
            <span className="text-xs opacity-70">{favs.length} saved</span>
          </div>

          {favErr && <div className="text-red-300 text-sm mb-2">Couldn’t load favourites: {favErr}</div>}

          <div className="grid gap-3">
            {favs.map((f) => {
              const hasGuess = (f.guessLat!=null && f.guessLng!=null);
              return (
                <div key={f.id} className="p-2 rounded-lg bg-slate-800/60 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="text-sm min-w-0">
                      <div className="font-medium">{f.label || "Untitled favourite"}</div>
                      <div className="opacity-70 break-words">
                        Ans: {f.lat?.toFixed(4)}, {f.lng?.toFixed(4)} {f.panoId ? `· ${String(f.panoId).slice(0,12)}…` : ""}
                        { hasGuess ? <> · Guess: {f.guessLat.toFixed(4)}, {f.guessLng.toFixed(4)}</> : null }
                        { (f.points!=null) ? <> · {f.points} pts</> : null }
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                      <button onClick={() => togglePreview(f.id)} className="px-2 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600">{expanded[f.id] ? "Hide" : "Preview"}</button>
                      <button onClick={() => moveFav(f.id, "up")} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600" title="Move up">↑</button>
                      <button onClick={() => moveFav(f.id, "down")} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600" title="Move down">↓</button>
                      <button onClick={() => renameFav(f.id, f.label || "Favourite")} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600">Rename</button>
                      <button onClick={() => deleteFav(f.id)} className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-500">Delete</button>
                    </div>
                  </div>

                  {expanded[f.id] && (
                    <div className="grid md:grid-cols-3 gap-3 mt-3">
                      <div className="md:col-span-2 h-56 md:h-64 rounded-xl overflow-hidden ring-1 ring-white/10">
                        <StreetViewStatic lat={f.lat} lng={f.lng} panoId={f.panoId || undefined} heading={0} pitch={20} />
                      </div>
                      <div className="md:col-span-1 h-56 md:h-64 rounded-xl overflow-hidden ring-1 ring-white/10 bg-slate-900">
                        <GuessMap
                          googleReady={googleReady}
                          guess={hasGuess ? [f.guessLat, f.guessLng] : null}
                          answer={{ lat: f.lat, lng: f.lng }}
                          interactive={false}
                          className="h-64"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {favs.length === 0 && !favErr && <div className="text-sm opacity-70">No favourites yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
