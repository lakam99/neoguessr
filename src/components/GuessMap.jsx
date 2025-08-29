import React from "react";

export default function GuessMap({
  googleReady,
  guess,                 // [lat, lng] | null
  answer,                // { lat, lng } | null
  onGuess,
  interactive = true,
  // NEW:
  revealMode = "marker", // "marker" | "circle"
  revealCircleKm = null, // number | null
  className = "w-full h-full",
}) {
  const mapRef = React.useRef(null);
  const map = React.useRef(null);
  const overlays = React.useRef({
    guessMarker: null,
    answerMarker: null,
    line: null,
    circle: null,
  });

  const toLL = (p) => (p ? new google.maps.LatLng(p.lat, p.lng) : null);

  // Init map
  React.useEffect(() => {
    if (!googleReady || !mapRef.current || map.current) return;
    map.current = new google.maps.Map(mapRef.current, {
      center: { lat: 0, lng: 0 },
      zoom: 2,
      clickableIcons: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    if (interactive && onGuess) {
      map.current.addListener("click", (e) => {
        onGuess([e.latLng.lat(), e.latLng.lng()]);
      });
    }
  }, [googleReady, interactive, onGuess]);

  // Draw guess marker
  React.useEffect(() => {
    if (!googleReady || !map.current) return;

    // clear old guess marker
    if (overlays.current.guessMarker) {
      overlays.current.guessMarker.setMap(null);
      overlays.current.guessMarker = null;
    }

    if (Array.isArray(guess)) {
      overlays.current.guessMarker = new google.maps.Marker({
        map: map.current,
        position: new google.maps.LatLng(guess[0], guess[1]),
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#22c55e", // emerald-500
          fillOpacity: 1,
          strokeColor: "#064e3b",
          strokeWeight: 2,
        },
        clickable: false,
      });
    }
  }, [googleReady, guess]);

  // Draw reveal: marker+line OR circle
  React.useEffect(() => {
    if (!googleReady || !map.current) return;

    // clear previous reveal overlays
    ["answerMarker", "line", "circle"].forEach((k) => {
      if (overlays.current[k]) {
        overlays.current[k].setMap?.(null);
        overlays.current[k] = null;
      }
    });

    const bounds = new google.maps.LatLngBounds();

    // include guess
    if (Array.isArray(guess)) {
      bounds.extend(new google.maps.LatLng(guess[0], guess[1]));
    }

    if (answer) {
      const ansLL = toLL(answer);

      if (revealMode === "circle" && revealCircleKm && revealCircleKm > 0) {
        // Circle only (no pin, no line)
        overlays.current.circle = new google.maps.Circle({
          map: map.current,
          center: ansLL,
          radius: revealCircleKm * 1000, // meters
          strokeColor: "#60a5fa",        // blue-400
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.15,
          clickable: false,
        });

        // Expand bounds to encompass the circle (N/E/S/W approx)
        const R = 6371; // km
        const d = revealCircleKm / R;
        const lat = (answer.lat * Math.PI) / 180;
        const lng = (answer.lng * Math.PI) / 180;
        const pts = [
          { lat: Math.asin(Math.sin(lat + d)), lng },                   // N
          { lat, lng: lng + d / Math.cos(lat) },                        // E
          { lat: Math.asin(Math.sin(lat - d)), lng },                   // S
          { lat, lng: lng - d / Math.cos(lat) },                        // W
        ].map((p) => ({ lat: (p.lat * 180) / Math.PI, lng: (p.lng * 180) / Math.PI }));
        pts.forEach((p) => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
      } else {
        // Default: show exact answer marker and line to guess
        overlays.current.answerMarker = new google.maps.Marker({
          map: map.current,
          position: ansLL,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: "#60a5fa",
            fillOpacity: 1,
            strokeColor: "#1e3a8a",
            strokeWeight: 2,
          },
          clickable: false,
        });

        if (Array.isArray(guess)) {
          overlays.current.line = new google.maps.Polyline({
            map: map.current,
            path: [new google.maps.LatLng(guess[0], guess[1]), ansLL],
            strokeColor: "#94a3b8", // slate-400
            strokeOpacity: 0.9,
            strokeWeight: 2,
            geodesic: true,
            clickable: false,
          });
        }

        bounds.extend(ansLL);
      }
    }

    // Fit bounds if something to show
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
      // Prevent over-zoom on very small circles
      if (revealMode === "circle") {
        const z = map.current.getZoom?.();
        if (z && z > 12) map.current.setZoom(12);
      }
    }
  }, [googleReady, answer, guess, revealMode, revealCircleKm]);

  return <div ref={mapRef} className={className} />;
}
