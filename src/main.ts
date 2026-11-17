import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createKart, KART_DESIGNS, type KartDesign } from './kart/KartModel';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc8ff);
// env map so chrome / clearcoat paint have something to reflect
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
scene.fog = new THREE.Fog(0x8fc8ff, 30, 120);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
camera.position.set(3.2, 2.2, 3.6);
const cam = new URLSearchParams(location.search).get("cam"); // dev: ?cam=x,y,z for screenshots
if (cam) camera.position.fromArray(cam.split(",").map(Number));
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x557744, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(5, 10, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x6f9a5a }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// dev: ?design=bubble picks the starting design
let di = Math.max(0, KART_DESIGNS.indexOf(new URLSearchParams(location.search).get('design') as KartDesign));
let kart = createKart(0xe8322b, KART_DESIGNS[di]);
scene.add(kart.root);

// Preview: C cycles color, V cycles design; wheels roll and steer so the rig is visibly working.
const colors = [0xe8322b, 0x2b7be8, 0xf5c518, 0x2fbf5a, 0x9b3be8, 0xf2f2f2];
let ci = 0;
addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') kart.setColor(colors[++ci % colors.length]);
  if (e.code === 'KeyV') {
    scene.remove(kart.root);
    kart = createKart(colors[ci % colors.length], KART_DESIGNS[++di % KART_DESIGNS.length]);
    scene.add(kart.root);
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const steer = Math.sin(t * 0.8) * 0.4;
  kart.frontWheels.forEach((w) => (w.rotation.y = steer));
  kart.wheelSpins.forEach((w) => (w.rotation.x += 0.15));
  kart.steeringWheel.rotation.z = -steer * 1.5;
  controls.update();
  renderer.render(scene, camera);
});
