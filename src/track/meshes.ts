// Road, wall, curb, zone-overlay and start-line meshes generated from a TrackLayout.
import * as THREE from 'three';
import { TRACK_TUNING as TT } from '../config/trackTuning';
import type { Road, TrackLayout, ZoneData } from './geometry';
import type { Theme } from './themes';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roadTexture(theme: Theme): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = hex(theme.road);
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    g.fillStyle = hex(theme.roadLine);
    g.fillRect(4, 0, 4, 128);
    g.fillRect(120, 0, 4, 128);
    g.fillRect(62, 0, 4, 64); // dashed centre line
  });
}

/** Vertex position of a road edge/offset at sample i (y includes ramps on the main road). */
function vtx(layout: TrackLayout, road: Road, i: number, d: number, yOff: number): THREE.Vector3 {
  const sm = road.samples[i];
  const y = sm.y + (road.isMain ? layout.rampHeightAtS(sm.s) : 0) + yOff;
  return new THREE.Vector3(sm.x + sm.nx * d, y, sm.z + sm.nz * d);
}

/** Sample indices covering [i0, i1] on a road, wrapping for closed roads (i1 may exceed n). */
function indexRange(road: Road, sFrom: number, sTo: number): number[] {
  const n = road.samples.length;
  const step = road.length / (road.closed ? n : n - 1);
  let a = Math.round(sFrom / step);
  let b = Math.round(sTo / step);
  if (road.closed && b < a) b += n;
  if (!road.closed) {
    a = Math.max(0, a);
    b = Math.min(n - 1, b);
  }
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(road.closed ? ((i % n) + n) % n : i);
  return out;
}

/** Flat ribbon between lateral offsets d0 < d1. UV: u 0..1 across, v = distance / vTile. */
export function ribbon(layout: TrackLayout, road: Road, idx: number[], d0: number, d1: number, yOff: number, vTile: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  let s = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    if (k > 0) {
      const p = road.samples[idx[k - 1]];
      const q = road.samples[i];
      s += Math.hypot(q.x - p.x, q.z - p.z);
    }
    const a = vtx(layout, road, i, d0, yOff);
    const b = vtx(layout, road, i, d1, yOff);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, s / vTile, 1, s / vTile);
    if (k > 0) {
      const l0 = (k - 1) * 2;
      const r0 = l0 + 1;
      const l1 = k * 2;
      const r1 = l1 + 1;
      index.push(l0, l1, r0, r0, l1, r1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function allIndices(road: Road): number[] {
  const idx = road.samples.map((_, i) => i);
  if (road.closed) idx.push(0); // duplicate first sample so UVs stay continuous across the seam
  return idx;
}

function segments(road: Road): [number, number][] {
  const n = road.samples.length;
  const out: [number, number][] = [];
  for (let i = 0; i < (road.closed ? n : n - 1); i++) out.push([i, (i + 1) % n]);
  return out;
}

function wallGeometry(layout: TrackLayout, road: Road): THREE.BufferGeometry {
  const { wallHeight: h, wallThickness: th } = TT.gen;
  const pos: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  };
  for (const side of [-1, 1]) {
    const dIn = side * road.halfW;
    const dOut = side * (road.halfW + th);
    for (const [i, j] of segments(road)) {
      const A = road.samples[i];
      const B = road.samples[j];
      const mx = (A.x + B.x) / 2 + ((A.nx + B.nx) / 2) * side * (road.halfW + th / 2);
      const mz = (A.z + B.z) / 2 + ((A.nz + B.nz) / 2) * side * (road.halfW + th / 2);
      if (layout.insideOther(mx, mz, road)) continue; // open the wall where a fork joins
      const ai = vtx(layout, road, i, dIn, 0);
      const bi = vtx(layout, road, j, dIn, 0);
      const ao = vtx(layout, road, i, dOut, 0);
      const bo = vtx(layout, road, j, dOut, 0);
      const up = (v: THREE.Vector3) => v.clone().setY(v.y + h);
      const down = (v: THREE.Vector3, sm: typeof A) => v.clone().setY(sm.y - 0.5);
      quad(down(ai, A), down(bi, B), up(bi), up(ai));
      quad(up(ai), up(bi), up(bo), up(ao));
      quad(down(ao, A), up(ao), up(bo), down(bo, B));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function curbGeometry(layout: TrackLayout, road: Road, theme: Theme): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const col: number[] = [];
  const ca = new THREE.Color(theme.curbA);
  const cb = new THREE.Color(theme.curbB);
  const w = TT.gen.curbWidth;
  for (const side of [-1, 1]) {
    const [d0, d1] = side < 0 ? [-road.halfW, -road.halfW + w] : [road.halfW - w, road.halfW];
    for (const [i, j] of segments(road)) {
      const A = road.samples[i];
      if (A.k < TT.gen.curbCurvature) continue;
      const m = vtx(layout, road, i, side * road.halfW, 0);
      if (layout.insideOther(m.x, m.z, road)) continue;
      const a0 = vtx(layout, road, i, d0, 0.03);
      const a1 = vtx(layout, road, i, d1, 0.03);
      const b0 = vtx(layout, road, j, d0, 0.03);
      const b1 = vtx(layout, road, j, d1, 0.03);
      pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
      const c = Math.floor(A.s / 3) % 2 ? ca : cb;
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export interface Conveyor {
  tex: THREE.Texture;
  du: number; // texture offset change per second
  dv: number;
}

const CONVEYOR_TILE = 3; // m per arrow

function arrowTexture(lateral: boolean): THREE.CanvasTexture {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#2b2d31';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#f2c200';
    g.beginPath();
    if (lateral) {
      g.moveTo(14, 8);
      g.lineTo(50, 32);
      g.lineTo(14, 56);
      g.lineTo(14, 42);
      g.lineTo(30, 32);
      g.lineTo(14, 22);
    } else {
      g.moveTo(8, 50);
      g.lineTo(32, 14);
      g.lineTo(56, 50);
      g.lineTo(42, 50);
      g.lineTo(32, 34);
      g.lineTo(22, 50);
    }
    g.fill();
  });
}

function stripeTexture(a: string, b: string): THREE.CanvasTexture {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = a;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = b;
    for (let i = -64; i < 64; i += 32) {
      g.beginPath();
      g.moveTo(i, 64);
      g.lineTo(i + 16, 64);
      g.lineTo(i + 80, 0);
      g.lineTo(i + 64, 0);
      g.fill();
    }
  });
}

function checkerTexture(): THREE.CanvasTexture {
  const t = canvasTex(128, 32, (g) => {
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 4; y++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect(x * 8, y * 8, 8, 8);
      }
  });
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** Build all road-related meshes into `root`. Returns animated conveyor textures. */
export function buildRoadMeshes(layout: TrackLayout, theme: Theme, root: THREE.Group): Conveyor[] {
  const main = layout.main;
  const roadTex = roadTexture(theme);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 });
  const forkMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.8, side: THREE.DoubleSide });
  const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  for (const road of layout.roads) {
    root.add(new THREE.Mesh(ribbon(layout, road, allIndices(road), -road.halfW, road.halfW, 0, road.halfW * 2), road.isMain ? roadMat : forkMat));
    root.add(new THREE.Mesh(wallGeometry(layout, road), wallMat));
    const cg = curbGeometry(layout, road, theme);
    if (cg) root.add(new THREE.Mesh(cg, curbMat));
  }

  // Zone overlays
  const conveyors: Conveyor[] = [];
  const L = main.length;
  const overlay = (zn: ZoneData, mat: THREE.Material, vTile: number) => {
    const lo = (zn.params?.laneMin ?? -1) * main.halfW;
    const hi = (zn.params?.laneMax ?? 1) * main.halfW;
    const g = ribbon(layout, main, indexRange(main, zn.from * L, zn.to * L), lo, hi, 0.02, vTile);
    const m = new THREE.Mesh(g, mat);
    root.add(m);
    return hi - lo;
  };
  const decal = { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 };
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xe6f8ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75, ...decal });
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.8, ...decal });
  const rampTex = stripeTexture('#f2a900', '#222');
  const rampMat = new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.6, ...decal });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
  for (const zn of layout.zones) {
    if (zn.type === 'ice') overlay(zn, iceMat, 10);
    else if (zn.type === 'puddle') overlay(zn, puddleMat, 10);
    else if (zn.type === 'ramp') {
      overlay(zn, rampMat, 4);
      // vertical face under the lip so the drop reads as a jump
      const lip = layout.sampleAtS(zn.to * L - 0.01);
      const h = layout.rampHeightAtS(zn.to * L - 0.01);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(main.halfW * 2, h), lipMat);
      face.position.set(lip.x, lip.y + h / 2, lip.z);
      face.rotation.y = Math.atan2(-lip.tx, -lip.tz);
      root.add(face);
    } else if (zn.type === 'moving') {
      const sp = zn.params?.speed ?? (zn.params?.lateral ? 0 : TT.surface.defaultConveyorSpeed);
      const lat = zn.params?.lateral ?? 0;
      const lateral = Math.abs(lat) > Math.abs(sp);
      const tex = arrowTexture(lateral);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, ...decal });
      const w = overlay(zn, mat, CONVEYOR_TILE);
      tex.repeat.set(lateral ? (w / CONVEYOR_TILE) * Math.sign(lat || 1) : 1, lateral ? 1 : Math.sign(sp || 1));
      if (!lateral) tex.repeat.x = Math.max(1, Math.round(w / CONVEYOR_TILE));
      // displayed = uv*repeat + offset stays fixed for a feature => offset rate = -sign(repeat) * speed / tile
      conveyors.push({ tex, du: lateral ? (-Math.sign(tex.repeat.x) * lat) / CONVEYOR_TILE : 0, dv: lateral ? 0 : (-Math.sign(tex.repeat.y) * sp) / CONVEYOR_TILE });
    }
  }

  // Start line + gantry
  const s0 = layout.sampleAtS(0);
  const heading = Math.atan2(-s0.tx, -s0.tz);
  const start = new THREE.Group();
  start.position.set(s0.x, s0.y, s0.z);
  start.rotation.y = heading;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(main.halfW * 2, 2), new THREE.MeshStandardMaterial({ map: checkerTexture(), ...decal }));
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.03;
  start.add(line);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const postGeo = new THREE.BoxGeometry(0.6, 7, 0.6);
  for (const sd of [-1, 1]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(sd * (main.halfW + 1), 3.5, 0);
    start.add(p);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(main.halfW * 2 + 2.6, 1.4, 0.4), new THREE.MeshStandardMaterial({ map: checkerTexture() }));
  banner.position.y = 6.5;
  start.add(banner);
  root.add(start);

  // Grid slot marks
  const markGeo = new THREE.PlaneGeometry(2.4, 0.25);
  markGeo.rotateX(-Math.PI / 2);
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, ...decal });
  for (const g of layout.startGrid) {
    const m = new THREE.Mesh(markGeo, markMat);
    m.position.set(g.x - Math.sin(g.heading) * 1.8, layout.heightAt(g.x, g.z) + 0.03, g.z - Math.cos(g.heading) * 1.8);
    m.rotation.y = g.heading;
    root.add(m);
  }
  return conveyors;
}

/** Translucent checkpoint planes (hidden by default; the preview toggles them). */
export function buildCheckpointDebug(layout: TrackLayout): THREE.Group {
  const grp = new THREE.Group();
  grp.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
  const mat0 = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  layout.checkpoints.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.halfWidth * 2, 3), i === 0 ? mat0 : mat);
    m.position.set(c.x, layout.heightAt(c.x, c.z) + 1.5, c.z);
    m.rotation.y = Math.atan2(-c.nx, -c.nz);
    grp.add(m);
  });
  return grp;
}
