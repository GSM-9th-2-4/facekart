# Claude app tasks (browser work)

Claude Code runs in the terminal and can't browse or see the screen. These prompts are for the **Claude app with Claude in Chrome**. Paste a prompt there, then paste the result back into Claude Code.

In Claude Code, `/web-task` prints the right prompt for the current step, filled in.

---

## Task A — Free assets (run during steps 3–8, non-blocking)

```
I'm building a personal, non-distributed browser kart racing game (Three.js, glTF).
Find free assets, preferring CC0 (e.g. Kenney, Quaternius, Poly Pizza; for audio Kenney audio packs or CC0 sounds on Freesound):

1. Low-poly kart / go-kart models (glTF or GLB, or FBX/OBJ I can convert) — 1 to 3 options
2. A simple low-poly character body (a seated or standing figure; the head will be replaced by a big sphere)
3. Track scenery props by theme: village houses, desert cacti/rocks, ice crystals, mine carts/rails, city buildings, pirate harbor (palms, crates, boats), factory (conveyors, pipes)
4. Sound effects: engine loop, drift screech, boost whoosh, countdown beeps, item/pickup, crash, UI click
5. Optional: tileable road / ground textures

For each item give: name, direct page link, license, file format, size. Put CC0 first.
Then download the best pick for each category (ask me before each download) into Downloads/facekart-assets/, keeping one folder per category.
Finish with a summary I can paste to my coding agent: the folder layout and what each file is.
```

After it finishes: in Claude Code, say `move Downloads/facekart-assets into public/assets and use them in step 9` (paste the summary too).

---

## Task B — Localhost QA (run after any step that changes something visible)

Start the game first: `npm run dev` (default http://localhost:5173).

```
Test my local game at http://localhost:5173 in a new tab. You are a QA tester; don't change any code.

1. Read the browser console (errors and warnings) on load and after every action below.
2. Go through every screen that exists: Title → Settings → Lobby → Garage → Face registration → Track select → Loading → Race → Pause → Results. Take a screenshot of each and note anything broken, overlapping, cut off, unreadable, or not responding to clicks / keys.
3. In a race: hold ArrowUp for 3 s, steer with ArrowLeft/ArrowRight, hold Shift while steering to drift, press Control to boost, press F1 for the debug overlay and read its values. Report whether the kart moves, drifts, and whether the gauge and booster count change.
4. Load each track directly: http://localhost:5173/?track=<id> for every track id the game lists, and note geometry problems (holes, kart falling through, walls missing, camera inside objects).

Output ONE message I can paste to my coding agent, formatted exactly like this:

/bug QA report
- [screen or track] problem — steps to reproduce — console error (verbatim, first lines)
- ...
Working fine: <short list>
```

Paste its output straight into Claude Code (it already starts with `/bug`).

---

## Task C — Plan export (done)

`PLAN.md` is already in the repo. If the plan changes in the doc, export it again as Markdown and replace `PLAN.md`.
