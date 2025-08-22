# WorldGuessr — Google Maps + Firebase (v2)

**What’s inside**
- Google Maps JS API via official loader (`@googlemaps/js-api-loader`)
- Street View picker with **budgeted attempts + jittered backoff**, land‑biased sampling, and curated fallback
- Guess map **decoupled** from Street View (clicks never move the pano)
- Hidden street names (`showRoadLabels: false`)
- Scoreboard (public read; auth required to write)
- **Favourites** (auth only) + **Profile** page (edit display name, manage favourites)
- Tailwind via PostCSS (no CDN warnings)

## Setup
1. `cp .env.example .env.local` and fill **Google Maps** and **Firebase** keys.
2. Firebase Console:
   - Enable **Authentication → Google** provider.
   - Create Firestore DB and publish the provided `firestore.rules`.
3. Install & run:
   ```bash
   npm install
   npm run dev
   ```

**Tips**
- Low quota demo: set `VITE_LOW_QUOTA_MODE=true`.
- Keep oceans but reduce load: `VITE_INCLUDE_OCEANS=true`, `VITE_SV_ATTEMPT_BUDGET=4`, `VITE_SV_BASE_BACKOFF_MS=1400`.
