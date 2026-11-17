// Face pipeline: photo -> aligned, masked 256x256 PNG -> decal on the driver's head (PLAN §5, Lv1).
// Everything stays in the browser; photos are never uploaded.
import * as THREE from 'three';
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FACE_TUNING as T } from '../config/faceTuning';

export type FaceSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
export type FaceResult = { ok: true; dataUrl: string } | { ok: false; error: string };

export const FACE_ERRORS = {
  'no-face': '얼굴을 찾지 못했어요. 얼굴이 잘 보이는 정면 사진으로 다시 시도해 주세요. / No face found. Please retake with a clear, front-facing photo.',
  'turn-to-front': '얼굴이 옆을 보고 있어요. 정면을 바라보고 다시 찍어 주세요. / Face is turned sideways. Please look straight at the camera.',
  'bad-image': '이미지를 읽을 수 없어요. 다른 사진을 골라 주세요. / Could not read the image. Please choose another photo.',
  'model-load': '얼굴 인식 모델을 불러오지 못했어요. `npm run fetch-models` 를 실행했는지 확인해 주세요. / Face model failed to load. Did you run `npm run fetch-models`?',
  camera: '카메라를 켤 수 없어요. 브라우저의 카메라 권한을 확인해 주세요. / Could not start the camera. Please check camera permission.',
} as const;

// MediaPipe 478-point mesh indices.
const L_EYE = [33, 133];
const R_EYE = [263, 362];
const MOUTH = [13, 14];
const NOSE_TIP = 1;
const CHEEK_L = 234;
const CHEEK_R = 454;
// Face-oval ring in order, derived from the connection list (each connection's start).
const OVAL = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.map((c) => c.start);

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    const base = import.meta.env.BASE_URL;
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe`);
      const make = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate },
          runningMode: 'IMAGE',
          numFaces: 4,
        });
      try {
        return await make('GPU');
      } catch {
        return await make('CPU'); // some machines lack WebGL2 for the GPU delegate
      }
    })();
    landmarkerPromise.catch(() => (landmarkerPromise = null)); // allow retry after a failed load
  }
  return landmarkerPromise;
}

function sourceSize(s: FaceSource): [number, number] {
  if (s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight];
  if (s instanceof HTMLVideoElement) return [s.videoWidth, s.videoHeight];
  return [s.width, s.height];
}

type P = { x: number; y: number };
const mid = (pts: P[]): P => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
});

function bbox(pts: P[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export async function createFaceFromImage(
  source: FaceSource,
  opts: { cartoon?: boolean } = {},
): Promise<FaceResult> {
  const [w, h] = sourceSize(source);
  if (!w || !h) return { ok: false, error: FACE_ERRORS['bad-image'] };

  let landmarker: FaceLandmarker;
  try {
    landmarker = await getLandmarker();
  } catch (e) {
    console.error('[face] landmarker load failed', e);
    return { ok: false, error: FACE_ERRORS['model-load'] };
  }

  let faces: NormalizedLandmark[][];
  try {
    faces = landmarker.detect(source).faceLandmarks;
  } catch (e) {
    console.error('[face] detect failed', e);
    return { ok: false, error: FACE_ERRORS['bad-image'] };
  }
  if (!faces.length) return { ok: false, error: FACE_ERRORS['no-face'] };

  // Pixel coords; with several faces keep the largest oval.
  const toPx = (lm: NormalizedLandmark[]) => lm.map((p) => ({ x: p.x * w, y: p.y * h }));
  const area = (pts: P[]) => {
    const b = bbox(OVAL.map((i) => pts[i]));
    return (b.maxX - b.minX) * (b.maxY - b.minY);
  };
  const pts = faces.map(toPx).sort((a, b) => area(b) - area(a))[0];

  if (Math.abs(estimateYaw(pts)) > T.maxYaw) return { ok: false, error: FACE_ERRORS['turn-to-front'] };

  return { ok: true, dataUrl: renderFace(source, pts, opts.cartoon ?? T.cartoon) };
}

/** -1..1: 0 when the nose sits midway between the cheeks. */
export function estimateYaw(pts: P[]): number {
  const dl = Math.abs(pts[NOSE_TIP].x - pts[CHEEK_L].x);
  const dr = Math.abs(pts[CHEEK_R].x - pts[NOSE_TIP].x);
  return (dl - dr) / (dl + dr || 1);
}

function renderFace(source: FaceSource, pts: P[], cartoon: boolean): string {
  const S = T.size;
  const le = mid(L_EYE.map((i) => pts[i]));
  const re = mid(R_EYE.map((i) => pts[i]));
  const angle = Math.atan2(re.y - le.y, re.x - le.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rot = (p: P): P => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });

  // Rotated (eye line level) oval, expanded around its center.
  const ovalR = OVAL.map((i) => rot(pts[i]));
  const ob = bbox(ovalR);
  const oc = { x: (ob.minX + ob.maxX) / 2, y: (ob.minY + ob.maxY) / 2 };
  const span = Math.max(ob.maxX - ob.minX, ob.maxY - ob.minY) * T.ovalExpand;
  const eyeDist = Math.hypot(re.x - le.x, re.y - le.y);
  const scale = Math.min(T.eyeDistancePx / eyeDist, (S * T.maxFaceSpan) / span);
  // Horizontal center: between the eyes and mouth (face midline); vertical: oval center so chin/forehead fit.
  const mc = rot(mid([le, re, mid(MOUTH.map((i) => pts[i]))]));
  const center = { x: mc.x, y: oc.y };
  const toOut = (p: P): P => ({ x: (p.x - center.x) * scale + S / 2, y: (p.y - center.y) * scale + S / 2 });

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(S / 2, S / 2);
  ctx.scale(scale, scale);
  ctx.translate(-center.x, -center.y);
  ctx.rotate(-angle);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (cartoon) toneCartoon(ctx, S);

  // Feathered mask from the expanded oval polygon.
  const mask = document.createElement('canvas');
  mask.width = mask.height = S;
  const mctx = mask.getContext('2d')!;
  mctx.filter = `blur(${T.featherPx}px)`; // shortcut: needs canvas filter support (Safari 18+), older Safari gets a hard edge
  mctx.fillStyle = '#fff';
  mctx.beginPath();
  ovalR.forEach((p, i) => {
    const q = toOut({ x: oc.x + (p.x - oc.x) * T.ovalExpand, y: oc.y + (p.y - oc.y) * T.ovalExpand });
    if (i === 0) mctx.moveTo(q.x, q.y);
    else mctx.lineTo(q.x, q.y);
  });
  mctx.closePath();
  mctx.fill();

  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  return canvas.toDataURL('image/png');
}

function toneCartoon(ctx: CanvasRenderingContext2D, S: number) {
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const step = 255 / (T.posterizeLevels - 1);
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    for (let c = 0; c < 3; c++) {
      const v = l + (d[i + c] - l) * T.saturation;
      d[i + c] = Math.round(Math.min(255, Math.max(0, v)) / step) * step;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export async function startWebcam(video: HTMLVideoElement): Promise<() => void> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (e) {
    console.error('[face] getUserMedia failed', e);
    throw new Error(FACE_ERRORS.camera);
  }
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  return () => {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
}

/** Plain cartoon face (transparent PNG data URL) for drivers without a photo. */
export function makeDefaultHeadTexture(): string {
  const S = T.size;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#222';
  for (const x of [0.38, 0.62]) {
    ctx.beginPath();
    ctx.ellipse(S * x, S * 0.45, S * 0.035, S * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#222';
  ctx.lineWidth = S * 0.025;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(S / 2, S * 0.56, S * 0.12, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,0.35)';
  for (const x of [0.3, 0.7]) {
    ctx.beginPath();
    ctx.arc(S * x, S * 0.58, S * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  return c.toDataURL('image/png');
}

const DECAL = 'faceDecal';

/** Average opaque color of two cheek patches in the aligned face image, or null if transparent there. */
function sampleSkin(img: HTMLImageElement): THREE.Color | null {
  const S = 32;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, S, S);
  let r = 0, g = 0, b = 0, n = 0;
  for (const x0 of [8, 21]) {
    const d = ctx.getImageData(x0, 18, 3, 3).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
  }
  return n ? new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace) : null;
}

/**
 * Lv1: puts the face as a curved decal patch on the +Z (forward) side of a sphere head and tints the head with the
 * sampled skin tone. `null` removes the decal and restores the head's original material.
 */
export function applyFaceToHead(head: THREE.Mesh, dataUrl: string | null): void {
  const old = head.getObjectByName(DECAL) as THREE.Mesh | undefined;
  if (old) {
    head.remove(old);
    old.geometry.dispose();
    const m = old.material as THREE.MeshStandardMaterial;
    m.map?.dispose();
    m.dispose();
  }
  const ud = head.userData as { faceOrigMaterial?: THREE.Material | THREE.Material[] };
  if (ud.faceOrigMaterial) {
    (head.material as THREE.Material).dispose();
    head.material = ud.faceOrigMaterial;
    delete ud.faceOrigMaterial;
  }
  if (!dataUrl) return;

  head.geometry.computeBoundingSphere();
  const bs = head.geometry.boundingSphere!;
  const cover = THREE.MathUtils.degToRad(T.decalCoverDeg);
  // Sphere phi = 3π/2 points to -Z; u runs to the viewer's right, so the image isn't mirrored.
  const geo = new THREE.SphereGeometry(bs.radius * T.decalLift, 32, 24, 1.5 * Math.PI - cover / 2, cover, Math.PI / 2 - cover / 2, cover);
  const mat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.8 });
  const decal = new THREE.Mesh(geo, mat);
  decal.name = DECAL;
  decal.position.copy(bs.center);
  decal.rotation.y = Math.PI; // kart local +Z is forward; half-turn keeps the image unmirrored
  decal.visible = false; // until the texture loads
  head.add(decal);

  new THREE.TextureLoader().load(dataUrl, (tex) => {
    if (decal.parent !== head) return tex.dispose(); // replaced/removed while loading
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
    decal.visible = true;

    const skin = sampleSkin(tex.image as HTMLImageElement) ?? new THREE.Color(T.defaultSkin);
    const orig = head.material;
    if (!Array.isArray(orig) && 'color' in orig && orig.color instanceof THREE.Color) {
      // Clone so karts sharing one head material don't all change color.
      const tinted = orig.clone() as THREE.Material & { color: THREE.Color };
      tinted.color.copy(skin);
      ud.faceOrigMaterial = orig;
      head.material = tinted;
    }
  }, undefined, () => console.warn("[face] could not load face texture"));
}
