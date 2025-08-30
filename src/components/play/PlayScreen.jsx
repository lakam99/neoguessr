import HeaderBar from "./HeaderBar.jsx";
import PanoPanel from "./PanoPanel.jsx";
import MapPanel from "./MapPanel.jsx";
import StickyActionBar from "./StickyActionBar.jsx";
import DesktopActionRow from "./DesktopActionRow.jsx";
import MobileToggle from "./MobileToggle.jsx";

export default function PlayScreen(props) {
  const {
    label = "Round",
    index = 1,
    max = 5,
    totalScore = 0,
    reveal = false,
    lastResult = null,
    googleReady = false,
    loading = false,
    error = null,
    freezePano = false,
    answer = null,
    text = "Investigate the photo and make your best guess.",
    guess = null,
    onGuess = () => { },
    picking = false,
    onSubmit = () => { },
    onNext = () => { },
    onSaveFavourite = () => { },
    onSaveScore = () => { },
    showSaveScore = false,
    nextLabel = "Next round",
    mapRevealMode = "marker",
    mapRevealCircleKm = null,
    mapRevealShowAnswer = false,
    mobileMode = "pano",
    setMobileMode = () => { },
  } = props;

  const leftBadges = [
    `${label} ${index}/${max}`,
    `Total: ${Math.round(totalScore)} pts`,
  ];
  const resultBadge =
    reveal && lastResult
      ? `${label === "Round" ? "This round" : "This stage"}: ${Math.round(
        lastResult.points
      )} pts · ${Math.round(lastResult.distanceKm)} km`
      : null;

  // NEW: single source of truth for panel heights
  const panelHeightClass = "h-[34vh] lg:h-[70vh]";

  return (
    <div
      className="flex flex-col gap-4 pb-28 lg:pb-0"
      style={{ paddingBottom: "calc(84px + env(safe-area-inset-bottom))" }}
    >
      <HeaderBar
        leftBadges={resultBadge ? [...leftBadges, resultBadge] : leftBadges}
      />

      {/* Mobile view toggle */}
      <MobileToggle mode={mobileMode} onChange={setMobileMode} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pano panel */}
        <div
          className={`lg:col-span-2 ${mobileMode === "pano" ? "block" : "hidden"
            } lg:block`}
        >
          <PanoPanel
            googleReady={googleReady}
            loading={loading}
            error={error}
            picking={picking}
            freezePano={freezePano}
            answer={answer}
            onRetry={null}
            heightClass={panelHeightClass}      /* <-- match MapPanel height */
          />
        </div>

        {/* Map panel */}
        <div
          className={`lg:col-span-1 ${mobileMode === "map" ? "block" : "hidden"
            } lg:block`}
        >
          <MapPanel
            googleReady={googleReady}
            guess={guess}
            answer={mapRevealShowAnswer ? answer : null}
            onGuess={onGuess}
            heightClass={panelHeightClass}
            revealMode={mapRevealMode}
            revealCircleKm={mapRevealCircleKm}
            interactive={!reveal}
          />
        </div>
      </div>

      {/* Sticky action bar on mobile */}
      <StickyActionBar
        leftLabel={`${label} ${index}/${max}`}
        reveal={reveal}
        disabled={!googleReady || !answer || !guess || picking}
        onSubmit={onSubmit}
        onSaveFavourite={onSaveFavourite}
        onNext={onNext}
        picking={picking}
        showSaveFavourite={true}
      />

      {/* Desktop actions remain below */}
      <DesktopActionRow
        reveal={reveal}
        disabledSubmit={!googleReady || !answer || !guess || picking}
        onSubmit={onSubmit}
        onNext={onNext}
        onSaveFavourite={onSaveFavourite}
        nextLabel={nextLabel}
        saveDisabled={false}
        leftMeta={
          <div className="text-sm opacity-80">
            Imagery: Google Street View. Basemap: Google Maps.
          </div>
        }
        showSaveScore={showSaveScore}
        onSaveScore={onSaveScore}
      />
    </div>
  );
}