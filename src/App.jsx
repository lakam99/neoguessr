import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Game from "./game/Game.jsx";
import Profile from "./profile/Profile.jsx";
import {
  ready as fbReady,
  auth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "./firebase";

function TopNav({ user, onSignIn, onSignOut }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-2xl md:text-3xl font-bold tracking-tight">
          WorldGuessr — Google
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/"
            className="px-3 py-1 rounded-full bg-slate-700/60 hover:bg-slate-600"
          >
            Game
          </Link>
          <Link
            to="/profile"
            className="px-3 py-1 rounded-full bg-slate-700/60 hover:bg-slate-600"
          >
            Profile
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        {fbReady ? (
          user ? (
            <>
              <span className="px-3 py-1 rounded-full bg-indigo-600/80">
                {user.displayName || user.email}
              </span>
              <button
                onClick={onSignOut}
                className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600"
            >
              Sign in
            </button>
          )
        ) : (
          <span className="px-3 py-1 rounded-full bg-slate-700/60">
            Scoreboard offline
          </span>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    if (!fbReady) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub && unsub();
  }, []);

  async function onSignIn() {
    if (!fbReady) return alert("Firebase not configured");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert(
        "Sign-in failed. If you see auth/operation-not-allowed, enable Google provider in Firebase Console."
      );
    }
  }

  async function onSignOut() {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <TopNav user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
        <Routes>
          <Route path="/" element={<Game user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
