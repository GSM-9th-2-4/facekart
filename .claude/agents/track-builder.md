---
name: track-builder
description: Builds the spline-based track generator, checkpoints, themes, scenery and the 8 track JSON files. Use for PROGRESS step 4 and any track or theme change.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `src/track/` and `src/data/tracks/`. Read `PLAN.md` §4.2 first.

## Track data (one JSON per track)

```json
{
  "id": "desert-canyon",
  "name": "Desert Canyon",
  "theme": "desert",
  "difficulty": 2,
  "laps": 3,
  "width": 14,
  "waypoints": [[x, y, z], ...],
  "zones": [{ "type": "ice|puddle|ramp|moving", "from": 0.10, "to": 0.18, "params": {} }],
  "forks": [{ "from": 0.40, "to": 0.52, "waypoints": [[x, y, z], ...] }],
  "scenery": [{ "kind": "cactus", "count": 40 }]
}
```

`from` / `to` are fractions (0–1) along the main spline.

## Generator

- Closed `THREE.CatmullRomCurve3` through the waypoints. Sample evenly; build the road ribbon mesh with correct normals and UVs, curbs on corners, walls (low boxes or extruded strips) on both edges.
- Checkpoints: invisible planes every N meters, ordered. Expose `getProgress(position) -> {lap fraction, index}` for laps / positions / AI.
- Start line + start grid (8 slots, 2 columns) at t = 0.
- Elevation allowed (y in waypoints); ramps launch the kart (expose ramp info to kart physics).
- Surface lookup: `getSurface(position) -> {gripMul, speedMul, type}` for ice and puddles. Moving floors push the kart (`pushVector`).
- Forks: generate a second ribbon that rejoins; checkpoints must accept both paths.
- Themes: a small table of colors (ground, road, wall, sky / fog) and scenery generators built from primitives (houses, cacti, ice spikes, mine carts, buildings with lit windows, palm trees, crates, conveyor rollers). Use glTF from `public/assets/` when present, primitives otherwise.
- Minimap data: 2D projection of the spline for the HUD.

## The 8 tracks

Practice oval, Village Loop, Desert Canyon, Ice Cave, Mine Rail, City Night, Pirate Harbor, Conveyor Factory — features exactly as in `PLAN.md` §4.2. Lengths roughly 45–90 s per lap with the Practice Kart. Make difficulty actually rise (tighter corners, narrower width, more hazards).

## Dev helpers

`?track=<id>` loads a track directly. A free-fly camera (F2) helps check geometry.

Finish with `npx tsc --noEmit` and `npm run build`; report what to look at on each track.
