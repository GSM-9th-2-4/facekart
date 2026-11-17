// Public track API. Tracks are discovered from src/data/tracks/*.json — adding a JSON needs no code change.
import * as THREE from 'three';
import { TRACK_TUNING as TT } from '../config/trackTuning';
import { TrackLayout, type Checkpoint, type GridSlot, type TrackData } from './geometry';
import { buildCheckpointDebug, buildRoadMeshes } from './meshes';
import { buildScenery } from './scenery';
import { getTheme, type Theme } from './themes';

export type { TrackData, Checkpoint, GridSlot } from './geometry';
export type { Theme } from './themes';

export interface TrackMeta {
  id: string;
  name: string;
  theme: string;
  difficulty: number; // 1-4
  laps: number;
}

export interface Surface {
  gripMul: number;
  speedMul: number;
  push: { x: number; z: number }; // moving-floor velocity, m/s
  onRoad: boolean;
  type: string; // 'road' | 'ice' | 'puddle' | 'moving'
}

export interface Hit {
  nx: number; // unit push-out normal (x/z)
  nz: number;
  depth: number; // metres to move along the normal
}

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

export interface Track {
  meta: TrackMeta;
  theme: Theme;
  length: number; // main-spline length, m
  surfaceAt(x: number, z: number): Surface;
  heightAt(x: number, z: number): number;
  /** Upward launch velocity (m/s) for a kart crossing a ramp lip at `speed`; 0 when not on a lip. */
  rampAt(x: number, z: number, speed: number): number;
  collide(pos: { x: number; z: number }, radius: number): Hit | null;
  startGrid: GridSlot[];
  checkpoints: Checkpoint[];
  racingLine: { x: number; z: number }[];
  progressAt(x: number, z: number): number;
  minimap: { main: { x: number; z: number }[]; forks: { x: number; z: number }[][]; min: { x: number; z: number }; max: { x: number; z: number } };
  obstacles: Obstacle[];
  update(dt: number): void;
  /** Debug helpers (checkpoint planes hidden by default). */
  debug: { checkpoints: THREE.Group; layout: TrackLayout; warnings: string[] };
  dispose(): void;
}

const FILES = import.meta.glob<TrackData>('../data/tracks/*.json', { eager: true, import: 'default' });
const TRACKS: Record<string, TrackData> = {};
for (const d of Object.values(FILES)) TRACKS[d.id] = d;

export function listTracks(): TrackMeta[] {
  return Object.values(TRACKS)
    .map(({ id, name, theme, difficulty, laps }) => ({ id, name, theme, difficulty, laps }))
    .sort((a, b) => a.difficulty - b.difficulty || (a.id === 'practice' ? -1 : b.id === 'practice' ? 1 : 0));
}

export function getTrackIdFromUrl(): string | null {
  const id = new URLSearchParams(location.search).get('track');
  return id && TRACKS[id] ? id : null;
}

export function buildTrack(id: string, scene: THREE.Scene, opts: { lights?: boolean } = {}): Track {
  const data = TRACKS[id];
  if (!data) throw new Error(`Unknown track "${id}". Known: ${Object.keys(TRACKS).join(', ')}`);
  const layout = new TrackLayout(data);
  const warnings = layout.validate();
  for (const w of warnings) console.warn(`[track ${id}] ${w}`);
  const theme = getTheme(data.theme);
  const root = new THREE.Group();
  root.name = `track:${id}`;

  const conveyors = buildRoadMeshes(layout, theme, root);
  buildScenery(layout, theme, root);
  const cpDebug = buildCheckpointDebug(layout);
  root.add(cpDebug);

  // Ground (beach: sand island in a sea)
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
  for (const r of layout.roads)
    for (const s of r.samples) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minZ = Math.min(minZ, s.z);
      maxZ = Math.max(maxZ, s.z);
      minY = Math.min(minY, s.y);
    }
  const groundY = minY - 0.05;
  const island = data.theme === 'beach';
  const pad = TT.scenery.maxOffset + 40;
  const gw = island ? maxX - minX + pad * 2 : 4000;
  const gd = island ? maxZ - minZ + pad * 2 : 4000;
  const groundGeo = new THREE.PlaneGeometry(gw, gd);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 }));
  ground.position.set((minX + maxX) / 2, groundY, (minZ + maxZ) / 2);
  root.add(ground);
  if (island) {
    const seaGeo = new THREE.PlaneGeometry(4000, 4000);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.2, metalness: 0.1 }));
    sea.position.set(ground.position.x, groundY - 0.4, ground.position.z);
    root.add(sea);
  }

  if (opts.lights !== false) {
    root.add(new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity));
    const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
    sun.position.set(100, 200, 60);
    root.add(sun);
  }

  // Factory obstacles: blocks sliding across the road
  const L = layout.main.length;
  const blocks: { s: number; amp: number; period: number; phase: number; size: number; mesh: THREE.Mesh; ob: Obstacle }[] = [];
  const blockMat = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5, metalness: 0.3 });
  for (const zn of layout.zones) {
    if (zn.type !== 'obstacle') continue;
    const p = zn.params ?? {};
    const count = p.count ?? 2;
    const size = p.size ?? TT.obstacle.defaultSize;
    const amp = Math.min((p.amp ?? TT.obstacle.defaultAmp) * layout.main.halfW, layout.main.halfW - size * 0.6);
    for (let i = 0; i < count; i++) {
      const s = (zn.from + ((zn.to - zn.from) * (i + 0.5)) / count) * L;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * 1.2, size), blockMat);
      root.add(mesh);
      blocks.push({ s, amp, period: p.period ?? TT.obstacle.defaultPeriod, phase: i * Math.PI * 0.7, size, mesh, ob: { x: 0, z: 0, radius: size * 0.6 } });
    }
  }
  let time = 0;
  const placeBlocks = () => {
    for (const b of blocks) {
      const sm = layout.sampleAtS(b.s);
      const d = b.amp * Math.sin((time * Math.PI * 2) / b.period + b.phase);
      b.ob.x = sm.x + sm.nx * d;
      b.ob.z = sm.z + sm.nz * d;
      b.mesh.position.set(b.ob.x, sm.y + b.size * 0.6, b.ob.z);
      b.mesh.rotation.y = Math.atan2(-sm.tx, -sm.tz);
    }
  };
  placeBlocks();

  // Scene theme
  const prevBg = scene.background;
  const prevFog = scene.fog;
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
  scene.add(root);

  const xz = (r: { samples: { x: number; z: number }[] }) => r.samples.map((s) => ({ x: s.x, z: s.z }));
  const racingLine = xz(layout.main);
  const obstacles = blocks.map((b) => b.ob);

  return {
    meta: { id: data.id, name: data.name, theme: data.theme, difficulty: data.difficulty, laps: data.laps },
    theme,
    length: L,
    surfaceAt: (x, z) => layout.surfaceAt(x, z),
    heightAt: (x, z) => layout.heightAt(x, z),
    rampAt: (x, z, speed) => layout.rampAt(x, z, speed),
    collide(pos, radius) {
      let hit: Hit | null = layout.collideWalls(pos.x, pos.z, radius);
      for (const o of obstacles) {
        const dx = pos.x - o.x;
        const dz = pos.z - o.z;
        const dist = Math.hypot(dx, dz);
        const depth = radius + o.radius - dist;
        if (depth > 0 && (!hit || depth > hit.depth)) hit = dist > 1e-6 ? { nx: dx / dist, nz: dz / dist, depth } : { nx: 1, nz: 0, depth };
      }
      return hit;
    },
    startGrid: layout.startGrid,
    checkpoints: layout.checkpoints,
    racingLine,
    progressAt: (x, z) => layout.progressAt(x, z),
    minimap: { main: racingLine, forks: layout.roads.filter((r) => !r.isMain).map(xz), min: { x: minX, z: minZ }, max: { x: maxX, z: maxZ } },
    obstacles,
    update(dt) {
      time += dt;
      placeBlocks();
      for (const c of conveyors) {
        c.tex.offset.x = (c.tex.offset.x + c.du * dt) % 1;
        c.tex.offset.y = (c.tex.offset.y + c.dv * dt) % 1;
      }
    },
    debug: { checkpoints: cpDebug, layout, warnings },
    dispose() {
      scene.remove(root);
      const seen = new Set<{ dispose(): void }>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) seen.add(m.geometry);
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
        for (const mt of mats) {
          seen.add(mt);
          for (const v of Object.values(mt)) if (v instanceof THREE.Texture) seen.add(v);
        }
      });
      seen.forEach((d) => d.dispose());
      scene.background = prevBg;
      scene.fog = prevFog;
    },
  };
}
