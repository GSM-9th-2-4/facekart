---
name: kart-physics
description: Builds and tunes the kart controller — arcade physics, KartRider-style drift, booster gauge, instant boost, chase camera, and mapping kart stats from karts.json. Use for PROGRESS steps 3 and 5 and for any /tune handling feedback.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `src/kart/` and `src/config/tuning.ts`. Read `PLAN.md` §2 and §4.1 first.

## Goal

Handling must feel like KartRider: grippy normal driving, long controllable drifts, a gauge that rewards drifting, punchy boosters.

## Model (custom arcade physics, fixed timestep 60 Hz)

- State per kart: position, heading (yaw), velocity vector, speed, slip angle, isDrifting, gauge (0–1), boosterStock (0–2), boostTimer, instantBoostWindow.
- **Normal driving:** velocity direction converges quickly to heading (high lateral grip). Steering rate scales down at very low speed.
- **Drift (Shift held while steering):** heading rotates faster than velocity direction; slip angle builds toward `maxDriftAngle`; lateral grip drops to `driftGrip`; speed decays by `driftSpeedLoss` per second. Counter-steer reduces slip angle.
- **Gauge:** while drifting, `gauge += dt * gaugeRate * (speed / topSpeed) * (slip / maxDriftAngle)`. At 1.0: `boosterStock = min(2, stock + 1)`, gauge resets.
- **Drift end:** grip ramps back over `gripRecoveryTime`; velocity realigns to heading. Opens `instantBoostWindow` (start ~0.25 s).
- **Instant boost:** ↑ pressed (edge) inside the window → short burst (`instantBoostPower`, `instantBoostTime`).
- **Booster (Ctrl edge, stock > 0):** top speed × `boostTopSpeedMul` and strong forward accel for `boostTime` (~1.2 s). Boosting again while boosting refreshes the timer.
- **Surface:** read a `gripMul` / `speedMul` from the track surface under the kart (ice, puddles) — expose a function the track module can feed.
- **Walls:** reflect velocity along the wall normal with speed loss `wallSpeedLoss`; no tunneling (substep or raycast).
- **Camera:** chase cam behind and above, lerped position, slight FOV increase while boosting, slight lag in drifts so the slide is visible.

All numbers above are named constants in `tuning.ts` with comments. Starting values are guesses — make them sensible, then expect human tuning.

## Kart stats (step 5)

- `karts.json` entries: `id, name, tier, color, stats {topSpeed, accel, cornering, boostCharge}` (1–10).
- Practice Kart (all 5) = baseline. Each point = ±`statStepPct` (default 4%) of the base value: topSpeed → max speed, accel → acceleration, cornering → steer rate + drift grip, boostCharge → gaugeRate.
- Same code path for player and AI karts.

## Debug

F1 toggles an overlay: speed, slip angle, gauge, booster stock, surface, active timers.

## When handling feedback comes in

Translate the human's words into specific constants, change only those in `tuning.ts`, log old → new in `PROGRESS.md` "Tuning log". Prefer small steps (10–25%).

Finish by running `npx tsc --noEmit` and `npm run build`, then report what changed and exactly what the human should test.
