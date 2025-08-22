# WorldGuessr — Google Maps + Firebase (Map ID)

**Fix:** Provides a Map ID so Advanced Markers run without warnings.

- Uses `@googlemaps/js-api-loader` (reliable load)
- `mapId` passed to `new google.maps.Map(...)`
- `VITE_GOOGLE_MAPS_MAP_ID` defaults to `DEMO_MAP_ID` for development
- Throttled Street View search + hidden street names

## Setup
1) Copy `.env.example` → `.env.local` and fill values.
   - Use `DEMO_MAP_ID` to get started, or in Google Cloud Console create a **Map Style** and use its **Map ID** here for production.
2) Firebase Console: enable **Auth → Google**; create **Firestore** & publish `firestore.rules`.
3) Run:
```bash
npm install
npm run dev
```
