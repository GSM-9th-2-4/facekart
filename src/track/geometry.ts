// Pure track layout math (no rendering): spline sampling, projection, surfaces, walls, checkpoints.
// 2D queries work in the x/z plane; y only matters for heightAt().
import * as THREE from 'three';
import { TRACK_TUNING as TT } from '../config/trackTuning';

export type ZoneType = 'ice' | 'puddle' | 'ramp' | 'moving' | 'obstacle';
export interface ZoneData {
  type: ZoneType;
  from: number; // fraction 0-1 along the main spline
  to: number;
  // ice/puddle/moving: laneMin/laneMax (-1..1 across the road). moving: speed (along, m/s), lateral (m/s).
  // ramp: height (m). obstacle: count, size, period (s), amp (fraction of half-width).
  params?: Record<string, number>;
}
export interface ForkData {
  from: number;
  to: number;
  waypoints: number[][];
  width?: number;
}
export interface TrackData {
  id: string;
  name: string;
  theme: string;
  difficulty: number;
  laps: number;
  width: number;
  waypoints: number[][];
  zones?: ZoneData[];
  forks?: ForkData[];
  scenery?: { kind: string; count: number }[];
}

export interface Sample {
  x: number;
  y: number;
  z: number;
  tx: number; // unit tangent (x/z)
  tz: number;
  nx: number; // unit side normal = (tz, -tx)
  nz: number;
  s: number; // distance along this road
  k: number; // |curvature| 1/m
}

export interface Road {
  samples: Sample[]; // closed roads: last sample is NOT a duplicate of the first
  closed: boolean;
  halfW: number;
  length: number;
  isMain: boolean;
  mainFrom: number; // forks: main-spline distance where the branch starts / ends
  mainTo: number;
}

export interface Projection {
  road: Road;
  s: number;
  d: number; // signed lateral offset (along sample normal)
  y: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  beyond: boolean; // past the open end of a fork
}

export interface Checkpoint {
  x: number;
  z: number;
  nx: number; // forward direction (plane normal)
  nz: number;
  halfWidth: number;
  s: number;
}

export interface GridSlot {
  x: number;
  z: number;
  heading: number;
}

function sampleCurve(curve: THREE.Curve<THREE.Vector3>, closed: boolean): Sample[] {
  const len = curve.getLength();
  const n = Math.max(8, Math.round(len / TT.gen.sampleSpacing));
  const count = closed ? n : n + 1;
  const out: Sample[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = i / n;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    const tl = Math.hypot(t.x, t.z) || 1;
    const tx = t.x / tl;
    const tz = t.z / tl;
    out.push({ x: p.x, y: p.y, z: p.z, tx, tz, nx: tz, nz: -tx, s: u * len, k: 0 });
  }
  for (let i = 0; i < count; i++) {
    const a = out[closed ? (i - 1 + count) % count : Math.max(0, i - 1)];
    const b = out[closed ? (i + 1) % count : Math.min(count - 1, i + 1)];
    const ang = Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
    const ds = (closed ? 2 : (i === 0 || i === count - 1 ? 1 : 2)) * (len / n);
    out[i].k = Math.abs(ang) / ds;
  }
  return out;
}

const v3 = (w: number[]) => new THREE.Vector3(w[0], w[1] ?? 0, w[2] ?? 0);

export class TrackLayout {
  readonly data: TrackData;
  readonly main: Road;
  readonly roads: Road[];
  readonly checkpoints: Checkpoint[];
  readonly startGrid: GridSlot[];
  readonly zones: ZoneData[];

  constructor(data: TrackData) {
    this.data = data;
    this.zones = data.zones ?? [];
    const curve = new THREE.CatmullRomCurve3(data.waypoints.map(v3), true, 'centripetal');
    const samples = sampleCurve(curve, true);
    const length = curve.getLength();
    this.main = { samples, closed: true, halfW: data.width / 2, length, isMain: true, mainFrom: 0, mainTo: length };
    this.roads = [this.main];

    for (const f of data.forks ?? []) {
      const sFrom = f.from * length;
      const sTo = f.to * length;
      // Lead-in / lead-out points 10 m on the main line keep the branch tangent to the main road at both joins.
      const pts = [
        this.pointAtS(sFrom - 10),
        this.pointAtS(sFrom),
        ...f.waypoints.map(v3),
        this.pointAtS(sTo),
        this.pointAtS(sTo + 10),
      ];
      const fc = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      this.roads.push({
        samples: sampleCurve(fc, false),
        closed: false,
        halfW: (f.width ?? data.width) / 2,
        length: fc.getLength(),
        isMain: false,
        mainFrom: sFrom - 10,
        mainTo: sTo + 10,
      });
    }

    this.checkpoints = [];
    const forks = this.roads.filter((r) => !r.isMain);
    const m = TT.gen.forkCheckpointMargin;
    const nCp = Math.max(4, Math.round(length / TT.gen.checkpointSpacing));
    for (let i = 0; i < nCp; i++) {
      const s = (i / nCp) * length;
      if (i > 0 && forks.some((r) => inRangeWrap(s, r.mainFrom - m, r.mainTo + m, length))) continue;
      const sm = this.sampleAtS(s);
      this.checkpoints.push({ x: sm.x, z: sm.z, nx: sm.tx, nz: sm.tz, halfWidth: this.main.halfW, s });
    }

    this.startGrid = [];
    const g = TT.gen;
    for (let i = 0; i < 8; i++) {
      const col = i % 2;
      const back = g.gridFirstRow + Math.floor(i / 2) * g.gridRowGap + col * g.gridStagger;
      const sm = this.sampleAtS(-back);
      const lat = (col === 0 ? -1 : 1) * g.gridLateral * this.main.halfW;
      // Three.js yaw: forward = (-sin h, -cos h)  =>  h = atan2(-tx, -tz)
      this.startGrid.push({ x: sm.x + sm.nx * lat, z: sm.z + sm.nz * lat, heading: Math.atan2(-sm.tx, -sm.tz) });
    }
  }

  /** Interpolated main-road sample at distance s (wraps). */
  sampleAtS(s: number): Sample {
    const r = this.main;
    const L = r.length;
    const ss = ((s % L) + L) % L;
    const n = r.samples.length;
    const f = (ss / L) * n;
    const i = Math.floor(f) % n;
    const a = r.samples[i];
    const b = r.samples[(i + 1) % n];
    const u = f - Math.floor(f);
    const tx = a.tx + (b.tx - a.tx) * u;
    const tz = a.tz + (b.tz - a.tz) * u;
    const tl = Math.hypot(tx, tz) || 1;
    return {
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
      z: a.z + (b.z - a.z) * u,
      tx: tx / tl,
      tz: tz / tl,
      nx: tz / tl,
      nz: -tx / tl,
      s: ss,
      k: a.k,
    };
  }

  private pointAtS(s: number): THREE.Vector3 {
    const sm = this.sampleAtS(s);
    return new THREE.Vector3(sm.x, sm.y, sm.z);
  }

  /** Closest point on one road's centreline. */
  project(road: Road, x: number, z: number): Projection {
    const sm = road.samples;
    const n = sm.length;
    // shortcut: brute-force nearest sample (~1k samples); add a spatial grid if profiling shows it hot.
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const dx = sm[i].x - x;
      const dz = sm[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    let res: Projection | null = null;
    let resD = Infinity;
    for (const [ia, ib] of [
      [best - 1, best],
      [best, best + 1],
    ]) {
      let a = ia;
      let b = ib;
      if (road.closed) {
        a = (a + n) % n;
        b = (b + n) % n;
      } else if (a < 0 || b >= n) continue;
      const A = sm[a];
      const B = sm[b];
      const ex = B.x - A.x;
      const ez = B.z - A.z;
      const el = ex * ex + ez * ez || 1e-9;
      const raw = ((x - A.x) * ex + (z - A.z) * ez) / el;
      const u = Math.min(1, Math.max(0, raw));
      const qx = A.x + ex * u;
      const qz = A.z + ez * u;
      const dist = Math.hypot(x - qx, z - qz);
      if (dist >= resD) continue;
      resD = dist;
      const nx = A.nx + (B.nx - A.nx) * u;
      const nz = A.nz + (B.nz - A.nz) * u;
      const nl = Math.hypot(nx, nz) || 1;
      const segLen = Math.sqrt(el);
      const sA = A.s;
      const sB = b === 0 && road.closed ? road.length : B.s;
      res = {
        road,
        s: sA + (sB - sA) * u,
        d: (x - qx) * (nx / nl) + (z - qz) * (nz / nl),
        y: A.y + (B.y - A.y) * u,
        tx: ex / segLen,
        tz: ez / segLen,
        nx: nx / nl,
        nz: nz / nl,
        beyond: !road.closed && ((a === 0 && raw < 0) || (b === n - 1 && raw > 1)),
      };
    }
    return res!;
  }

  /** Best road for a point: the one containing it (smallest relative offset), else the nearest edge. */
  query(x: number, z: number): { p: Projection; inside: boolean } {
    let bestIn: Projection | null = null;
    let bestInRel = Infinity;
    let bestOut: Projection | null = null;
    let bestOutEx = Infinity;
    for (const r of this.roads) {
      const p = this.project(r, x, z);
      if (p.beyond) continue;
      const ad = Math.abs(p.d);
      if (ad <= r.halfW) {
        if (ad / r.halfW < bestInRel) {
          bestInRel = ad / r.halfW;
          bestIn = p;
        }
      } else if (ad - r.halfW < bestOutEx) {
        bestOutEx = ad - r.halfW;
        bestOut = p;
      }
    }
    return bestIn ? { p: bestIn, inside: true } : { p: bestOut!, inside: false };
  }

  /** Main-spline distance for a projection (fork progress mapped linearly onto the main range it replaces). */
  mainS(p: Projection): number {
    if (p.road.isMain) return p.s;
    const L = this.main.length;
    const v = p.road.mainFrom + (p.road.mainTo - p.road.mainFrom) * (p.s / p.road.length);
    return ((v % L) + L) % L;
  }

  progressAt(x: number, z: number): number {
    return this.mainS(this.query(x, z).p);
  }

  /** Zones covering a main-road projection. */
  zonesAt(p: Projection): ZoneData[] {
    if (!p.road.isMain) return [];
    const L = this.main.length;
    const lane = p.d / p.road.halfW;
    return this.zones.filter((zn) => {
      if (!inRangeWrap(p.s, zn.from * L, zn.to * L, L)) return false;
      const lo = zn.params?.laneMin ?? -1;
      const hi = zn.params?.laneMax ?? 1;
      return lane >= lo && lane <= hi;
    });
  }

  surfaceAt(x: number, z: number) {
    const { p, inside } = this.query(x, z);
    let gripMul = 1;
    let speedMul = 1;
    let px = 0;
    let pz = 0;
    let type = 'road';
    for (const zn of this.zonesAt(p)) {
      if (zn.type === 'ice' || zn.type === 'puddle') {
        gripMul *= TT.surface[zn.type].gripMul;
        speedMul *= TT.surface[zn.type].speedMul;
        type = zn.type;
      } else if (zn.type === 'moving') {
        const sp = zn.params?.speed ?? (zn.params?.lateral ? 0 : TT.surface.defaultConveyorSpeed);
        const lat = zn.params?.lateral ?? 0;
        px += p.tx * sp + p.nx * lat;
        pz += p.tz * sp + p.nz * lat;
        type = 'moving';
      }
    }
    return { gripMul, speedMul, push: { x: px, z: pz }, onRoad: inside, type };
  }

  /** Ramp height offset at a main-road distance (linear rise, sheer drop at the lip). */
  rampHeightAtS(s: number): number {
    const L = this.main.length;
    for (const zn of this.zones) {
      if (zn.type !== 'ramp') continue;
      const a = zn.from * L;
      const b = zn.to * L;
      if (s >= a && s <= b) return ((s - a) / (b - a)) * (zn.params?.height ?? TT.ramp.defaultHeight);
    }
    return 0;
  }

  heightAt(x: number, z: number): number {
    const { p } = this.query(x, z);
    return p.y + (p.road.isMain ? this.rampHeightAtS(p.s) : 0);
  }

  /** Upward launch velocity (m/s) when driving over the last metres of a ramp at `speed`, else 0. */
  rampAt(x: number, z: number, speed: number): number {
    const { p } = this.query(x, z);
    if (!p.road.isMain) return 0;
    const L = this.main.length;
    for (const zn of this.zones) {
      if (zn.type !== 'ramp') continue;
      const a = zn.from * L;
      const b = zn.to * L;
      if (p.s >= b - TT.ramp.lipLength && p.s <= b) {
        return Math.max(0, speed) * ((zn.params?.height ?? TT.ramp.defaultHeight) / (b - a));
      }
    }
    return 0;
  }

  /** Wall push-out. Corridor based: anything outside the union of road corridors is pushed back in, so fast karts cannot tunnel. */
  collideWalls(x: number, z: number, radius: number): { nx: number; nz: number; depth: number } | null {
    let best: Projection | null = null;
    let bestEx = Infinity;
    for (const r of this.roads) {
      const p = this.project(r, x, z);
      if (p.beyond) continue;
      const ex = Math.abs(p.d) - (r.halfW - radius);
      if (ex <= 0) return null;
      if (ex < bestEx) {
        bestEx = ex;
        best = p;
      }
    }
    if (!best) return null;
    const sg = best.d > 0 ? -1 : 1;
    return { nx: best.nx * sg, nz: best.nz * sg, depth: bestEx };
  }

  /** True if (x,z) lies strictly inside a road other than `except` (used to open walls at fork junctions). */
  insideOther(x: number, z: number, except: Road): boolean {
    for (const r of this.roads) {
      if (r === except) continue;
      const p = this.project(r, x, z);
      if (!p.beyond && Math.abs(p.d) < r.halfW - 0.05) return true;
    }
    return false;
  }

  /** Self-check of the layout; returns human-readable warnings (empty = OK). */
  validate(): string[] {
    const w: string[] = [];
    const L = this.main.length;
    const gap = TT.gen.minWallGap + 2 * TT.gen.wallThickness;
    for (const r of this.roads) {
      const kMax = Math.max(...r.samples.map((s) => s.k));
      if (kMax * r.halfW > 0.9) w.push(`${r.isMain ? 'main' : 'fork'}: corner radius ${(1 / kMax).toFixed(1)} m too tight for half-width ${r.halfW}`);
    }
    const ms = this.main.samples;
    const step = 3;
    for (let i = 0; i < ms.length; i += step) {
      for (let j = i + step; j < ms.length; j += step) {
        const ds = Math.min(ms[j].s - ms[i].s, L - (ms[j].s - ms[i].s));
        const dist = Math.hypot(ms[i].x - ms[j].x, ms[i].z - ms[j].z);
        if (ds > Math.PI * (2 * this.main.halfW + gap) && dist < 2 * this.main.halfW + gap) {
          w.push(`main: s=${ms[i].s.toFixed(0)} and s=${ms[j].s.toFixed(0)} only ${dist.toFixed(1)} m apart`);
          i += 30;
          break;
        }
      }
    }
    for (const r of this.roads) {
      if (r.isMain) continue;
      const near = 4 * r.halfW + 30; // includes the 10 m lead-in on the main line
      for (const sm of r.samples) {
        if (sm.s < near || sm.s > r.length - near) continue;
        const p = this.project(this.main, sm.x, sm.z);
        if (Math.abs(p.d) < this.main.halfW + r.halfW + gap) {
          w.push(`fork: s=${sm.s.toFixed(0)} only ${Math.abs(p.d).toFixed(1)} m from main centre`);
          break;
        }
      }
    }
    for (const r of this.roads) {
      if (!r.isMain && inRangeWrap(0, r.mainFrom - TT.gen.forkCheckpointMargin, r.mainTo, L)) w.push('fork overlaps the start line');
    }
    return w;
  }
}

export function inRangeWrap(s: number, a: number, b: number, L: number): boolean {
  const n = (v: number) => ((v % L) + L) % L;
  const ss = n(s);
  const aa = n(a);
  const bb = n(b);
  return aa <= bb ? ss >= aa && ss <= bb : ss >= aa || ss <= bb;
}
