import { TUNING } from '../config/tuning';

type KartTuning = typeof TUNING.kart;
/** Per-kart physics numbers. Built from TUNING by makeKartParams(); step 5 scales these by kart stats. */
export type KartPhysicsParams = { -readonly [K in keyof KartTuning]: number };

export function makeKartParams(): KartPhysicsParams {
  return { ...TUNING.kart };
}

export interface KartControls {
  throttle: number; // -1..1 (negative = brake / reverse)
  steer: number; // -1..1 (positive = right)
  drift: boolean;
  boostPressed: boolean; // edge
  throttlePressed: boolean; // edge, for instant boost
}

export interface Surface {
  gripMul: number;
  speedMul: number;
}
export const DEFAULT_SURFACE: Surface = { gripMul: 1, speedMul: 1 };

export interface WallHit {
  position: { x: number; z: number }; // corrected position (outside the wall)
  normal: { x: number; z: number }; // unit normal pointing away from the wall
}
/** Swept test from `from` to `to`; returns the first hit or null. Raycast-style, so no tunneling. */
export type WallCollider = (from: { x: number; z: number }, to: { x: number; z: number }, radius: number) => WallHit | null;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Pure arcade kart physics on the XZ plane. Forward = (sin heading, cos heading).
 * Velocity = speed * (sin travel, cos travel); slip = heading - travel.
 */
export class KartController {
  x = 0;
  z = 0;
  heading = 0;
  travel = 0;
  speed = 0; // signed, along travel direction
  isDrifting = false;
  driftDir = 0; // +1 right, -1 left (steer space)
  gauge = 0;
  boosterStock = 0;
  boostTimer = 0;
  instantBoostTimer = 0;
  instantBoostWindow = 0;
  gripRecovery = 0; // seconds left of grip ramp after a drift
  surface: Surface = DEFAULT_SURFACE;
  private walls: WallCollider | null = null;

  constructor(public params: KartPhysicsParams) {}

  get slip() {
    return wrap(this.heading - this.travel);
  }
  get vx() {
    return this.speed * Math.sin(this.travel);
  }
  get vz() {
    return this.speed * Math.cos(this.travel);
  }

  collideWalls(fn: WallCollider | null) {
    this.walls = fn;
  }

  reset(x: number, z: number, heading: number) {
    Object.assign(this, { x, z, heading, travel: heading, speed: 0, isDrifting: false, gauge: 0, boostTimer: 0, boosterStock: 0, driftDir: 0 });
    Object.assign(this, { instantBoostTimer: 0, instantBoostWindow: 0, gripRecovery: 0 });
  }

  update(dt: number, c: KartControls, surface: Surface = DEFAULT_SURFACE) {
    const p = this.params;
    this.surface = surface;
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.instantBoostTimer = Math.max(0, this.instantBoostTimer - dt);
    this.instantBoostWindow = Math.max(0, this.instantBoostWindow - dt);
    this.gripRecovery = Math.max(0, this.gripRecovery - dt);

    // --- boosters ---
    if (c.boostPressed && this.boosterStock > 0) {
      this.boosterStock--;
      this.boostTimer = p.boostTime;
    }
    if (c.throttlePressed && this.instantBoostWindow > 0) {
      this.instantBoostWindow = 0;
      this.instantBoostTimer = p.instantBoostTime;
    }

    // --- drift state ---
    const steerSign = Math.sign(c.steer);
    if (!this.isDrifting) {
      if (c.drift && Math.abs(c.steer) > p.driftSteerDeadzone && this.speed > p.driftMinSpeed) {
        this.isDrifting = true;
        this.driftDir = steerSign;
        this.heading -= this.driftDir * p.driftEntryKick;
      }
    } else if ((!c.drift && steerSign !== this.driftDir) || this.speed < p.driftMinSpeed) {
      this.isDrifting = false;
      this.gripRecovery = p.gripRecoveryTime;
      this.instantBoostWindow = p.instantBoostWindow;
    }

    // --- longitudinal ---
    let maxSpeed = p.topSpeed * surface.speedMul;
    let extraAccel = 0;
    if (this.boostTimer > 0) {
      maxSpeed *= p.boostTopSpeedMul;
      extraAccel += p.boostAccel;
    } else if (this.instantBoostTimer > 0) {
      maxSpeed *= p.instantBoostTopSpeedMul;
      extraAccel += p.instantBoostPower;
    }
    const boosting = extraAccel > 0;
    let s = this.speed;
    if (boosting || c.throttle > 0) {
      const t = boosting ? 1 : c.throttle;
      const taper = 1 - p.accelTaper * clamp(s / maxSpeed, 0, 1);
      if (s < maxSpeed) s = Math.min(maxSpeed, s + (p.accel * t * taper + extraAccel) * dt);
    } else if (c.throttle < 0) {
      if (s > 0) s = Math.max(0, s - p.brakeDecel * -c.throttle * dt);
      else s = Math.max(-p.reverseTopSpeed, s - p.reverseAccel * -c.throttle * dt);
    } else {
      s = Math.sign(s) * Math.max(0, Math.abs(s) - p.coastDecel * dt);
    }
    if (s > maxSpeed) s = Math.max(maxSpeed, s - p.overspeedDecel * dt);
    if (this.isDrifting) s *= 1 - p.driftSpeedLoss * dt;
    this.speed = s;

    // --- steering ---
    const lowSpeed = clamp(Math.abs(s) / p.steerFullSpeed, 0, 1);
    const dir = s < 0 ? -1 : 1; // steering inverts in reverse
    if (this.isDrifting) {
      const steer = clamp(c.steer + this.driftDir * p.driftHoldSteer, -1, 1);
      this.heading -= steer * p.driftSteerRate * lowSpeed * dt;
      // cap slip angle; counter-steer naturally pulls it back down
      const sl = clamp(wrap(this.heading - this.travel), -p.maxDriftAngle, p.maxDriftAngle);
      this.heading = this.travel + sl;
    } else {
      this.heading -= c.steer * dir * p.steerRate * lowSpeed * dt;
    }
    this.heading = wrap(this.heading);

    // --- grip: velocity direction converges toward heading ---
    let grip = p.grip;
    if (this.isDrifting) grip = p.driftGrip;
    else if (this.gripRecovery > 0) {
      const k = this.gripRecovery / p.gripRecoveryTime; // 1 → 0
      grip = p.grip + (p.driftGrip - p.grip) * k;
    }
    grip *= surface.gripMul;
    this.travel = wrap(this.travel + this.slip * (1 - Math.exp(-grip * dt)));

    // --- gauge ---
    if (this.isDrifting) {
      this.gauge +=
        dt * p.gaugeRate * clamp(s / p.topSpeed, 0, 1) * (Math.abs(this.slip) / p.maxDriftAngle);
      if (this.gauge >= 1) {
        this.gauge = 0;
        this.boosterStock = Math.min(p.maxBoosterStock, this.boosterStock + 1);
      }
    }

    // --- integrate + walls ---
    const from = { x: this.x, z: this.z };
    const to = { x: this.x + this.vx * dt, z: this.z + this.vz * dt };
    const hit = this.walls?.(from, to, p.radius);
    if (hit) {
      const vx = this.vx;
      const vz = this.vz;
      const dot = vx * hit.normal.x + vz * hit.normal.z;
      const rx = vx - 2 * dot * hit.normal.x;
      const rz = vz - 2 * dot * hit.normal.z;
      this.x = hit.position.x;
      this.z = hit.position.z;
      this.travel = Math.atan2(rx, rz);
      this.speed = Math.hypot(rx, rz) * (1 - p.wallSpeedLoss) * Math.sign(this.speed || 1);
      if (this.speed < 0) this.travel = wrap(this.travel + Math.PI); // keep signed-speed convention
      this.isDrifting = false;
    } else {
      this.x = to.x;
      this.z = to.z;
    }
  }
}
