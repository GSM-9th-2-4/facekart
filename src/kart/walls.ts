import type { WallCollider } from './KartController';

/** Track-style push-out test: returns the unit normal (away from the wall) and penetration depth, or null. */
export type PushOutFn = (x: number, z: number, radius: number) => { nx: number; nz: number; depth: number } | null;

/**
 * Adapts a push-out test into a swept WallCollider by sampling the move in substeps of at most
 * `maxStep` (default radius / 2), so fast karts can't skip past thin walls.
 */
export function makeWallColliderFromPushOut(collide: PushOutFn, maxStep?: number): WallCollider {
  return (from, to, radius) => {
    const step = maxStep ?? radius * 0.5;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
    for (let i = 1; i <= n; i++) {
      const x = from.x + (dx * i) / n;
      const z = from.z + (dz * i) / n;
      const h = collide(x, z, radius);
      if (h) return { position: { x: x + h.nx * h.depth, z: z + h.nz * h.depth }, normal: { x: h.nx, z: h.nz } };
    }
    return null;
  };
}
