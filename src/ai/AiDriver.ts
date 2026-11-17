import { AI_TUNING } from '../config/aiTuning';
import type { KartController, KartControls } from '../kart';
import type { LinePath } from './LinePath';

const T = AI_TUNING.ai;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Virtual driver: turns the racing line into KartControls for a normal KartController (no physics shortcuts).
 * skill 0..1 scales line accuracy, drift timing and booster / instant-boost usage.
 */
export class AiDriver {
  private idx = -1;
  private wanderPhase = Math.random() * 1000;
  private reaction: number;
  private driftWant = 0; // seconds the drift condition has held
  private boostWant = 0;
  private boostSkipStraight = false; // decided "not this straight" (low skill)
  private wasStraight = false;
  private instantTimer = -1; // >0: counting down to the instant-boost ↑ tap
  private stuckTimer = 0;
  private reverseTimer = 0;
  private prevDrifting = false;
  /** Seconds stuck without recovering; the race respawns the kart when this passes T.respawnTime. */
  stuckFor = 0;

  constructor(readonly skill: number, private line: LinePath, private halfWidth: number) {
    this.reaction = lerp(T.reactionMax, T.reactionMin, skill);
  }

  /** Forget tracking state (after a respawn / reset). */
  reset() {
    this.idx = -1;
    this.stuckTimer = this.reverseTimer = this.stuckFor = 0;
    this.driftWant = this.boostWant = 0;
    this.instantTimer = -1;
  }

  update(dt: number, k: KartController, time: number): KartControls {
    const line = this.line;
    this.idx = line.nearest(k.x, k.z, this.idx);
    const s = line.cum[this.idx];
    const speed = Math.max(0, k.speed);

    // --- target point: look-ahead on the line + skill-scaled lane wander ---
    const ahead = s + T.lookAheadBase + speed * T.lookAheadPerSpeed;
    const p = line.pointAt(ahead);
    const h = line.headingAt(ahead);
    const wander = Math.sin(time * T.wanderHz * Math.PI * 2 + this.wanderPhase) * (1 - this.skill) * T.wanderMax * this.halfWidth;
    // side normal (kart convention forward = (sin h, cos h)) → left = (cos h, -sin h)
    const tx = p.x + Math.cos(h) * wander;
    const tz = p.z - Math.sin(h) * wander;
    const err = wrap(Math.atan2(tx - k.x, tz - k.z) - k.heading);

    const c: KartControls = { throttle: 1, steer: clamp(-err * T.steerGain, -1, 1), drift: false, boostPressed: false, throttlePressed: false };

    // --- stuck recovery: back up while steering the other way ---
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      c.throttle = -1;
      c.steer = -c.steer;
      return c;
    }
    if (speed < T.stuckSpeed) {
      this.stuckTimer += dt;
      this.stuckFor += dt;
      if (this.stuckTimer > T.stuckTime) {
        this.stuckTimer = 0;
        this.reverseTimer = T.reverseTime;
      }
    } else {
      this.stuckTimer = 0;
      this.stuckFor = 0;
    }

    // weaker drivers lift off early (a virtual input, not a physics change), so kart tier alone doesn't decide races
    if (k.boostTimer <= 0 && speed > lerp(T.paceMin, 1, this.skill) * k.params.topSpeed * k.surface.speedMul) c.throttle = 0;
    if (Math.abs(err) > T.brakeAngle && speed > k.params.driftMinSpeed * 2) c.throttle = -0.3;

    // --- drifting: sharp corner ahead → hold Shift into it, release when it opens up ---
    const turn = line.turn(s, T.cornerScanDist);
    const driftAt = lerp(T.driftTurnAngleLowSkill, T.driftTurnAngle, this.skill);
    if (k.isDrifting) {
      const rest = line.turn(s, T.cornerScanDist * 0.5);
      if (Math.abs(rest) > T.driftExitAngle && Math.sign(-rest) === k.driftDir) c.drift = true;
      else c.steer = 0; // drift ends when Shift is up and steer leaves the drift side
    } else if (Math.abs(turn) > driftAt && speed > k.params.driftMinSpeed * 1.5) {
      this.driftWant += dt;
      if (this.driftWant >= this.reaction) {
        c.drift = true;
        c.steer = -Math.sign(turn); // heading increases = left = negative steer
      }
    } else this.driftWant = 0;

    // --- instant boost: tap ↑ shortly after the drift ends (skill = chance) ---
    if (this.prevDrifting && !k.isDrifting) {
      const chance = lerp(T.instantBoostChance[0], T.instantBoostChance[1], this.skill);
      this.instantTimer = Math.random() < chance ? Math.min(this.reaction, k.params.instantBoostWindow * 0.8) : -1;
    }
    this.prevDrifting = k.isDrifting;
    if (this.instantTimer >= 0) {
      this.instantTimer -= dt;
      if (this.instantTimer < 0) c.throttlePressed = true;
    }

    // --- boosters on straights ---
    const straight = Math.abs(turn) < T.boostStraightAngle && Math.abs(err) < T.boostStraightAngle;
    if (straight && !this.wasStraight) {
      this.boostSkipStraight = Math.random() > lerp(T.boostUseChance[0], T.boostUseChance[1], this.skill);
    }
    this.wasStraight = straight;
    if (straight && !this.boostSkipStraight && k.boosterStock > 0 && k.boostTimer <= 0 && !k.isDrifting) {
      this.boostWant += dt;
      if (this.boostWant >= this.reaction) {
        c.boostPressed = true;
        this.boostWant = 0;
      }
    } else this.boostWant = 0;

    return c;
  }
}
