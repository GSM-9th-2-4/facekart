// Dev page logic for /face-test.html.
import * as THREE from 'three';
import { applyFaceToHead, createFaceFromImage, makeDefaultHeadTexture, startWebcam, type FaceSource } from './index';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const err = $<HTMLParagraphElement>('err');
const out = $<HTMLImageElement>('out');
const video = $<HTMLVideoElement>('cam');
const snapBtn = $<HTMLButtonElement>('snapBtn');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(360, 360);
$('view').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#87b5e0');
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
camera.position.set(0, 0.3, 4); // look at the head's +Z (front) side
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight('#ffffff', '#556', 1.5), new THREE.DirectionalLight('#ffffff', 1.5));
const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ color: '#cccccc' }));
scene.add(head);
renderer.setAnimationLoop((t) => {
  head.rotation.y = Math.sin(t / 1000) * 0.8;
  renderer.render(scene, camera);
});

function show(dataUrl: string | null) {
  out.src = dataUrl ?? '';
  applyFaceToHead(head, dataUrl);
}

async function run(source: FaceSource) {
  err.textContent = 'Processing...';
  const res = await createFaceFromImage(source, { cartoon: $<HTMLInputElement>('cartoon').checked });
  err.textContent = res.ok ? '' : res.error;
  if (res.ok) show(res.dataUrl);
}

$<HTMLInputElement>('file').addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(img.src);
    void run(img);
  };
  img.src = URL.createObjectURL(file);
});

let stop: (() => void) | null = null;
$('camBtn').addEventListener('click', async () => {
  try {
    stop?.();
    stop = await startWebcam(video);
    video.style.display = 'block';
    snapBtn.disabled = false;
  } catch (e) {
    err.textContent = (e as Error).message;
  }
});
snapBtn.addEventListener('click', () => void run(video));
$('defBtn').addEventListener('click', () => show(makeDefaultHeadTexture()));
$('clearBtn').addEventListener('click', () => show(null));
