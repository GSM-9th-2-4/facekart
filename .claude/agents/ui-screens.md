---
name: ui-screens
description: Builds every screen as an HTML/CSS overlay — Title, Settings, Lobby, Garage, Face registration, Track select, Loading, race HUD, Pause, Results — plus localStorage persistence. Use for PROGRESS step 7 and any UI change.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `src/ui/` and `src/core/storage.ts`. Read `PLAN.md` §3 first.

## Structure

- A tiny screen manager: `show(screenId, params)`, each screen = a module with `mount(root, params)` / `unmount()`. One overlay `<div id="ui">` over the canvas.
- Keyboard and mouse both work on every screen (arrows / Enter / Esc + clicks). Esc goes back.
- Visual style: bright, chunky, playful racing-game look (rounded panels, bold numbers). One `styles.css`. Korean or English labels are both fine — use English.

## Screens

| Screen | Must have |
| --- | --- |
| Title | Start, Settings, Quit (Quit = close tab message) |
| Settings | Remap each key (press-to-bind), volume, quality toggle |
| Lobby | 3D preview of the player's driver in the selected kart (slowly rotating), mode select (Speed / Item / Time attack), buttons to Garage, Face, Track select |
| Garage | 10 karts grouped by tier, stat bars (4 stats), color picker, select |
| Face registration | Upload button + webcam capture, preview on the head, error messages from face-pipeline, save up to 8 faces, pick active face, delete |
| Track select | Cards with name, theme color, difficulty stars, personal best; lap count and AI count (0–7) |
| Loading | Track name + random tip |
| HUD | Speed, booster gauge + stock icons (max 2), lap x/y, position, lap times, minimap with dots, countdown, "BOOST!" / "INSTANT BOOST!" pops |
| Pause | Resume, Restart, Lobby |
| Results | Standings, lap times, NEW RECORD badge, 1st-place face close-up, Retry / Lobby |

## Storage (`src/core/storage.ts`)

Typed get/set for: settings, selected kart id + color, faces (data URLs), active face, records per track. Versioned key prefix `facekart.v1.`. try/catch everything; corrupted data → defaults.

Finish with `npx tsc --noEmit` and `npm run build`; list the click path the human should test.
