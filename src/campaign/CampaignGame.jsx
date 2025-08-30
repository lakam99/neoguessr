import React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { auth, db, doc, collection, addDoc, serverTimestamp, updateDoc, increment } from "../firebase";
import { getDoc } from "firebase/firestore";
import { loadGoogleMaps } from "../lib/maps.js";
import { distanceKm } from "../lib/campaign.js";
import PlayScreen from "../components/play/PlayScreen.jsx";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
  const [guess, setGuess] = React.useState(null); // [lat,lng]
  const [reveal, setReveal] = React.useState(false);
  const [canAdvance, setCanAdvance] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);
  const [totalScore, setTotalScore] = React.useState(0);
  const [googleReady, setGoogleReady] = React.useState(false);
  const [mobileMode, setMobileMode] = React.useState("pano");
  const [picking, setPicking] = React.useState(false);

  const uid = auth?.currentUser?.uid || null;

  // Load Google Maps
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (API_KEY) {
        try {
          await loadGoogleMaps(API_KEY);
          if (mounted) setGoogleReady(true);
        } catch (e) {
          console.error(e);
        }
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
          if (snap.exists()) {
            const data = snap.data();
            if (!cancelled) {
              const stages = Array.isArray(data.stages) ? data.stages : [];
              const maxIdx = Math.max(0, stages.length - 1);
              const prog = typeof data.progress === "number" ? data.progress : 0;
              setCampaign({ ...data, id: dref.id });
              setStageIndex(Math.min(prog, maxIdx));
              setTotalScore(typeof data.score === "number" ? data.score : 0);
              setLoading(false);
            }
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
  const answer = stage
    ? { lat: stage.lat, lng: stage.lng, panoId: stage.panoId || null, pov: stage.pov || null }
    : null;
  const freezePano = true;
  const radiusKm = getRevealRadiusKm(stageIndex, stage);

  async function onSubmit() {
    if (!guess || !stage) return;

    const guessPt = { lat: guess[0], lng: guess[1] };
    const dist = distanceKm(guessPt, answer);

    // Determine pass/fail against the stage radius
    const ok = dist <= radiusKm + 1e-9;

    // Points: zero on failure
    const base = 1000;
    const thresholds = stage.thresholdKm || [1000, 500];
    const bonus = ok && dist <= thresholds[1] ? 1.2 : 1.0;
    const points = ok ? Math.round(base * bonus) : 0;

    // Show result; enter post-guess state (Submit hidden, CTA shows)
    setLastResult({ distanceKm: dist, base, mult: ok ? bonus : 0, points });
    setCanAdvance(ok);
    setReveal(true);

    // Persist: always record per-stage result; progress/score only on success
    try {
      if (uid && caseId) {
        const dref = doc(db, "campaigns", uid, "cases", caseId);
        const resultPayload = {
          guessLat: guess[0],
          guessLng: guess[1],
          distanceKm: Number(dist.toFixed(3)),
          points,
          submittedAt: serverTimestamp(),
        };

        if (ok) {
          await updateDoc(dref, {
            [`results.${stageIndex}`]: resultPayload,
            progress: Math.min(stageIndex + 1, maxStages - 1),
            updatedAt: serverTimestamp(),
          });
          await updateDoc(dref, { score: increment(points) });
          setTotalScore((s) => s + points);
        } else {
          await updateDoc(dref, {
            [`results.${stageIndex}`]: resultPayload,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (e) {
      console.error("Failed to save campaign progress:", e);
    }
  }

  async function onNext() {
    // Fail case: "Try Again" — reset campaign to stage 1 and clear score/results
    if (!canAdvance) {
      try {
        if (uid && caseId) {
          const dref = doc(db, "campaigns", uid, "cases", caseId);
          await updateDoc(dref, {
            progress: 0,
            score: 0,
            results: {},
            updatedAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.error("Failed to reset campaign:", e);
      }

      // Local reset
      setStageIndex(0);
      setTotalScore(0);
      setGuess(null);
      setLastResult(null);
      setReveal(false);
      setCanAdvance(false);
      return;
    }

    // Success case: advance
    const nextIndex = Math.min(stageIndex + 1, maxStages - 1);
    setReveal(false);
    setGuess(null);
    setLastResult(null);
    setStageIndex(nextIndex);
    setCanAdvance(false);

    try {
      if (uid && caseId) {
        const dref = doc(db, "campaigns", uid, "cases", caseId);
        await updateDoc(dref, { progress: nextIndex, updatedAt: serverTimestamp() });
      }
    } catch (e) {
      console.error("Failed to save campaign progress index:", e);
    }
  }

  async function saveFavourite() {
    const user = auth?.currentUser || null;
    if (!user || !stage) return;
    const label = `Favourite — Stage ${stageIndex + 1} (${stage.lat.toFixed(3)}, ${stage.lng.toFixed(3)})`;
    try {
      await addDoc(collection(db, "users", user.uid, "favourites"), {
        lat: stage.lat, lng: stage.lng, panoId: stage.panoId || null,
        label, order: Date.now(),
        guessLat: Array.isArray(guess) ? guess[0] : null,
        guessLng: Array.isArray(guess) ? guess[1] : null,
        distanceKm: lastResult ? Number(lastResult.distanceKm.toFixed(3)) : null,
        points: lastResult ? Math.round(lastResult.points) : null,
        createdAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  }

  return (
    <PlayScreen
      label="Stage"
      index={stageIndex + 1}
      max={maxStages}
      totalScore={totalScore}
      reveal={reveal}
      lastResult={lastResult}
      googleReady={googleReady}
      loading={loading}
      error={null}
      freezePano={freezePano}
      // Pano always shows the image
      answer={answer}
      text={stage?.text || "Investigate the photo and make your best guess."}
      guess={guess}
      onGuess={(arr) => setGuess(arr)}
      picking={picking}
      onSubmit={onSubmit}
      onNext={onNext}
      onSaveFavourite={saveFavourite}
      showSaveScore={false}
      nextLabel={
        canAdvance
          ? (stageIndex >= maxStages - 1 ? "Finish campaign" : "Next stage")
          : "Try Again"
      }
      mobileMode={mobileMode}
      setMobileMode={setMobileMode}
      // Map reveal: circle only on success; on failure, no answer is revealed
      mapRevealMode={canAdvance ? "circle" : "marker"}
      mapRevealCircleKm={canAdvance ? radiusKm : null}
      mapRevealShowAnswer={canAdvance && reveal}
    />
  );
}
