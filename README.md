# WorldGuessr — Google Maps + Firebase Scoreboard

Full Google Maps + Street View with Firebase Auth + Firestore scoreboard.

## Setup
1) Copy `.env.example` → `.env.local`, fill both **Google Maps** and **Firebase** sections.
2) In Firebase Console:
   - Enable **Auth → Google** provider.
   - Create **Firestore** DB and paste `firestore.rules` to Rules.
3) Run:
```bash
npm install
npm run dev
```

## Env
- `VITE_LOCATION_MODE` = `random` or `country`
- `VITE_COUNTRY` used only when mode=`country`
