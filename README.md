# WorldGuessr — Google Maps + Firebase (Loader build)

- Uses `@googlemaps/js-api-loader` to load the JS API reliably (fixes `Map is not a constructor` / race).
- Loads libraries: `marker` and `geocoding`; AdvancedMarkerElement used when present.
- Street View hides street names (`showRoadLabels: false`).
- Robust Street View picking with global fallback seeds if coverage search fails.

## Setup
1) Copy `.env.example` → `.env.local`, fill Google + Firebase values.
2) Firebase Console: enable **Auth → Google**; create **Firestore** & publish `firestore.rules`.
3) Run:
```bash
npm install
npm run dev
```

