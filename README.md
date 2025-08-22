# WorldGuessr — Google Maps + Firebase (Tailwind build)

Fixes:
- Tailwind via PostCSS (no CDN warning in prod)
- Google Maps loader best-practices (&loading=async + importLibrary)
- Uses AdvancedMarkerElement (no deprecation warning)

## Setup
1) Copy `.env.example` → `.env.local`, fill **Google Maps** and **Firebase** values.
2) Firebase Console:
   - Enable **Authentication → Google** provider (or the provider you plan to use).
   - Create **Firestore**; paste `firestore.rules` and **Publish**.
3) Install & run:
   ```bash
   npm install
   npm run dev
   ```
4) Production build:
   ```bash
   npm run build
   npm run preview
   ```
