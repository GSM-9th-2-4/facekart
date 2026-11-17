// Downloads the MediaPipe face landmarker model and copies the WASM runtime into public/ (both git-ignored).
import { existsSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const modelPath = `${root}public/models/face_landmarker.task`;

cpSync(`${root}node_modules/@mediapipe/tasks-vision/wasm`, `${root}public/mediapipe`, { recursive: true });
console.log('Copied MediaPipe WASM -> public/mediapipe/');

if (existsSync(modelPath)) {
  console.log('face_landmarker.task already present, skipping download.');
} else {
  mkdirSync(`${root}public/models`, { recursive: true });
  console.log(`Downloading face_landmarker.task ...`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(modelPath, buf);
  console.log(`Saved ${(buf.length / 1e6).toFixed(1)} MB -> public/models/face_landmarker.task`);
}
