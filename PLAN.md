# FaceKart — Project Plan

A KartRider-style 3D kart racing game where the player's character face is generated from an uploaded photo.

- **Scope:** personal fun project, never distributed. Single-player + AI opponents. Built in one day by Claude Code.
- **Platform:** browser game (Vite + TypeScript + Three.js). Runs locally with `npm run dev`. No backend server.

---

## 1. Overview

- **Working title:** FaceKart
- **One-liner:** a kart racer where you drive with your own (or a friend's) face.
- **Goal:** drift / booster handling identical to KartRider; character face auto-generated from one photo.
- **Differentiator:** photo-based face customization instead of fixed characters.

---

## 2. Core Features

Controls and race rules follow KartRider exactly. Only the character face is replaced by a photo.

### 2.1 Controls (same as KartRider)

| Input | Action |
| --- | --- |
| ↑ / ↓ | Accelerate / reverse & brake |
| ← / → | Steer |
| Shift + arrow | Drift |
| ↑ right as a drift ends (timing window) | Instant boost ("순간부스터") |
| Ctrl | Use booster / item |

Key bindings must be remappable in Settings.

### 2.2 Racing systems

- Drifting fills the **booster gauge**. A full gauge grants 1 booster. Max 2 boosters stored.
- **Instant boost:** pressing ↑ inside a short window right after a drift ends gives a small speed burst.
- **Drift cutting:** short tap-drifts to keep speed through corners (skill technique).
- Modes: **Speed race** (MVP), **Item race** (stretch), **Time attack**.
- Lap times, minimap, live position.

### 2.3 Face characters

- Upload one frontal photo (or capture from webcam) → face is applied to the character's head automatically.
- Save multiple faces and pick one; put friends' faces on AI opponent karts.
- Stretch ideas: facial expression change on boost / crash / finish, cartoon-style toggle, winner face close-up.

---

## 3. Screens (Lobby → Race)

Every screen below is implemented, not just the race. Results screen returns to the lobby or restarts the same track.

| Order | Screen | Contents |
| --- | --- | --- |
| 1 | Title | Start, Settings (key bindings, sound, resolution), Quit |
| 2 | Lobby | Player character sitting in the selected kart, mode select (Speed / Item / Time attack), menu buttons |
| 2-1 | Garage | Pick one of 10 karts, stat bar comparison, kart color change |
| 2-2 | Face registration | Photo upload / webcam capture, preview, save & select multiple faces |
| 3 | Track select | Track thumbnail, difficulty, personal best, lap count & number of AI opponents |
| 4 | Loading | Track name + tip text |
| 5 | Race | 3-2-1 countdown, HUD (speed, booster gauge & stock, lap, position, minimap), pause menu |
| 6 | Results | Standings, lap times, new-record badge, 1st-place face close-up → Retry / Lobby |

- Selected kart, faces and records persist in browser **localStorage**.
- Multiplayer is out of scope.

---

## 4. Karts and Tracks

10 karts (including the practice kart) and 8 tracks (including the practice track). Karts share one model and differ only by stats and color, so they are cheap; spend time on tracks.

### 4.1 Karts (stats 1–10, initial balance values)

| Tier | Name | Top speed | Acceleration | Cornering | Booster charge | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| High | Solaris | 9 | 8 | 7 | 7 | All-rounder |
| High | Thunder | 10 | 7 | 6 | 7 | Best on straights, hard in corners |
| High | Phantom | 8 | 8 | 9 | 8 | Drift specialist, for skilled players |
| Mid | Blaze | 7 | 6 | 6 | 6 | Speed type |
| Mid | Wind | 6 | 8 | 6 | 6 | Acceleration type, fast recovery after crashes |
| Mid | Circle | 6 | 6 | 8 | 6 | Cornering type |
| Mid | Charger | 6 | 6 | 6 | 8 | Booster-charge type |
| Rookie | Sprinter | 6 | 6 | 5 | 5 | Practice kart + speed |
| Rookie | Drifter | 5 | 6 | 6 | 6 | Practice kart + drift |
| Practice | Practice Kart | 5 | 5 | 5 | 5 | Baseline |

- Stats live in `src/data/karts.json` and map to: max speed, acceleration curve, drift angle / grip, gauge charge rate.
- Tune numbers by test driving. A high-tier kart must not win every track automatically.

### 4.2 Tracks

| # | Name | Theme | Difficulty | Features |
| --- | --- | --- | --- | --- |
| 0 | Practice Track | Flat oval | ★ | Tutorial, drift & instant-boost practice |
| 1 | Village Loop | Village | ★ | Gentle curves, first real track |
| 2 | Desert Canyon | Desert | ★★ | Long straights + hairpins |
| 3 | Ice Cave | Ice | ★★ | Slippery surface (low grip) |
| 4 | Mine Rail | Mine | ★★★ | Narrow roads, jump ramps |
| 5 | City Night | City | ★★★ | Consecutive S-curves, shortcut |
| 6 | Pirate Harbor | Beach | ★★★ | 2 forks, puddles that slow you down |
| 7 | Conveyor Factory | Factory | ★★★★ | Moving floors & obstacles, hardest |

To build 8 tracks in a day: define each track as waypoint JSON (`src/data/tracks/*.json`) and auto-generate road / wall / checkpoint meshes from a spline. Themes only change colors, scenery objects and surface grip.

---

## 5. Face Character Pipeline

Turn one photo into a face texture (PNG) and apply it to the character's head mesh. Everything runs in the browser with MediaPipe; the texture is applied directly to the head.

1. **Input:** frontal photo upload or webcam capture.
2. **Detection & landmarks:** MediaPipe Face Landmarker (478 points) extracts eyes / nose / mouth / face contour. If no face is found, ask for a retake.
3. **Align & crop:** rotate / scale so both eyes are level, crop the face region.
4. **Masking:** build a face mask from the contour landmarks + feathered edges (a matting model can be added later to include hair).
5. **Tone match (optional):** cartoon-style filter or color / brightness correction to fit the game look.
6. **Texture output:** PNG fitted to the head mesh UV template → loaded by the game and applied to the head.

### Face application levels

| Level | Method | Difficulty | Result |
| --- | --- | --- | --- |
| Lv1 (MVP) | Paste the face photo as a decal on the front of a round (big) head | Easy | Funny bobblehead look, fun immediately |
| Lv2 | Warp to the head UV template using landmarks (piecewise affine) | Medium | Wraps naturally around the head shape |
| Lv3 | 3D face reconstruction from the photo (DECA / FLAME family) | Hard | Real 3D face, expression animation possible |

Ship the whole game with Lv1 first; upgrade to Lv2 only if time remains.

---

## 6. Tech Stack

The goal is to finish in one day with Claude Code, so it's a web game instead of Unity: no editor work, everything is code, no server — `npm run dev` runs it.

| Area | Choice | Why |
| --- | --- | --- |
| Game | Vite + TypeScript + Three.js | Claude Code writes everything as code; runs in the browser instantly |
| Kart physics | Custom arcade physics (Rapier only for collisions if needed) | KartRider feel is easier with direct control of speed and angle |
| Face processing | MediaPipe Tasks Vision (`@mediapipe/tasks-vision`, in browser) + Canvas | Face detection / crop in the browser, no server |
| Storage | localStorage | Persist selected kart, faces, records |
| Multiplayer | Out of scope | Not doable in one day |

---

## 7. Repository

Single repo: `GSM-9th-2-4/facekart`.

- `PLAN.md` — this file. `CLAUDE.md` references it.
- `src/data/` — `karts.json`, `tracks/*.json`. Balance / track changes = data edits only.
- Face test photos go in `test-photos/` (git-ignored, never committed).

---

## 8. Build Order (today)

Owner legend: **CC** = Claude Code (terminal) · **App** = Claude app (browser work) · **Me** = the human.

| # | Task | Owner |
| --- | --- | --- |
| 0 | Export this plan as markdown → `PLAN.md` in the repo | App |
| 1 | Vite + TypeScript + Three.js setup, a box kart on an empty plane | CC |
| 2 | Find free assets: kart & character glTF, sound effects, track textures (license + download links) | App |
| 3 | Kart controls: arrows, Shift drift, Ctrl booster, gauge (max 2), instant boost, chase camera | CC |
| 4 | Track generator (waypoint JSON → spline road / walls / checkpoints) + 8 tracks | CC |
| 5 | 10 karts in `karts.json`, wired to physics values | CC |
| 6 | Face: install MediaPipe, download model file, crop / mask → head texture | CC |
| 7 | Screens: Title → Lobby / Garage / Face registration → Track select → HUD → Results | CC |
| 8 | AI opponent karts, laps / positions / records saved | CC |
| 9 | Apply assets from step 2 (downloads → `public/assets`), effects, bug fixes | CC |
| every step | Open `localhost`, screenshot + check console errors → pass results to CC | App (Chrome) |
| every step | Drive it and give handling feedback | Me |

- Browser-only work (search, download, visual check) goes to the Claude app. Anything doable in a terminal (npm install, model download, git) is Claude Code.
- Claude Code and the Claude app are not connected; results from the app (asset links, error logs, screenshot descriptions) are pasted into Claude Code.
- Claude Code can't see the screen, so handling feedback must be concrete, e.g. "speed drops too much after a drift ends".
- If assets are missing or late, finish with primitives (boxes, spheres, cylinders) + theme colors first, swap later.

---

## 9. Risks

The biggest risk is **kart handling feel**, not the face AI.

| Risk | Mitigation |
| --- | --- |
| Drift feel differs from KartRider | Custom arcade physics (control velocity & angle directly); human drives and gives concrete feedback; keep all tuning constants in one file |
| Real face on a cartoon body looks uncanny | Cartoon filter, or lean into the bobblehead (big head) concept |
| Detection fails on side / dark photos | Check face angle from landmarks, ask for a retake |
| Scope creep | Single-player + AI only; multiplayer excluded |

- Never distributed, so copyright is not a concern. If the org repo is public, don't commit assets ripped from the original game — keep the repo private.
- Use friends' photos only with their consent; never commit photos or generated face textures.
