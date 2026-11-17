// Dev-only track viewer: /track-preview.html?track=<id>. Orbit camera, checkpoint toggle, click-to-probe surface queries.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildTrack, getTrackIdFromUrl, listTracks, type Track } from './index';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
const hud = document.getElementById('hud')!;

const tracks = listTracks();
const id = getTrackIdFromUrl() ?? tracks[0].id;
const track: Track = buildTrack(id, scene);
const layout = track.debug.layout;

const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 2.4), new THREE.MeshStandardMaterial({ color: 0xff2266 }));
scene.add(ghost);
const gridMarks = track.startGrid.map((g, i) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 8), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x00ff00 : 0xffffff }));
  m.rotation.x = -Math.PI / 2; // cone tip points -Z = kart forward at heading 0
  const holder = new THREE.Group();
  holder.add(m);
  holder.position.set(g.x, track.heightAt(g.x, g.z) + 1, g.z);
  holder.rotation.y = g.heading;
  scene.add(holder);
  return holder;
});

function topDown() {
  const { min, max } = track.minimap;
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  const size = Math.max(max.x - min.x, max.z - min.z);
  controls.target.set(cx, 0, cz);
  camera.position.set(cx, size * 1.1, cz + 1);
}
function startView() {
  const g = track.startGrid[0];
  controls.target.set(g.x, 0, g.z);
  camera.position.set(g.x + Math.sin(g.heading) * 25, 12, g.z + Math.cos(g.heading) * 25);
}
topDown();

let probe = 'click the road to probe';
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
renderer.domElement.addEventListener('dblclick', (e) => {
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
  if (!p) return;
  const s = track.surfaceAt(p.x, p.z);
  const hit = track.collide(p, 0.8);
  probe = `probe (${p.x.toFixed(1)}, ${p.z.toFixed(1)})\n type ${s.type} grip x${s.gripMul} speed x${s.speedMul} push (${s.push.x.toFixed(1)}, ${s.push.z.toFixed(1)}) onRoad ${s.onRoad}\n height ${track.heightAt(p.x, p.z).toFixed(2)}  progress ${track.progressAt(p.x, p.z).toFixed(0)} / ${track.length.toFixed(0)} m\n wall ${hit ? `n(${hit.nx.toFixed(2)}, ${hit.nz.toFixed(2)}) depth ${hit.depth.toFixed(2)}` : 'none'}`;
});

addEventListener('keydown', (e) => {
  if (e.key === 'c') track.debug.checkpoints.visible = !track.debug.checkpoints.visible;
  if (e.key === 't') topDown();
  if (e.key === 's') startView();
  if (e.key === 'g') gridMarks.forEach((m) => (m.visible = !m.visible));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const options = tracks.map((t) => `<option value="${t.id}" ${t.id === id ? 'selected' : ''}>${'★'.repeat(t.difficulty)} ${t.name}</option>`).join('');
function renderHud(extra: string) {
  hud.innerHTML = `<select id="sel">${options}</select>\n${extra}`;
  (document.getElementById('sel') as HTMLSelectElement).onchange = (e) => (location.search = `?track=${(e.target as HTMLSelectElement).value}`);
}
const info = () =>
  `${track.meta.name}  len ${track.length.toFixed(0)} m  laps ${track.meta.laps}  checkpoints ${track.checkpoints.length}  forks ${layout.roads.length - 1}\n` +
  `warnings: ${track.debug.warnings.length ? track.debug.warnings.join('; ') : 'none'}\n` +
  `drag orbit, wheel zoom, dblclick probe | T top-down  S start view  C checkpoints  G grid arrows\n`;
renderHud(info() + probe);
let lastProbe = probe;

const clock = new THREE.Clock();
let gs = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  track.update(dt);
  gs = (gs + 25 * dt) % track.length; // ghost lap at 25 m/s along the centreline
  const sm = layout.sampleAtS(gs);
  ghost.position.set(sm.x, track.heightAt(sm.x, sm.z) + 0.5, sm.z);
  ghost.rotation.y = Math.atan2(-sm.tx, -sm.tz);
  if (probe !== lastProbe) {
    lastProbe = probe;
    renderHud(info() + probe);
  }
  controls.update();
  renderer.render(scene, camera);
});
