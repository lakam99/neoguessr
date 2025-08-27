import { loadGoogleMaps } from "../lib/maps.js";

const KM_PER_EARTH_RADIAN = 6371;
const deg2rad = (d) => (d * Math.PI) / 180;
function haversine(lat1, lon1, lat2, lon2) { 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLon/2)**2; 
  return 2 * KM_PER_EARTH_RADIAN * Math.asin(Math.sqrt(a)); 
}

function rndBetween(a, b){ return a + Math.random()*(b-a); }
function offsetLatLng(lat, lng, distanceKm, bearingDeg){
  const R = KM_PER_EARTH_RADIAN; // km
  const br = deg2rad(bearingDeg);
  const lat1 = deg2rad(lat);
  const lon1 = deg2rad(lng);
  const dr = distanceKm / R;
  const lat2 = Math.asin( Math.sin(lat1)*Math.cos(dr) + Math.cos(lat1)*Math.sin(dr)*Math.cos(br) );
  const lon2 = lon1 + Math.atan2(Math.sin(br)*Math.sin(dr)*Math.cos(lat1), Math.cos(dr)-Math.sin(lat1)*Math.sin(lat2));
  return { lat: lat2 * 180/Math.PI, lng: ((lon2*180/Math.PI + 540) % 360) - 180 }; // normalize lon
}

function svGetPanorama(google, options){
  return new Promise((resolve, reject)=>{
    const sv = new google.maps.StreetViewService();
    sv.getPanorama(options, (data, status)=>{
      if (status === google.maps.StreetViewStatus.OK && data && data.location) resolve(data);
      else reject(new Error('No pano'));
    });
  });
}

const DEFAULT_THRESHOLDS = [
  [1000, 500],
  [500, 100],
  [100, 10],
  [10, 5]
];

export async function generateCampaignFromTarget(apiKey, target, options={}){
  const google = await loadGoogleMaps(apiKey);
  const radii = options.radii || [1000, 500, 100, 10]; // km outward (farther first)
  const stageTexts = options.stageTexts || [
    "You've received the following photo to gauge how close you can get to the target before receiving the next clue. Prove your worth.",
    "You've proven you're an asset to this case. We've identified the target to a specific location, can you get it close?",
    "Excellent work so far. The net is closing. Show us how close you can get to the target.",
    "Final approach. Get within 5–10 km to close the case."
  ];
  const svMaxRadiusM = options.svMaxRadiusM || 30000; // keep modest search radius
  const attemptsPerRing = options.attemptsPerRing || 4;
  const throttleMs = options.throttleMs || Number(import.meta.env.VITE_SV_THROTTLE_MS||900);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : ()=>{};

  const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

  const totalSteps = radii.length * attemptsPerRing + 2; // rough estimate
  let doneSteps = 0;
  const progress = (note)=>{ doneSteps++; const pct = Math.min(100, Math.round((doneSteps/totalSteps)*100)); onProgress({ pct, note }); };

  const stages = [];
  progress("Initializing…");

  for (let i=0; i<radii.length; i++){
    const d = radii[i];
    let pano=null;
    for (let attempt=0; attempt<attemptsPerRing && !pano; attempt++){
      const bearing = Math.random()*360;
      const pt = offsetLatLng(target.lat, target.lng, d, bearing);
      try{
        const p = await svGetPanorama(google, { location: pt, radius: svMaxRadiusM, preference: google.maps.StreetViewPreference.NEAREST, source: google.maps.StreetViewSource.OUTDOOR });
        pano = p;
        stages.push({
          order: i+1,
          lat: p.location.latLng.lat(),
          lng: p.location.latLng.lng(),
          panoId: p.location.pano,
          thresholdKm: DEFAULT_THRESHOLDS[i] || [10,5],
          text: stageTexts[i] || stageTexts[stageTexts.length-1]
        });
        progress(`Ring ${i+1}: panorama found`);
      }catch(e){
        progress(`Ring ${i+1}: searching…`);
      }
      await sleep(throttleMs);
    }
    if(!pano){
      const bearing = Math.random()*360;
      const pt = offsetLatLng(target.lat, target.lng, d, bearing);
      stages.push({
        order: i+1,
        lat: pt.lat, lng: pt.lng,
        panoId: null,
        thresholdKm: DEFAULT_THRESHOLDS[i] || [10,5],
        text: stageTexts[i] || stageTexts[stageTexts.length-1]
      });
      progress(`Ring ${i+1}: fallback point`);
      await sleep(throttleMs);
    }
  }

  stages.push({
    order: radii.length+1,
    lat: target.lat, lng: target.lng,
    panoId: null,
    thresholdKm: [5, 0],
    text: "Target confirmed. Close the case."
  });
  progress("Finalizing…");

  return {
    target,
    stages
  };
}
export function distanceKm(a, b){ return haversine(a.lat, a.lng, b.lat, b.lng); }
