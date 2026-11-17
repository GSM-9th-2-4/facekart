# FaceKart

KartRider-style browser kart racer where your character's face comes from a photo. Personal fun project — not distributed.

Spec: [PLAN.md](PLAN.md) · Progress: [PROGRESS.md](PROGRESS.md)

## Build it with Claude Code

```bash
claude            # open Claude Code in this folder
/autopilot        # builds every step in PROGRESS.md, verifying and committing each one
```

Or one step at a time with `/next`.

| Command | What it does |
| --- | --- |
| `/autopilot` | Build all remaining steps without stopping |
| `/next` | Build the next step only |
| `/step N [notes]` | Do or redo step N |
| `/tune <feedback>` | Apply handling feedback after a test drive |
| `/bug <error or QA report>` | Fix bugs (paste console errors or the Claude app QA report) |
| `/status` | Progress summary |
| `/web-task [A\|B]` | Print the Claude app prompt for browser work (assets, localhost QA) |

Harness: `CLAUDE.md` (rules), `.claude/agents/` (kart-physics, track-builder, face-pipeline, ui-screens, race-ai, qa-verifier), `.claude/commands/`, `.claude/hooks/` (typecheck + data-schema check after every edit, progress summary at session start).

## Run the game

```bash
npm install
npm run fetch-models   # downloads the MediaPipe face model
npm run dev            # http://localhost:5173
```

Put face test photos in `test-photos/` (git-ignored).
