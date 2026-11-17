---
description: Apply handling feedback from a test drive
argument-hint: <what felt wrong, e.g. "drift ends too slow, booster too weak">
---

The human test-drove the game. Their feedback:

> $ARGUMENTS

Use the `kart-physics` subagent:
1. Map each piece of feedback to specific constants in `src/config/tuning.ts` (or kart stats in `karts.json` if it is about one kart).
2. Change them in small steps (10–25%). Only add new logic if no constant can express the fix.
3. Log every change in `PROGRESS.md` → "Tuning log" (value, old → new, reason).
4. `npx tsc --noEmit`, commit as `tune: <summary>`.

Report the changes as a short table and tell the human what to try again.
