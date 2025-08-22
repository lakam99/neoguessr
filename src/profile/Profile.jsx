import React from "react";
import {
  ready as fbReady,
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  doc,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "../firebase";
import { Link } from "react-router-dom";

export default function Profile({ user }) {
  const [displayName, setDisplayName] = React.useState(user?.displayName || "");
  const [favs, setFavs] = React.useState([]);

  React.useEffect(() => { setDisplayName(user?.displayName || ""); }, [user]);

  React.useEffect(() => {
    if (!fbReady || !user) return;
    const q = query(collection(db, "users", user.uid, "favourites"), orderBy("order", "asc"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => setFavs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub && unsub();
  }, [user]);

  async function ensureSignin() {
    if (user) return true;
    if (!fbReady) { alert("Firebase not configured."); return false; }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return true;
    } catch (e) { console.error(e); alert("Sign-in failed."); return false; }
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
    try {
      await updateDoc(doc(db, "users", user.uid, "favourites", a.id), { order: (b.order ?? 0) - (direction === "up" ? 1 : -1) });
    } catch (e) { console.error(e); alert("Reorder failed."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Profile</h2>
        <Link to="/" className="text-sm px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">Back to game</Link>
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
          <div className="grid gap-2">
            {favs.map((f, idx) => (
              <div key={f.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-800/60">
                <div className="text-sm">
                  <div className="font-medium">{f.label || "Untitled favourite"}</div>
                  <div className="opacity-70">{f.lat?.toFixed(4)}, {f.lng?.toFixed(4)} {f.panoId ? `· ${f.panoId}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => moveFav(f.id, "up")} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" title="Move up">↑</button>
                  <button onClick={() => moveFav(f.id, "down")} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" title="Move down">↓</button>
                  <button onClick={() => renameFav(f.id, f.label || "Favourite")} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Rename</button>
                  <button onClick={() => deleteFav(f.id)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500">Delete</button>
                </div>
              </div>
            ))}
            {favs.length === 0 && <div className="text-sm opacity-70">No favourites yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
