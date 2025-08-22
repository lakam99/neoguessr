# WorldGuessr v3.2 — Fixed backoff, updated presets, CIA static, difficulty multipliers

## v3.3
- Profile favourites now have a **Preview** toggle showing a static Street View image and a mini map with guess vs answer.
- Extracted shared components: `StreetViewStatic` and `GuessMap`; shared Google Maps loader in `lib/maps.js`.

## v3.4
- **Per-mode leaderboards**: scores are saved under `leaderboards/{mode}/scores`.
- **CIA Top 10** on the menu page (global showcase).
- Game scoreboard now shows **scores for the current mode** only.
- Backwards-compatible write to legacy `/scores` with a `mode` field.
