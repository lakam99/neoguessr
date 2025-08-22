# WorldGuessr — Google Maps Edition

Full Google Maps + Street View version. Configure .env, then run.

## Setup
1) Copy `.env.example` to `.env.local`
2) Set `VITE_GOOGLE_MAPS_API_KEY` to your key (billing must be enabled on Google Cloud).
3) Choose location mode:
   - `VITE_LOCATION_MODE=random`  (worldwide Street View; we sample candidates until we find coverage)
   - `VITE_LOCATION_MODE=country` and set `VITE_COUNTRY=Canada` (or any country name; we geocode its bounds and search within)

## Run locally
```bash
npm install
npm run dev
```

## Build & preview
```bash
npm run build
npm run preview
```

## Notes
- Random picker tries up to ~60 candidates, up to 50km radius to the nearest pano.
- Guess map uses Google Maps; click to place your guess; after reveal the map zooms to show both points.
- Scoring and rounds match the original.
