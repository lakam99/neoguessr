import { loadGoogleMaps } from "../lib/maps.js";

export const KM_PER_EARTH_RADIAN = 6371;
const deg2rad = (d) => (d * Math.PI) / 180;
const rad2deg = (r) => (r * 180) / Math.PI;

export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * KM_PER_EARTH_RADIAN * Math.asin(Math.sqrt(a));
}

export function distanceKm(a, b) {
  return haversine(a.lat, a.lng, b.lat, b.lng);
}

export function offsetLatLng(lat, lng, distanceKm, bearingDeg) {
  const R = KM_PER_EARTH_RADIAN; // km
  const br = deg2rad(bearingDeg);
  const lat1 = deg2rad(lat);
  const lng1 = deg2rad(lng);
  const dr = distanceKm / R; // angular distance

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: rad2deg(lat2), lng: rad2deg(lng2) };
}

// Conservative land bounding boxes (roughly covers major landmasses)
const LAND_BOXES = [
  // North America
  [7, -168, 70, -52],
  // South America
  [-56, -82, 13, -34],
  // Europe
  [36, -10, 71, 40],
  // Africa
  [-35, -17, 37, 51],
  // Middle East
  [12, 26, 42, 60],
  // Asia
  [0, 60, 60, 150],
  // Australia
  [-44, 112, -10, 154],
  // NZ
  [-47, 166, -34, 179],
];

function rndBetween(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export async function findStreetViewNear(google, lat, lng, searchRadii = [0, 1500, 3000, 5000, 10000], throttleMs = 250) {
  const sv = new google.maps.StreetViewService();
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  for (const radius of searchRadii) {
    const pano = await new Promise((resolve) => {
      sv.getPanorama({ location: { lat, lng }, radius }, (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data && data.location) resolve(data);
        else resolve(null);
      });
    });
    if (pano && pano.location) {
      const loc = pano.location;
      const pov = pano.tiles?.centerHeading != null ? { heading: pano.tiles.centerHeading, pitch: 0 } : null;
      if (throttleMs) await sleep(throttleMs);
      return { lat: loc.latLng.lat(), lng: loc.latLng.lng(), panoId: loc.pano, pov };
    }
    if (throttleMs) await sleep(throttleMs);
  }
  return null;
}

function randomLandPoint() {
  const [minLat, minLng, maxLat, maxLng] = pick(LAND_BOXES);
  return { lat: rndBetween(minLat, maxLat), lng: rndBetween(minLng, maxLng) };
}

export async function pickTargetWithCoverage(google, { maxTries = 50, throttleMs = 250 } = {}) {
  for (let i = 0; i < maxTries; i++) {
    const seed = randomLandPoint();
    const pano = await findStreetViewNear(google, seed.lat, seed.lng, [0, 1000, 3000, 7000, 15000], throttleMs);
    if (pano) return pano; // {lat,lng,panoId,pov}
  }
  return null;
}

/**
 * Generate a backward trail: start at target (0 km), then add clues at increasing distances away,
 * ensuring each clue has Street View coverage.
 * Returns { target, stages }
 */
export async function generateBackwardTrail(google, {
  distancesKm = [0, 50, 500, 1500],   // 0 = final clue at target
  throttleMs = 250,
  maxBearingTries = 24,
  radiiForRevealKm = [1200, 400, 80, 8], // matched to far->near order for play
} = {}, onProgress = null) {
  function progress(pct, note){ if (onProgress) onProgress({ pct, note }); }
  progress(5, "Selecting target…");
  const target = await pickTargetWithCoverage(google, { throttleMs });
  if (!target) throw new Error("Failed to find Street View coverage for target");

  const clues = [];
  for (let i = 0; i < distancesKm.length; i++) {
    const dist = distancesKm[i];
    if (dist === 0) {
      // final clue at target
      clues.push({ ...target, distanceKm: 0 });
      progress(10 + Math.round((i / distancesKm.length) * 60), "Adding final clue…");
      continue;
    }
    progress(10 + Math.round((i / distancesKm.length) * 60), `Searching clue at ${dist} km…`);
    let found = null;
    let tries = 0;
    while (!found && tries < maxBearingTries) {
      tries++;
      const bearing = rndBetween(0, 360);
      const pt = offsetLatLng(target.lat, target.lng, dist, bearing);
      // Try to snap to nearest pano (limited radius so the clue remains roughly at the intended band)
      found = await findStreetViewNear(google, pt.lat, pt.lng, [0, 2000, 5000, 10000], throttleMs);
    }
    if (!found) {
      // As a last resort, accept the target itself (keeps flow, but shouldn't happen often)
      found = { ...target };
    }
    clues.push({ ...found, distanceKm: dist });
  }

  // Now build stages in PLAY ORDER = far -> near -> target
  const sorted = clues.slice().sort((a, b) => b.distanceKm - a.distanceKm);
  const stages = sorted.map((c, idx) => ({
    order: idx + 1,
    lat: c.lat,
    lng: c.lng,
    panoId: c.panoId || null,
    pov: c.pov || null,
    thresholdKm: [Math.max(5, radiiForRevealKm[idx] || 5), 0], // legacy field if used
    revealRadiusKm: radiiForRevealKm[idx] || 5,
    text:
      idx === sorted.length - 1
        ? "Target confirmed. Close the case."
        : "You've received the following photo to gauge how close you can get to the target before receiving the next clue. Prove your worth.",
  }));

  progress(90, "Trail ready");
  return { target: { lat: target.lat, lng: target.lng }, stages };
}
