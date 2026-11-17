import * as THREE from 'three';
import { TUNING } from './config/tuning';
import * as input from './core/input';
import { startLoop } from './core/loop';
import { storage } from './core/storage';
import { audio } from './core/audio';
import { KartVisual, DebugOverlay, getKart, DEFAULT_KART_ID, type KartControls } from './kart';
import { applyFaceToHead, createFaceFromImage, startWebcam } from './face';
import { createUi, type HudApi, type RaceSetup, type ScreenName } from './ui';
import { listTracks, getTrackIdFromUrl } from './track';
import { createRaceSession, getDefaultFace, type RaceSession } from './race/session';

const container = document.getElementById('app')!;
const uiRoot = document.getElementById('ui')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
const applySettings = (s: { volume: number; resolutionScale: number }) => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * s.resolutionScale);
  audio.setVolume(s.volume);
};
applySettings(storage.getSettings());

const camera = new THREE.PerspectiveCamera(TUNING.camera.fov, window.innerWidth / window.innerHeight, 0.1, 3000);

// ---- lobby 3D preview: selected kart + face, slowly rotating behind the transparent lobby stage ----
const previewScene = new THREE.Scene();
previewScene.background = new THREE.Color(0x2f7de1);
const previewCam = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
previewCam.position.set(0, 2.6, 7.5);
previewCam.lookAt(0, 1, 0);
previewScene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.4));
const previewSun = new THREE.DirectionalLight(0xffffff, 1.8);
previewSun.position.set(4, 8, 6);
previewScene.add(previewSun);
const turntable = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0xffd23f }));
turntable.position.y = -0.1;
previewScene.add(turntable);
let preview: KartVisual | null = null;

function refreshPreview() {
  if (preview) {
    applyFaceToHead(preview.head, null);
    preview.dispose();
  }
  const kart = getKart(storage.getSelectedKartId() ?? DEFAULT_KART_ID) ?? getKart(DEFAULT_KART_ID)!;
  preview = new KartVisual(storage.getKartColors()[kart.id] ?? kart.color);
  applyFaceToHead(preview.head, storage.getSelectedFace()?.dataUrl ?? getDefaultFace());
  previewScene.add(preview.group);
}

// ---- race session lifecycle ----
let session: RaceSession | null = null;
let hud: HudApi | null = null;
let lastSetup: RaceSetup | null = null;
let paused = false;
let resultsShown = false;
let screen: ScreenName | null = null;
let startToken = 0;
const debug = new DebugOverlay(uiRoot);

function teardown() {
  startToken++; // cancels a start that is still loading
  session?.dispose();
  session = null;
  hud = null;
  paused = false;
  resultsShown = false;
}

// browsers only allow audio after a user gesture
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, () => audio.unlock()); // not once: Esc isn't a valid gesture; unlock() is idempotent

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function startRace(setup: RaceSetup) {
  teardown();
  const token = startToken;
  lastSetup = setup;
  const meta = listTracks().find((t) => t.id === setup.trackId);
  const loading = ui.show('loading', { trackName: meta?.name ?? setup.trackId });
  loading.setProgress(0.15);
  await nextFrame();
  await nextFrame(); // let the loading screen paint before the synchronous build
  if (token !== startToken) return;
  try {
    session = createRaceSession(setup, camera);
  } catch (e) {
    console.error('[race] failed to start', e);
    ui.show('trackSelect');
    return;
  }
  loading.setProgress(1);
  ui.setPaused(false);
  hud = ui.show('hud', { trackName: session.track.meta.name });
  hud.setTrackOutline(session.outline);
  const h = hud;
  session.race.onEvent = (e, r) => {
    if (!r.isPlayer) return;
    if (e === 'lap') h.pop(`LAP ${r.lapTimes.length + 1}`);
    else if (e === 'finalLap') h.pop('FINAL LAP!');
    else if (e === 'finish') h.pop('FINISH!');
    if (e === 'lap' || e === 'finalLap') audio.play('lap');
    else if (e === 'finish') audio.play('finish');
    else if (e === 'startBoost') h.pop('START BOOST!');
  };
}

const ui = createUi({
  root: uiRoot,
  tracks: listTracks(),
  input: { getBindings: input.getBindings, setBindings: input.setBindings, defaultBindings: input.DEFAULT_BINDINGS },
  face: { createFaceFromImage, startWebcam },
  on: {
    onStartRace: (setup) => void startRace(setup),
    onRetry: () => {
      if (lastSetup) void startRace(lastSetup); // startRace resets the paused state
    },
    onLobby: teardown,
    onPauseToggle: (p) => (paused = p),
    onSettingsChanged: applySettings,
    onSelectionChanged: refreshPreview,
    onScreenChange: (name) => {
      screen = name;
      if (name === 'lobby') refreshPreview();
    },
  },
});

// Dev: ?track=<id> skips the menus (with ?kart=<id>); otherwise start at the title screen.
const devTrack = getTrackIdFromUrl();
if (devTrack) {
  const kartParam = new URLSearchParams(location.search).get('kart');
  if (kartParam && !getKart(kartParam)) console.warn(`Unknown kart "${kartParam}", using the selected kart`);
  const kart = getKart(kartParam ?? '') ?? getKart(storage.getSelectedKartId() ?? '') ?? getKart(DEFAULT_KART_ID)!;
  const prefs = storage.getRaceSetup();
  const aiIds = new Set(storage.getAiFaceIds());
  const mode = storage.getMode();
  void startRace({
    trackId: devTrack,
    laps: listTracks().find((t) => t.id === devTrack)?.laps ?? prefs.laps,
    aiCount: mode === 'time' ? 0 : prefs.aiCount,
    mode,
    kartId: kart.id,
    kartColor: storage.getKartColors()[kart.id] ?? kart.color,
    faceDataUrl: storage.getSelectedFace()?.dataUrl ?? null,
    aiFaceDataUrls: storage.getFaces().filter((f) => aiIds.has(f.id)).map((f) => f.dataUrl),
  });
} else {
  ui.show('title');
}

const axis = (neg: input.Action, pos: input.Action) => (input.isDown(pos) ? 1 : 0) - (input.isDown(neg) ? 1 : 0);

startLoop(
  (dt) => {
    if (session && !paused) {
      const controls: KartControls = {
        throttle: axis('down', 'up'),
        steer: axis('left', 'right'),
        drift: input.isDown('drift'),
        boostPressed: input.wasPressed('boost'),
        throttlePressed: input.wasPressed('up'),
      };
      session.step(dt, controls);
    }
    input.endFrame(); // edges consumed by this step (pause key is handled by the UI)
  },
  (_alpha, frameDt) => {
    if (session) {
      session.render(paused ? 0 : frameDt);
      debug.update(session.race.player.ctrl);
      if (hud && screen === 'hud') {
        hud.update(session.hudState());
        hud.setMarkers(session.markers());
      }
      if (session.race.state === 'results' && !resultsShown) {
        resultsShown = true;
        ui.show('results', session.finish());
      }
      renderer.render(session.scene, camera);
    } else if (screen === 'lobby' && preview) {
      preview.group.rotation.y += frameDt * 0.6;
      renderer.render(previewScene, previewCam);
    }
  },
);

window.addEventListener('resize', () => {
  for (const c of [camera, previewCam]) {
    c.aspect = window.innerWidth / window.innerHeight;
    c.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
});
