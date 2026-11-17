// Pooled kart particles: drift smoke + sparks from the rear wheels, boost flame behind the kart.
//
// Wiring (main.ts / race code):
//   import { KartEffects } from './kart/effects';
//   const fx = new KartEffects(scene);                 // once per race scene
//   each render frame: fx.update(dt, karts);           // karts = KartController[] (player + AI)
//   on leaving the race: fx.dispose();
// Fixed pool sizes (fxTuning.ts); oldest particles are recycled. No per-frame allocations.
import * as THREE from 'three';
import { FX_TUNING as T } from '../config/fxTuning';
import type { KartController } from './KartController';

export type FxKart = Pick<KartController, 'x' | 'z' | 'heading' | 'speed' | 'isDrifting' | 'slip' | 'boostTimer' | 'instantBoostTimer'>;

let dotTexture: THREE.Texture | null = null;
function getDot(): THREE.Texture {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

class Pool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array; // rgba
  private vel: Float32Array;
  private base: Float32Array; // base rgba per particle
  private life: Float32Array;
  private maxLife: Float32Array;
  private next = 0;
  private n: number;

  constructor(n: number, size: number, additive: boolean, private gravity: number, private drag: number) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-1e4); // parked far away until used
    this.col = new Float32Array(n * 4);
    this.vel = new Float32Array(n * 3);
    this.base = new Float32Array(n * 4);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size,
      map: getDot(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, g: number, b: number, a: number) {
    const i = this.next;
    this.next = (i + 1) % this.n;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.base[i * 4] = r;
    this.base[i * 4 + 1] = g;
    this.base[i * 4 + 2] = b;
    this.base[i * 4 + 3] = a;
    this.life[i] = this.maxLife[i] = life;
  }

  update(dt: number) {
    const k = Math.max(0, 1 - this.drag * dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      const c = i * 4;
      if (this.life[i] <= 0) {
        this.col[c + 3] = 0;
        this.pos[p + 1] = -1e4;
        continue;
      }
      this.vel[p] *= k;
      this.vel[p + 1] = this.vel[p + 1] * k - this.gravity * dt;
      this.vel[p + 2] *= k;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] = Math.max(0.02, this.pos[p + 1] + this.vel[p + 1] * dt);
      this.pos[p + 2] += this.vel[p + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.col[c] = this.base[c];
      this.col[c + 1] = this.base[c + 1];
      this.col[c + 2] = this.base[c + 2];
      this.col[c + 3] = this.base[c + 3] * f;
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Integer count for `rate * dt`, carrying the fraction randomly so low rates still emit. */
function count(rate: number, dt: number) {
  const r = rate * dt;
  return Math.floor(r) + (Math.random() < r % 1 ? 1 : 0);
}
const SIDES = [-1, 1] as const;
const rnd = (s: number) => (Math.random() * 2 - 1) * s;

export class KartEffects {
  private smoke = new Pool(T.smoke.pool, T.smoke.size, false, -T.smoke.rise, T.smoke.drag);
  private sparks = new Pool(T.sparks.pool, T.sparks.size, true, T.sparks.gravity, T.sparks.drag);
  private boost = new Pool(T.boost.pool, T.boost.size, true, 0, T.boost.drag);

  constructor(scene: THREE.Scene) {
    scene.add(this.smoke.points, this.sparks.points, this.boost.points);
  }

  update(dt: number, karts: readonly FxKart[]) {
    for (const k of karts) {
      const s = Math.sin(k.heading);
      const c = Math.cos(k.heading);
      // local (lx, lz) -> world: x + lx*cos + lz*sin, z - lx*sin + lz*cos
      if (k.isDrifting && Math.abs(k.speed) > T.minDriftSpeed) {
        const slip = Math.min(1, Math.abs(k.slip) / T.sparks.slipForHigh);
        const [r0, g0, b0] = T.sparks.colorLow;
        const [r1, g1, b1] = T.sparks.colorHigh;
        const sr = r0 + (r1 - r0) * slip;
        const sg = g0 + (g1 - g0) * slip;
        const sb = b0 + (b1 - b0) * slip;
        for (const side of SIDES) {
          const lx = side * T.rearWheelX;
          const wx = k.x + lx * c + T.rearWheelZ * s;
          const wz = k.z - lx * s + T.rearWheelZ * c;
          for (let n = count(T.smoke.rate * (0.3 + 0.7 * slip), dt); n > 0; n--) {
            const [r, g, b] = T.smoke.color;
            this.smoke.emit(wx, T.wheelY, wz, rnd(T.smoke.spread), T.smoke.rise, rnd(T.smoke.spread), T.smoke.life, r, g, b, T.smoke.alpha);
          }
          for (let n = count(T.sparks.rate, dt); n > 0; n--) {
            this.sparks.emit(wx, T.wheelY, wz, rnd(T.sparks.speed), Math.random() * T.sparks.speed, rnd(T.sparks.speed), T.sparks.life, sr, sg, sb, 1);
          }
        }
      }
      if (k.boostTimer > 0 || k.instantBoostTimer > 0) {
        const col = k.boostTimer > 0 ? T.boost.color : T.boost.instantColor;
        const ex = k.x + T.exhaustZ * s;
        const ez = k.z + T.exhaustZ * c;
        for (let n = count(T.boost.rate, dt); n > 0; n--) {
          this.boost.emit(
            ex + rnd(0.2), T.exhaustY + rnd(0.15), ez + rnd(0.2),
            -s * T.boost.backSpeed + rnd(T.boost.spread), rnd(T.boost.spread * 0.5), -c * T.boost.backSpeed + rnd(T.boost.spread),
            T.boost.life, col[0], col[1], col[2], 1,
          );
        }
      }
    }
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.boost.update(dt);
  }

  dispose() {
    this.smoke.dispose();
    this.sparks.dispose();
    this.boost.dispose();
  }
}
