# FaceKart — Claude Code instructions

You are building **FaceKart**, a KartRider-style browser kart racer where the character's face comes from a user photo.
The full spec is in `@PLAN.md`. Progress and the step-by-step checklist are in `@PROGRESS.md`. Read both before doing anything.

## How to work

1. Find the first unchecked step in `PROGRESS.md` (or the step the user names).
2. Delegate the work to the matching subagent in `.claude/agents/` (see table below). Do small glue edits yourself.
3. When the step is coded, run the **qa-verifier** subagent. Fix everything it reports before moving on.
4. Check the step's "Done when" criteria. Only then tick the box in `PROGRESS.md`.
5. Commit: `git add -A && git commit -m "step N: <short summary>"`. One commit per step (fix-up commits allowed).
6. End with a short report: what was built, what the human should test (keys to press, what to look for), and whether a Claude app task is due (see `docs/WEB_TASKS.md`).

Never stop halfway through a step to ask about small choices. Pick the option most consistent with `PLAN.md`, note it in the report, and continue. Ask only when the plan truly contradicts itself.

## Subagents

| Agent | Owns |
| --- | --- |
| `kart-physics` | `src/kart/`, `src/config/tuning.ts` — controller, drift, booster gauge, instant boost, camera, kart stats mapping |
| `track-builder` | `src/track/`, `src/data/tracks/` — spline track generator, checkpoints, 8 track JSONs, themes |
| `face-pipeline` | `src/face/` — MediaPipe face landmarker, crop / mask, head texture (Lv1 decal) |
| `ui-screens` | `src/ui/`, `src/core/storage.ts` — Title, Lobby, Garage, Face registration, Track select, Loading, HUD, Results |
| `race-ai` | `src/ai/`, `src/race/` — AI drivers, laps, positions, race flow, records |
| `qa-verifier` | read-only review: typecheck, build, plan compliance, runtime-risk scan |

## Tech rules

- Vite + TypeScript (strict) + Three.js. No backend. `npm run dev` must always work.
- Physics is **custom arcade physics** for the kart (direct control of velocity / heading). Rapier only if collisions really need it.
- Face processing runs in the browser with `@mediapipe/tasks-vision`. The model file goes in `public/models/` (download with curl, don't commit if > 10 MB — add to `.gitignore` and add a `npm run fetch-models` script).
- UI screens are an HTML/CSS overlay on top of the Three.js canvas (no UI framework needed).
- **All tuning numbers live in `src/config/tuning.ts`.** No magic numbers for handling inside other files.
- Data-driven: karts in `src/data/karts.json`, tracks in `src/data/tracks/*.json`. Adding a kart or track must not require code changes.
- Persist selected kart, faces (as small data-URL PNGs, ≤ 256×256) and records in `localStorage` through `src/core/storage.ts` only. Wrap reads/writes in try/catch.
- Primitives first (boxes, spheres, cylinders + theme colors). Swap in glTF assets later when `public/assets/` has them.

## Suggested layout

```
src/
  main.ts
  core/      game loop, input (remappable keys), scene manager, storage
  config/    tuning.ts
  kart/      KartController, drift & booster logic, chase camera, kart visuals (body + head)
  track/     spline generator, checkpoints, themes, scenery
  race/      race state, laps, positions, countdown, results
  ai/        AI driver (waypoint following, uses kart stats)
  face/      landmarker wrapper, crop/mask, texture builder
  ui/        screens/*.ts + styles.css
  data/      karts.json, tracks/*.json
```

## Verification commands

- `npx tsc --noEmit` — must pass (a hook runs it after every TS edit and reports errors to you; fix them right away).
- `npm run build` — must pass before ticking a step.
- You cannot see the screen. For visual / feel checks, tell the human exactly what to test, and point to the Claude app QA prompt in `docs/WEB_TASKS.md`.

## Handling feedback

When the human gives handling feedback (`/tune ...`), change only values in `src/config/tuning.ts` unless the feedback needs new logic. Log every change in the "Tuning log" section of `PROGRESS.md` (old → new, reason).

## Don'ts

- Don't commit anything in `test-photos/`, generated face textures, or `.env` files.
- Don't add multiplayer, accounts, or a backend.
- Don't rewrite working systems while doing an unrelated step.
- Don't `git push --force` or `git reset --hard`.
