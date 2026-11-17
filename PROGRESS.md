# Progress

Claude Code: work top to bottom. Tick a step only when every "Done when" item is true and `npm run build` passes.
Owner legend: CC = Claude Code · App = Claude app (browser) · Me = human.

## Steps

- [x] **0. Plan in repo** (App) — `PLAN.md` exists.

- [ ] **1. Project setup** (CC)
  - Done when: Vite + TS strict + Three.js project runs with `npm run dev`; a box kart sits on a large plane with lighting; `npm run build` passes; folder layout from `CLAUDE.md` exists; `src/config/tuning.ts` exists.

- [ ] **2. Free assets** (App — runs in parallel, not blocking)
  - Done when: the human has downloaded assets into `public/assets/` (or says to skip). Prompt: `docs/WEB_TASKS.md` → Task A.

- [ ] **3. Kart controls** (CC → `kart-physics`)
  - Done when: ↑↓ accelerate / reverse, ←→ steer, Shift+arrow drift with visible slide, booster gauge fills while drifting, full gauge = 1 booster (max 2), Ctrl fires a booster (speed burst + simple flame effect), instant boost works when ↑ is pressed right after a drift ends, chase camera follows smoothly; all numbers in `tuning.ts`; debug overlay (toggle with F1) shows speed, slip angle, gauge, booster count.

- [ ] **4. Track generator + 8 tracks** (CC → `track-builder`)
  - Done when: tracks load from `src/data/tracks/*.json` (waypoints + width + theme); road, walls and checkpoints are generated from a closed spline; all 8 tracks from `PLAN.md` §4.2 exist with their features (ice = low grip, puddles = slow zones, ramps, forks, moving floors); start grid positions defined; a dev URL param `?track=<id>` loads a track directly.

- [ ] **5. 10 karts** (CC → `kart-physics`)
  - Done when: `src/data/karts.json` holds the 10 karts from `PLAN.md` §4.1; stats map to physics (Practice Kart = baseline, each stat point = ±4% of base value, tunable in `tuning.ts`); kart color comes from data; `?kart=<id>` dev param works.

- [ ] **6. Face pipeline** (CC → `face-pipeline`)
  - Done when: `@mediapipe/tasks-vision` installed; model file fetched by `npm run fetch-models` into `public/models/`; a photo (file or webcam) produces an aligned, masked 256×256 face PNG; it is applied as a decal on a big round head on the kart driver; failure (no face / side face) returns a clear error message.

- [ ] **7. Screens** (CC → `ui-screens`)
  - Done when: Title → Lobby → (Garage, Face registration) → Track select → Loading → Race HUD → Results → Retry / Lobby all work by keyboard and mouse; settings screen remaps keys; selections, faces and records persist in localStorage.

- [ ] **8. AI + race flow** (CC → `race-ai`)
  - Done when: 3-2-1 countdown; up to 7 AI karts follow the racing line with stats from `karts.json` and use boosters; lap counting via checkpoints (no shortcut cheating), live positions, lap times, best-time records per track; 1st-place face close-up on Results; AI karts can wear saved faces.

- [ ] **9. Polish** (CC)
  - Done when: assets from `public/assets/` replace primitives where available; sound effects (engine, drift, boost, countdown); boost / drift particles; no console errors in a full race on every track.

- [ ] **10. Final QA** (App + Me)
  - Done when: Claude app ran `docs/WEB_TASKS.md` Task B on every screen and track; the human drove every track; all reported bugs fixed.

## Tuning log

| Date | Value | Old → New | Reason |
| --- | --- | --- | --- |

## Decisions log

Record any choice made without asking (one line each).
