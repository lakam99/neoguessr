# WorldGuessr — Google Maps + Firebase (Low-Quota)

- Loader: `@googlemaps/js-api-loader`
- Map ID support (Advanced Markers)
- Street View search is **budgeted + backoff**; land-biased sampling by default
- Low quota mode (`VITE_LOW_QUOTA_MODE=true`): curated pool for near-zero lookups
- Street names hidden in Street View
- Firebase Auth + Firestore leaderboard

## Setup
1) Copy `.env.example` → `.env.local`, fill keys.
2) Firebase: enable **Auth → Google**, create Firestore, publish `firestore.rules`.
3) Run:
```bash
npm install
npm run dev
```
