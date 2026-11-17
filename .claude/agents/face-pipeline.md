---
name: face-pipeline
description: Builds the in-browser face pipeline — MediaPipe Face Landmarker, alignment, crop, mask and the head texture applied to the driver. Use for PROGRESS step 6 and any face-related change.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `src/face/`. Read `PLAN.md` §5 first.

## Setup

- `npm i @mediapipe/tasks-vision`.
- Add `npm run fetch-models` (a small Node script in `scripts/`) that downloads `face_landmarker.task` into `public/models/` with a progress message, and skips if the file already exists. Add `public/models/*.task` to `.gitignore`.
- Load the WASM files from the installed package (copy them to `public/mediapipe/` in the fetch script, or use the package's CDN path as a fallback).

## Pipeline (`buildFaceTexture(source: HTMLImageElement | HTMLVideoElement | ImageBitmap) => Promise<FaceResult>`)

1. Run FaceLandmarker in IMAGE mode (create once, reuse).
2. No face → `{ ok: false, reason: 'no-face' }`. Estimate yaw from landmarks (nose vs. cheek distance); too far sideways → `reason: 'turn-to-front'`. Multiple faces → use the largest.
3. Align: rotate so the eye line is horizontal, scale so inter-eye distance is fixed, center between eyes and mouth.
4. Mask: polygon from the face-oval landmarks, slightly expanded, feathered edge (blur the mask on a canvas).
5. Optional tone step (toggle): slight saturation boost + posterize for a cartoon look.
6. Output a 256×256 PNG data URL with transparent background + the landmark-based bounding info.

## Applying to the character (Lv1)

- Driver = big round head (sphere, bobblehead proportions) on a simple body seated in the kart.
- Face texture as a decal on the front hemisphere (a separate slightly larger sphere segment, or a `DecalGeometry`), the rest of the head skin-colored (sample skin tone from the cheek area).
- Expose `applyFaceToDriver(driverMesh, faceDataUrl)` for player and AI karts.

## UI hooks for ui-screens

Export: `startWebcam()`, `captureFrame()`, `buildFaceTexture()`, error-reason → human-readable message map.

Keep everything client-side; never upload photos anywhere. Finish with `npx tsc --noEmit` and `npm run build`; tell the human to test with a photo from `test-photos/`.
