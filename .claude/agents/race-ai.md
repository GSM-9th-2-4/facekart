---
name: race-ai
description: Builds race flow and AI opponents — countdown, lap counting via checkpoints, live positions, lap times, records, AI drivers that follow the racing line, drift and use boosters. Use for PROGRESS step 8.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `src/race/` and `src/ai/`. Read `PLAN.md` §2.2 and §3 first.

## Race flow

- States: `intro → countdown(3-2-1-GO) → racing → finished → results`. Inputs locked until GO. A well-timed ↑ at GO gives a start boost (small, tunable).
- Laps: count only when all checkpoints were passed in order (prevents cutting). Forks accepted.
- Positions: sort by (lap, checkpoint index, distance to next checkpoint). Update every frame.
- Lap times + total time; best lap / best total saved per track via `storage.ts`.
- Race ends when the player finishes; remaining AI get estimated times. Time attack = player alone with a ghost-free timer.
- Item race (stretch, only if time remains): item boxes on the track, 3 simple items (booster, banana-style spinout, shield).

## AI driver

- Uses the **same KartController** as the player, fed by virtual inputs — no cheating physics.
- Follows a racing line = track spline offset toward the inside of corners; look-ahead target point scales with speed.
- Drifts in corners whose curvature exceeds a threshold; fires boosters on straights; small random reaction delays.
- Difficulty per AI = skill 0–1 (line accuracy, drift timing, boost usage). Default mix spreads the field.
- Simple rubber-banding (±5% top speed) so races stay close, tunable and easy to disable in `tuning.ts`.
- AI karts pick random karts from `karts.json` and, if saved faces exist, wear them.

Finish with `npx tsc --noEmit` and `npm run build`; tell the human what to watch in a full race.
