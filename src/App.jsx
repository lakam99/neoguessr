import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Game from "./game/Game.jsx";
import Profile from "./profile/Profile.jsx";
import Menu from "./menu/Menu.jsx";
import CampaignMenu from "./campaign/CampaignMenu.jsx";
import CampaignGame from "./campaign/CampaignGame.jsx";
import { auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, ready as fbReady } from "./firebase";
import { SettingsContext, defaultSettings } from "./ctx/SettingsContext.jsx";


function TopNav({ user, onSignIn, onSignOut }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <header className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-2xl md:text-3xl font-bold tracking-tight">
            Neo-Guessr
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2 text-sm">
            <Link to="/" className="px-3 py-1 rounded-full bg-slate-700/60 hover:bg-slate-600">Menu</Link>
            <Link to="/play" className="px-3 py-1 rounded-full bg-slate-700/60 hover:bg-slate-600">Play</Link>
            <Link to="/campaign" className="px-3 py-1 rounded-full bg-slate-700/60 hover:bg-slate-600">Campaign</Link>
            <Link to="/profile" className="px-3 py-1 rounded-full bg-slate-700/60 hover:bg-slate-600">Profile</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg bg-slate-700/70"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <span className="block w-5 h-0.5 bg-white mb-1" />
            <span className="block w-5 h-0.5 bg-white mb-1" />
            <span className="block w-5 h-0.5 bg-white" />
          </button>

          {/* Auth pill(s) */}
          {fbReady ? (
            user ? (
              <>
                <span className="hidden sm:inline px-3 py-1 rounded-full bg-indigo-600/80 text-center">
                  {user.displayName || user.email}
                </span>
                <button onClick={onSignOut} className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">
                  Sign out
                </button>
              </>
            ) : (
              <button onClick={onSignIn} className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600">
                Sign in
              </button>
            )
          ) : (
            <span className="px-3 py-1 rounded-full bg-slate-700/60 text-center">Scoreboard offline</span>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        {/* Panel */}
        <aside
          className={`absolute left-0 top-0 h-full w-64 bg-slate-900 shadow-2xl ring-1 ring-white/10 transform transition-transform ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <span className="font-semibold">Navigation</span>
            <button className="p-2 rounded hover:bg-slate-800" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <nav className="p-3 flex flex-col gap-2">
            <Link onClick={() => setOpen(false)} to="/" className="px-3 py-2 rounded bg-slate-800/70 hover:bg-slate-700">
              Menu
            </Link>
            <Link onClick={() => setOpen(false)} to="/play" className="px-3 py-2 rounded bg-slate-800/70 hover:bg-slate-700">
              Play
            </Link>
            <Link onClick={() => setOpen(false)} to="/campaign" className="px-3 py-2 rounded bg-slate-800/70 hover:bg-slate-700">
              Campaign
            </Link>
            <Link onClick={() => setOpen(false)} to="/profile" className="px-3 py-2 rounded bg-slate-800/70 hover:bg-slate-700">
              Profile
            </Link>
          </nav>
        </aside>
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = React.useState(null);
  const [settings, setSettings] = React.useState(() => {
    try {
      const raw = localStorage.getItem("wg_settings");
      return raw ? JSON.parse(raw) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  React.useEffect(() => {
    if (!fbReady) return;
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub && unsub();
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("wg_settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  async function onSignIn() {
    if (!fbReady) return alert("Firebase not configured");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert("Sign-in failed. If you see auth/operation-not-allowed, enable Google provider in Firebase Console.");
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
    <SettingsContext.Provider value={{ settings, setSettings }}>
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
        <div className="max-w-7xl mx-auto">
          <TopNav user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
          <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/play" element={<Game user={user} />} />
            <Route path="/campaign" element={<CampaignMenu user={user} />} />
            <Route path="/campaign/play/:caseId" element={<CampaignGame user={user} />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </SettingsContext.Provider>
  );
}
