import React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { auth, db, doc, collection, addDoc, serverTimestamp, updateDoc, setDoc } from "../firebase";
import { getDoc } from "firebase/firestore";
import { loadGoogleMaps } from "../lib/maps.js";
import { distanceKm } from "../lib/campaign.js";
import PlayScreen from "../components/play/PlayScreen.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Fixed completion awards by difficulty
const DIFFICULTY_AWARD = {
  easy: 60,
  standard: 120,
  hard: 220,
  cia: 320,
};

function getRevealRadiusKm(stageIndex, stage) {
  if (stage && typeof stage.revealRadiusKm === "number") return stage.revealRadiusKm;
  const ladder = [1000, 500, 250, 100, 25, 10, 5];
  return ladder[Math.min(stageIndex, ladder.length - 1)];
}

export default function CampaignGame() {
  const navigate = useNavigate();
  const { caseId } = useParams();

  const [loading, setLoading] = React.useState(true);
  const [campaign, setCampaign] = React.useState(null);
  const [stageIndex, setStageIndex] = React.useState(0);
  const [guess, setGuess] = React.useState(null);
  const [reveal, setReveal] = React.useState(false);
  const [canAdvance, setCanAdvance] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);
  const [googleReady, setGoogleReady] = React.useState(false);
  const [mobileMode, setMobileMode] = React.useState("pano");

  const uid = auth?.currentUser?.uid || null;

  // Load Google Maps
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (API_KEY) {
        try {
          await loadGoogleMaps(API_KEY);
          if (mounted) setGoogleReady(true);
        } catch (e) { console.error(e); }
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load campaign
  React.useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        if (!API_KEY) { setLoading(false); return; }
        if (uid && caseId) {
          const dref = doc(db, "campaigns", uid, "cases", caseId);
          const snap = await getDoc(dref);
          if (snap.exists() && !cancelled) {
            const data = snap.data();
            const stages = Array.isArray(data.stages) ? data.stages : [];
            const prog = typeof data.progress === "number" ? data.progress : 0;
            setCampaign({ ...data, id: dref.id });
            setStageIndex(Math.min(prog, stages.length - 1));
            setLoading(false);
            return;
          }
        }
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [uid, caseId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!campaign) {
    return (
      <div className="p-6">
        No campaign found. Create one in{" "}
        <Link to="/campaign" className="underline">Campaign Menu</Link>.
      </div>
    );
  }

  const stage = campaign.stages[stageIndex];
  const maxStages = campaign.stages.length;
  const answer = stage ? { lat: stage.lat, lng: stage.lng, panoId: stage.panoId || null, pov: stage.pov || null } : null;
  const radiusKm = getRevealRadiusKm(stageIndex, stage);

  async function onSubmit() {
    if (!guess || !stage) return;
    const guessPt = { lat: guess[0], lng: guess[1] };
    const dist = distanceKm(guessPt, answer);

    const ok = dist <= radiusKm + 1e-9;
    setLastResult({ distanceKm: dist });
    setCanAdvance(ok);
    setReveal(true);

    try {
      if (uid && caseId) {
        const dref = doc(db, "campaigns", uid, "cases", caseId);
        await updateDoc(dref, {
          [`results.${stageIndex}`]: {
            guessLat: guess[0],
            guessLng: guess[1],
            distanceKm: Number(dist.toFixed(3)),
            submittedAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        });
        if (ok) {
          await updateDoc(dref, { progress: Math.min(stageIndex + 1, maxStages - 1) });
        }
      }
    } catch (e) { console.error("Failed to save guess:", e); }
  }

  async function finalizeCampaign() {
    if (!uid || !caseId) return;
    try {
      const dref = doc(db, "campaigns", uid, "cases", caseId);
      const snap = await getDoc(dref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.finalized) return;

      const dif = data.difficulty || "standard";
      const award = DIFFICULTY_AWARD[dif] ?? DIFFICULTY_AWARD.standard;
      const username = auth?.currentUser?.displayName || auth?.currentUser?.email || "anonymous";

      // Update totals
      const totalRef = doc(db, "leaderboards", "campaign", "totals", uid);
      const totalSnap = await getDoc(totalRef);
      if (totalSnap.exists()) {
        const cur = totalSnap.data()?.total || 0;
        await updateDoc(totalRef, { username, uid, total: cur + award, updatedAt: serverTimestamp() });
      } else {
        await setDoc(totalRef, { username, uid, total: award, updatedAt: serverTimestamp() });
      }

      // Insert individual score
      await addDoc(collection(db, "leaderboards", "campaign", "scores"), {
        username, uid, score: award, caseId, createdAt: serverTimestamp(),
      });

      // Mark finalized
      await updateDoc(dref, {
        finalized: true,
        finalScore: award,
        score: award,
        progress: 0,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) { console.error("Finalize failed:", e); }
  }

  async function onNext() {
    if (!canAdvance) {
      // Failure resets
      if (uid && caseId) {
        const dref = doc(db, "campaigns", uid, "cases", caseId);
        await updateDoc(dref, { progress: 0, score: 0, results: {}, updatedAt: serverTimestamp() });
      }
      setStageIndex(0); setGuess(null); setLastResult(null); setReveal(false); setCanAdvance(false);
      return;
    }

    if (stageIndex >= maxStages - 1) {
      await finalizeCampaign();
      navigate("/campaign");
      return;
    }

    setStageIndex(stageIndex + 1);
    setGuess(null); setLastResult(null); setReveal(false); setCanAdvance(false);
  }

  return (
    <PlayScreen
      label="Stage"
      index={stageIndex + 1}
      max={maxStages}
      reveal={reveal}
      lastResult={lastResult}
      googleReady={googleReady}
      loading={loading}
      freezePano={true}
      answer={answer}
      text={stage?.text || "Investigate the photo and make your best guess."}
      guess={guess}
      onGuess={(arr) => setGuess(arr)}
      onSubmit={onSubmit}
      onNext={onNext}
      showSaveScore={false}
      nextLabel={
        canAdvance
          ? (stageIndex >= maxStages - 1 ? "Finish campaign" : "Next stage")
          : "Try Again"
      }
      mobileMode={mobileMode}
      setMobileMode={setMobileMode}
      mapRevealMode={canAdvance ? "circle" : "marker"}
      mapRevealCircleKm={canAdvance ? radiusKm : null}
      mapRevealShowAnswer={canAdvance && reveal}
    />
  );
}
