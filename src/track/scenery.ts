// Primitive scenery props scattered beside the track (seeded, so every load looks the same).
// shortcut: primitives only; swap in glTF from public/assets/ when assets exist (step 2 / later).
import * as THREE from 'three';
import { TRACK_TUNING as TT } from '../config/trackTuning';
import type { TrackLayout } from './geometry';
import type { Theme } from './themes';

export function seededRandom(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}-${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.8 });
    matCache.set(key, m);
  }
  return m;
}

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 10),
  pyramid: new THREE.ConeGeometry(0.71, 1, 4),
  rock: new THREE.DodecahedronGeometry(1, 0),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
};

function part(g: THREE.BufferGeometry, m: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  return mesh;
}

let windowTex: THREE.CanvasTexture | null = null;
function windowMaterial(rows: number): THREE.MeshStandardMaterial {
  const key = `win-${rows}`;
  let m = matCache.get(key);
  if (m) return m;
  if (!windowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#15151f';
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = Math.random() < 0.6 ? '#ffd27a' : '#2a2a3a';
        g.fillRect(x * 16 + 4, y * 16 + 4, 8, 9);
      }
    windowTex = new THREE.CanvasTexture(c);
    windowTex.colorSpace = THREE.SRGBColorSpace;
    windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  }
  const t = windowTex.clone();
  t.repeat.set(2, rows);
  m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.9 });
  matCache.set(key, m);
  return m;
}

type Maker = (r: () => number, theme: Theme) => THREE.Object3D;

const MAKERS: Record<string, { near?: boolean; make: Maker }> = {
  tree: {
    make: (r) => {
      const g = new THREE.Group();
      g.add(part(geo.cyl, mat(0x7a4a24), 0.6, 2, 0.6, 0, 1));
      g.add(part(geo.cone, mat(r() < 0.5 ? 0x2e7d32 : 0x388e3c), 3.5, 5, 3.5, 0, 4.2));
      g.scale.setScalar(0.8 + r() * 0.7);
      return g;
    },
  },
  cone: { near: true, make: () => part(geo.cone, mat(0xff6d00), 0.6, 0.9, 0.6, 0, 0.45) },
  house: {
    make: (r) => {
      const g = new THREE.Group();
      const w = 6 + r() * 4;
      const d = 6 + r() * 3;
      const h = 3.5 + r() * 2;
      g.add(part(geo.box, mat([0xf5e6c8, 0xffffff, 0xf0d9a8, 0xe8c4a0][Math.floor(r() * 4)]), w, h, d, 0, h / 2));
      const roof = part(geo.pyramid, mat([0xb23a2a, 0x8d4b2a, 0x3f5f8a][Math.floor(r() * 3)]), w, 3, d, 0, h + 1.5);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w * 0.75, 3, d * 0.75);
      g.add(roof);
      g.add(part(geo.box, mat(0x6d4c41), 1.2, 2.2, 0.2, 0, 1.1, d / 2 + 0.05));
      return g;
    },
  },
  cactus: {
    make: (r) => {
      const g = new THREE.Group();
      const m = mat(0x4f8a3a);
      const h = 3 + r() * 3;
      g.add(part(geo.cyl, m, 0.8, h, 0.8, 0, h / 2));
      g.add(part(geo.cyl, m, 0.5, 1.6, 0.5, 0.7, h * 0.55 + 0.8));
      g.add(part(geo.cyl, m, 0.9, 0.4, 0.4, 0.4, h * 0.55).rotateZ(Math.PI / 2));
      if (r() < 0.6) {
        g.add(part(geo.cyl, m, 0.5, 1.4, 0.5, -0.7, h * 0.4 + 0.7));
        g.add(part(geo.cyl, m, 0.9, 0.4, 0.4, -0.4, h * 0.4).rotateZ(Math.PI / 2));
      }
      return g;
    },
  },
  rock: {
    make: (r, t) => {
      const s = 1.2 + r() * 3;
      const m = part(geo.rock, mat(new THREE.Color(t.ground).multiplyScalar(0.7).getHex()), s, s * (0.5 + r() * 0.4), s * (0.8 + r() * 0.4), 0, s * 0.3);
      m.rotation.set(r(), r() * 6, r());
      return m;
    },
  },
  icespike: {
    make: (r) => {
      const g = new THREE.Group();
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const h = 3 + r() * 9;
        const c = part(geo.cone, mat(0xbfe9ff, 0x1a4a6a), 1 + r(), h, 1 + r(), (r() - 0.5) * 3, h / 2, (r() - 0.5) * 3);
        c.rotation.z = (r() - 0.5) * 0.4;
        g.add(c);
      }
      return g;
    },
  },
  minecart: {
    near: true,
    make: (r) => {
      const g = new THREE.Group();
      g.add(part(geo.box, mat(0x5d4037), 2.4, 1.2, 1.6, 0, 1.0));
      g.add(part(geo.rock, mat(r() < 0.3 ? 0xffc107 : 0x555555), 1.0, 0.5, 0.7, 0, 1.7));
      for (const [x, z] of [[-0.8, -0.85], [0.8, -0.85], [-0.8, 0.85], [0.8, 0.85]]) g.add(part(geo.cyl, mat(0x333333), 0.6, 0.15, 0.6, x, 0.35, z).rotateX(Math.PI / 2));
      g.add(part(geo.box, mat(0x777777), 0.15, 0.1, 8, -0.6, 0.05));
      g.add(part(geo.box, mat(0x777777), 0.15, 0.1, 8, 0.6, 0.05));
      return g;
    },
  },
  beam: {
    near: true,
    make: () => {
      const g = new THREE.Group();
      const m = mat(0x7a5230);
      g.add(part(geo.box, m, 0.5, 5, 0.5, -1.5, 2.5));
      g.add(part(geo.box, m, 0.5, 5, 0.5, 1.5, 2.5));
      g.add(part(geo.box, m, 4, 0.5, 0.6, 0, 5));
      g.add(part(geo.sphere, mat(0xffcc66, 0xffaa33), 0.4, 0.4, 0.4, 0, 4.6));
      return g;
    },
  },
  building: {
    make: (r) => {
      const rows = [3, 6, 10][Math.floor(r() * 3)];
      const h = rows * 5 + r() * 2;
      const w = 10 + r() * 10;
      return part(geo.box, windowMaterial(rows), w, h, w * (0.7 + r() * 0.5), 0, h / 2);
    },
  },
  lamp: {
    near: true,
    make: () => {
      const g = new THREE.Group();
      g.add(part(geo.cyl, mat(0x444444), 0.25, 7, 0.25, 0, 3.5));
      g.add(part(geo.sphere, mat(0xffffff, 0xfff2b0), 0.9, 0.6, 0.9, 0, 7));
      return g;
    },
  },
  palm: {
    make: (r) => {
      const g = new THREE.Group();
      const lean = (r() - 0.5) * 0.5;
      const trunk = part(geo.cyl, mat(0x9c7a4a), 0.5, 7, 0.5, 0, 3.5);
      trunk.rotation.z = lean;
      g.add(trunk);
      const top = new THREE.Vector3(-Math.sin(lean) * 7, Math.cos(lean) * 7, 0);
      for (let i = 0; i < 6; i++) {
        const leaf = part(geo.box, mat(0x2e9e44), 3.6, 0.12, 0.9);
        leaf.position.copy(top);
        leaf.rotation.set(0, (i / 6) * Math.PI * 2, -0.35);
        leaf.translateX(1.6);
        g.add(leaf);
      }
      return g;
    },
  },
  barrel: { near: true, make: (r) => part(geo.cyl, mat(r() < 0.5 ? 0x8d5524 : 0xb71c1c), 1.2, 1.4, 1.2, 0, 0.7) },
  crate: {
    make: (r) => {
      const g = new THREE.Group();
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const c = part(geo.box, mat(0xa1784a), 1.6, 1.6, 1.6, (r() - 0.5) * 2, 0.8 + (i === 2 ? 1.6 : 0), i === 1 ? 1.7 : 0);
        c.rotation.y = r();
        g.add(c);
      }
      return g;
    },
  },
  roller: {
    make: () => {
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) g.add(part(geo.cyl, mat(0x9e9e9e), 0.8, 5, 0.8, 0, 1.2, (i - 2.5) * 1).rotateZ(Math.PI / 2));
      g.add(part(geo.box, mat(0xf2c200), 0.3, 1.2, 6.5, -2.6, 0.6));
      g.add(part(geo.box, mat(0xf2c200), 0.3, 1.2, 6.5, 2.6, 0.6));
      return g;
    },
  },
};

export function buildScenery(layout: TrackLayout, theme: Theme, root: THREE.Group): void {
  matCache.clear(); // fresh materials per build: the previous track's dispose() released them
  windowTex = null;
  const r = seededRandom(layout.data.id);
  const sc = TT.scenery;
  for (const entry of layout.data.scenery ?? []) {
    const maker = MAKERS[entry.kind];
    if (!maker) {
      console.warn(`[track] unknown scenery kind "${entry.kind}"`);
      continue;
    }
    let placed = 0;
    for (let tries = 0; placed < entry.count && tries < entry.count * 8; tries++) {
      const road = layout.roads[Math.floor(r() * layout.roads.length)];
      const sm = road.samples[Math.floor(r() * road.samples.length)];
      const side = r() < 0.5 ? -1 : 1;
      const extra = maker.near ? sc.minOffset + r() * 3 : sc.minOffset + 6 + r() * (sc.maxOffset - sc.minOffset - 6);
      const off = road.halfW + TT.gen.wallThickness + extra;
      const x = sm.x + sm.nx * off * side;
      const z = sm.z + sm.nz * off * side;
      const q = layout.query(x, z);
      if (q.inside || Math.abs(q.p.d) - q.p.road.halfW < sc.minOffset - 0.5) continue;
      const obj = maker.make(r, theme);
      obj.position.set(x, sm.y, z);
      obj.rotation.y = maker.near ? Math.atan2(-sm.tx, -sm.tz) : r() * Math.PI * 2;
      root.add(obj);
      placed++;
    }
  }
}
