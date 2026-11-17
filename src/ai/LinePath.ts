import { AI_TUNING } from '../config/aiTuning';

export interface P2 { x: number; z: number }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Closed polyline with arc-length lookup. Heading uses the kart convention: forward = (sin h, cos h). */
export class LinePath {
  readonly pts: P2[];
  readonly cum: number[]; // cum[i] = distance from pts[0] to pts[i]
  readonly length: number;

  constructor(pts: P2[]) {
    if (pts.length < 3) throw new Error('LinePath needs at least 3 points');
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i % pts.length];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.length = this.cum[pts.length];
    this.cum.length = pts.length;
  }

  /** Nearest vertex index. With `hint`, searches a window around it (cheap per-frame tracking). */
  nearest(x: number, z: number, hint = -1, window = 25): number {
    const n = this.pts.length;
    let best = 0;
    let bd = Infinity;
    const scan = (i: number) => {
      const p = this.pts[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    };
    if (hint < 0) for (let i = 0; i < n; i++) scan(i);
    else for (let k = -window; k <= window; k++) scan((((hint + k) % n) + n) % n);
    return best;
  }

  private seg(s: number): [number, number, number] {
    const L = this.length;
    const ss = ((s % L) + L) % L;
    // binary search for the segment containing ss
    let lo = 0;
    let hi = this.pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid] <= ss) lo = mid; else hi = mid - 1;
    }
    const next = (lo + 1) % this.pts.length;
    const segLen = (next === 0 ? L : this.cum[next]) - this.cum[lo];
    return [lo, next, segLen > 0 ? (ss - this.cum[lo]) / segLen : 0];
  }

  pointAt(s: number): P2 {
    const [a, b, u] = this.seg(s);
    const A = this.pts[a];
    const B = this.pts[b];
    return { x: A.x + (B.x - A.x) * u, z: A.z + (B.z - A.z) * u };
  }

  headingAt(s: number): number {
    const [a, b] = this.seg(s);
    const A = this.pts[a];
    const B = this.pts[b];
    return Math.atan2(B.x - A.x, B.z - A.z);
  }

  /** Signed heading change from s to s + d (positive = heading increases = left turn). */
  turn(s: number, d: number): number {
    return wrap(this.headingAt(s + d) - this.headingAt(s));
  }
}

/**
 * Racing line: centreline pulled toward the inside of corners in proportion to (smoothed) curvature,
 * capped at AI_TUNING.ai.lineInsideMax of the half-width so it stays well inside the walls.
 */
export function buildRacingLine(center: P2[], halfWidth: number): P2[] {
  const T = AI_TUNING.ai;
  const n = center.length;
  const w = T.lineSmooth;
  const at = (i: number) => center[((i % n) + n) % n];
  const tangent = (i: number) => {
    const a = at(i - 1);
    const b = at(i + 1);
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  };
  const off: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = tangent(i - w);
    const t1 = tangent(i + w);
    const t = tangent(i);
    let dx = t1.x - t0.x;
    let dz = t1.z - t0.z;
    const dot = dx * t.x + dz * t.z; // keep only the sideways part
    dx -= dot * t.x;
    dz -= dot * t.z;
    const dl = Math.hypot(dx, dz);
    let span = 0;
    for (let k = -w; k < w; k++) span += Math.hypot(at(i + k + 1).x - at(i + k).x, at(i + k + 1).z - at(i + k).z);
    const k = span > 0 ? dl / span : 0; // ≈ curvature (|Δtangent| / arc length)
    const amt = Math.min(1, k / T.lineCurvatureFull) * T.lineInsideMax * halfWidth;
    off.push(dl > 1e-6 ? { x: (dx / dl) * amt, z: (dz / dl) * amt } : { x: 0, z: 0 });
  }
  // box-smooth the offsets so the line has no kinks
  return center.map((p, i) => {
    let sx = 0;
    let sz = 0;
    for (let k = -w; k <= w; k++) {
      const o = off[(((i + k) % n) + n) % n];
      sx += o.x;
      sz += o.z;
    }
    return { x: p.x + sx / (2 * w + 1), z: p.z + sz / (2 * w + 1) };
  });
}
