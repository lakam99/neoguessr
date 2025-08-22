import { Loader } from "@googlemaps/js-api-loader";

let mapsPromise = null;
export function loadGoogleMaps(apiKey){
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google && window.google.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;
  const loader = new Loader({ apiKey, version: "weekly", libraries: ["marker", "geocoding"] });
  mapsPromise = loader.load().then(() => window.google);
  return mapsPromise;
}
