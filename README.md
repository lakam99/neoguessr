# WorldGuessr — Google Maps + Firebase (Loader + Throttle)

- Uses `@googlemaps/js-api-loader` for reliable JS API loading.
- Throttled Street View picking with exponential backoff to avoid 429 tile limits.
- Reuses a single `StreetViewPanorama` instance; updates position instead of remounting.
- Hides street names in Street View (`showRoadLabels: false`).

## Setup
1) Copy `.env.example` → `.env.local`, fill Google + Firebase values.
2) Firebase Console: enable **Auth → Google**; create **Firestore** & publish `firestore.rules`.
3) Run:
```bash
npm install
npm run dev
```
