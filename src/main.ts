import * as THREE from 'three';
import { TUNING } from './config/tuning';
import * as input from './core/input';
import { startLoop } from './core/loop';
import { KartController, makeKartParams, type KartControls } from './kart/KartController';
import { KartVisual } from './kart/KartVisual';
import { ChaseCamera } from './kart/ChaseCamera';
import { DebugOverlay } from './kart/DebugOverlay';

const container = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(TUNING.camera.fov, window.innerWidth / window.innerHeight, 0.1, 3000);

scene.add(new THREE.HemisphereLight(0xffffff, 0x445522, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 50, 20);
sun.castShadow = true;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(TUNING.world.groundSize, TUNING.world.groundSize),
  new THREE.MeshStandardMaterial({ color: 0x55aa55 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(TUNING.world.groundSize, TUNING.world.groundSize / 10, 0x337733, 0x447744));

// Scattered markers so motion is visible (temporary until the track generator lands).
const { markerCount, markerSpread } = TUNING.world;
const markers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), markerCount);
const m = new THREE.Matrix4();
const col = new THREE.Color();
for (let i = 0; i < markerCount; i++) {
  const h = 0.5 + Math.random() * 2.5;
  m.makeScale(1, h, 1).setPosition((Math.random() * 2 - 1) * markerSpread, h / 2, (Math.random() * 2 - 1) * markerSpread);
  markers.setMatrixAt(i, m);
  markers.setColorAt(i, col.setHSL(Math.random(), 0.7, 0.55));
}
markers.castShadow = true;
scene.add(markers);

const kart = new KartController(makeKartParams());
const visual = new KartVisual(0xe53935);
scene.add(visual.group);
const chase = new ChaseCamera(camera, kart);
const debug = new DebugOverlay(document.getElementById('ui')!);

const axis = (neg: input.Action, pos: input.Action) => (input.isDown(pos) ? 1 : 0) - (input.isDown(neg) ? 1 : 0);

startLoop(
  (dt) => {
    const controls: KartControls = {
      throttle: axis('down', 'up'),
      steer: axis('left', 'right'),
      drift: input.isDown('drift'),
      boostPressed: input.wasPressed('boost'),
      throttlePressed: input.wasPressed('up'),
    };
    kart.update(dt, controls);
    input.endFrame(); // edges consumed by this step
  },
  (_alpha, frameDt) => {
    visual.update(kart, frameDt, performance.now() / 1000);
    chase.update(kart, frameDt);
    debug.update(kart);
    sun.position.set(kart.x + 30, 50, kart.z + 20); // keep shadows around the kart
    sun.target.position.set(kart.x, 0, kart.z);
    renderer.render(scene, camera);
  },
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
