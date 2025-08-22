import React from 'react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function StreetViewStatic({ lat, lng, panoId, heading=0, pitch=15, fov=90, className='' }){
  const size = '640x400'; // renders as 1280x800 with scale=2
  const params = new URLSearchParams({
    size,
    fov: String(fov),
    heading: String(Math.round(heading)),
    pitch: String(Math.round(pitch)),
    source: 'outdoor',
    key: API_KEY
  });
  if (panoId) params.set('pano', panoId);
  else params.set('location', `${lat},${lng}`);
  const url = `https://maps.googleapis.com/maps/api/streetview?${params.toString()}&scale=2`;
  return <img src={url} alt="Street View (static)" className={`w-full h-full object-cover ${className}`} draggable={false} />;
}
