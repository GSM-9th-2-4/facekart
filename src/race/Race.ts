import { AI_TUNING } from '../config/aiTuning';
import { KartController, makeKartParams, type KartControls, type KartDef, type Surface, type WallCollider } from '../kart';
import { AiDriver } from '../ai/AiDriver';
// dev: ?autodrive lets the AI drive the player kart (smoke-testing full races)
const DEV_AUTODRIVE = new URLSearchParams(location.search).has("autodrive");
import type { LinePath, P2 } from '../ai/LinePath';

const R = AI_TUNING.race;
const RB = AI_TUNING.rubberBand;

export type RaceState = 'intro' | 'countdown' | 'racing' | 'finished' | 'results';

export interface RaceCheckpoint { x: number; z: number; nx: number; nz: number; halfWidth: number }
/** What the race needs from a track. Headings use the kart convention: forward = (sin h, cos h). */
export interface RaceTrack {
  checkpoints: RaceCheckpoint[]; // [0] = start / finish line, nx/nz = driving direction
  startGrid: { x: number; z: number; heading: number }[];
  surfaceAt(x: number, z: number): Surface & { push?: P2 };
  heightAt?(x: number, z: number): number;
  rampAt?(x: number, z: number, speed: number): number;
  walls: WallCollider | null;
}

export interface RacerSpec {
  name: string;
  kart: KartDef;
  color: string;
  isPlayer: boolean;
  faceUrl: string | null;
  skill?: number; // AI only
}

export interface Racer extends RacerSpec {
  kart: KartDef;
  ctrl: KartController;
  ai: AiDriver | null;
  y: number;
  vy: number;
  onLip: boolean; // already launched from the current ramp lip
  crossings: number; // checkpoints passed in order (first crossing of the start line = 1)
  lapStart: number;
  lapTimes: number[];
  finishTime: number | null;
  raceDist: number; // metres along the race, for positions / rubber band / estimates
  position: number;
  baseTopSpeed: number;
}


/** One race: countdown, physics stepping for all karts, checkpoint laps, live positions, finish + results. */
export class Race {
  state: RaceState = 'intro';
  /** Seconds since GO (0 before). */
  time = 0;
  readonly racers: Racer[];
  readonly player: Racer;
  /** Sorted 1st → last; updated every step. */
  standings: Racer[];
  onEvent?: (e: 'lap' | 'finalLap' | 'finish' | 'startBoost', r: Racer) => void;

  private clock = 0;
  private cpS: number[]; // line distance of each checkpoint from checkpoint 0
  private lastUpPress = -Infinity; // clock time of the player's last ↑ press during the countdown
  private startBoostChecked = false;
  private finishClock = 0;

  constructor(
    private track: RaceTrack,
    private line: LinePath,
    halfWidth: number,
    readonly laps: number,
    specs: RacerSpec[],
  ) {
    const cps = track.checkpoints;
    if (cps.length < 2) throw new Error('Race needs at least 2 checkpoints');
    const s0 = line.cum[line.nearest(cps[0].x, cps[0].z)];
    const L = line.length;
    this.cpS = cps.map((c, i) => (i === 0 ? 0 : (((line.cum[line.nearest(c.x, c.z)] - s0) % L) + L) % L));

    this.racers = specs.map((spec, i) => {
      const ctrl = new KartController(makeKartParams(spec.kart));
      ctrl.collideWalls(track.walls);
      const g = track.startGrid[i % track.startGrid.length];
      ctrl.reset(g.x, g.z, g.heading);
      const ai = spec.isPlayer ? null : new AiDriver(spec.skill ?? 0.5, line, halfWidth);
      return {
        ...spec, ctrl, ai, y: track.heightAt?.(g.x, g.z) ?? 0, vy: 0, onLip: false, crossings: 0, lapStart: 0, lapTimes: [],
        finishTime: null, raceDist: 0, position: i + 1, baseTopSpeed: ctrl.params.topSpeed,
      };
    });
    this.player = this.racers.find((r) => r.isPlayer) ?? this.racers[0];
    this.standings = [...this.racers];
    this.updatePositions();
  }

  get totalCrossings() {
    return this.laps * this.track.checkpoints.length + 1; // +1: the first start-line crossing just after GO
  }

  /** '3' | '2' | '1' | 'GO!' | null */
  get countdownLabel(): string | null {
    if (this.state === 'countdown') return String(Math.max(1, 3 - Math.floor((this.clock - R.introTime) / R.countdownStep)));
    if (this.state === 'racing' && this.time < R.goShowTime) return 'GO!';
    return null;
  }

  /** Current lap for a racer (1-based, capped at laps). */
  lapOf(r: Racer) {
    const n = this.track.checkpoints.length;
    return Math.min(this.laps, Math.max(1, Math.floor(Math.max(0, r.crossings - 1) / n) + 1));
  }

  step(dt: number, playerControls: KartControls) {
    this.clock += dt;
    if (this.state === 'intro') {
      if (this.clock >= R.introTime) this.state = 'countdown';
      return;
    }
    if (this.state === 'countdown') {
      if (playerControls.throttlePressed) this.lastUpPress = this.clock;
      if (this.clock >= R.introTime + 3 * R.countdownStep) this.go();
      return;
    }
    if (this.state === 'results') return;

    this.time += dt;
    // late start boost: ↑ pressed just after GO
    if (!this.startBoostChecked) {
      if (playerControls.throttlePressed) this.giveStartBoost(this.player);
      if (this.time > R.startBoostWindow || playerControls.throttlePressed) this.startBoostChecked = true;
    }

    for (const r of this.racers) {
      let c: KartControls;
      if (r.ai) c = r.ai.update(dt, r.ctrl, this.time);
      else c = playerControls;
      if (r.isPlayer && (r.finishTime !== null || DEV_AUTODRIVE)) c = this.autopilot(r, dt);
      if (r.ai && RB.enabled && r.finishTime === null) {
        const gap = r.raceDist - this.player.raceDist; // + = AI ahead of the player
        r.ctrl.params.topSpeed = r.baseTopSpeed * (1 - Math.max(-1, Math.min(1, gap / RB.range)) * RB.maxTopSpeedMul);
      }
      this.physics(r, c, dt);
      if (r.ai && r.ai.stuckFor > AI_TUNING.ai.respawnTime) this.respawn(r);
      this.checkpoints(r);
    }
    this.updatePositions();

    if (this.state === 'finished' && this.clock - this.finishClock >= R.finishToResults) this.state = 'results';
  }

  private go() {
    this.state = 'racing';
    this.time = 0;
    if (this.clock - this.lastUpPress <= R.startBoostWindow) {
      this.giveStartBoost(this.player);
      this.startBoostChecked = true;
    }
    for (const r of this.racers) {
      r.lapStart = 0;
      if (r.ai && Math.random() < r.ai.skill * 0.8) this.giveStartBoost(r);
    }
  }

  private giveStartBoost(r: Racer) {
    r.ctrl.instantBoostTimer = R.startBoostTime;
    this.onEvent?.('startBoost', r);
  }

  /** After the finish line the player's kart drives itself. */
  private autoDriver: AiDriver | null = null;
  private autopilot(r: Racer, dt: number): KartControls {
    this.autoDriver ??= new AiDriver(1, this.line, this.track.checkpoints[0].halfWidth);
    return this.autoDriver.update(dt, r.ctrl, this.time);
  }

  private physics(r: Racer, c: KartControls, dt: number) {
    const k = r.ctrl;
    const surf = this.track.surfaceAt(k.x, k.z);
    k.update(dt, c, surf);
    if (surf.push && (surf.push.x || surf.push.z)) {
      const from = { x: k.x, z: k.z };
      const to = { x: k.x + surf.push.x * dt, z: k.z + surf.push.z * dt };
      const hit = this.track.walls?.(from, to, k.params.radius);
      k.x = hit ? hit.position.x : to.x;
      k.z = hit ? hit.position.z : to.z;
    }
    const ground = this.track.heightAt?.(k.x, k.z) ?? 0;
    const launch = this.track.rampAt?.(k.x, k.z, k.speed) ?? 0;
    // rampAt is non-zero for every frame on the lip: launch once, only when grounded
    if (launch > 0 && !r.onLip && r.y <= ground + 0.05) r.vy = launch;
    r.onLip = launch > 0;
    r.vy -= R.gravity * dt;
    r.y += r.vy * dt;
    if (r.y <= ground) {
      r.y = ground;
      r.vy = 0;
    }
  }

  private respawn(r: Racer) {
    const n = this.track.checkpoints.length;
    const s = this.cpS[(r.crossings - 1 + n) % n] + this.line.cum[this.line.nearest(this.track.checkpoints[0].x, this.track.checkpoints[0].z)] + 2; // just past the last checkpoint crossed, so it is not re-counted
    const p = this.line.pointAt(s);
    r.ctrl.reset(p.x, p.z, this.line.headingAt(s));
    r.ai?.reset();
  }

  private prevPos = new Map<Racer, P2>();
  private checkpoints(r: Racer) {
    const cps = this.track.checkpoints;
    const n = cps.length;
    const k = r.ctrl;
    const prev = this.prevPos.get(r) ?? { x: k.x, z: k.z };
    this.prevPos.set(r, { x: k.x, z: k.z });
    if (r.finishTime !== null) return;
    const cp = cps[r.crossings % n];
    const d0 = (prev.x - cp.x) * cp.nx + (prev.z - cp.z) * cp.nz;
    const d1 = (k.x - cp.x) * cp.nx + (k.z - cp.z) * cp.nz;
    const lateral = Math.abs((k.x - cp.x) * cp.nz - (k.z - cp.z) * cp.nx);
    if (!(d0 < 0 && d1 >= 0 && lateral <= cp.halfWidth + R.checkpointMargin)) return;

    r.crossings++;
    if (r.crossings === 1 || (r.crossings - 1) % n !== 0) return;
    // completed a lap
    r.lapTimes.push(this.time - r.lapStart);
    r.lapStart = this.time;
    if (r.crossings >= this.totalCrossings) {
      r.finishTime = this.time;
      if (r === this.player) {
        this.state = 'finished';
        this.finishClock = this.clock;
        this.onEvent?.('finish', r);
      }
    } else if (r.isPlayer) {
      this.onEvent?.(r.lapTimes.length === this.laps - 1 ? 'finalLap' : 'lap', r);
    }
  }

  /** Distance along the race of the next checkpoint crossing minus the straight-line gap to it. */
  private updatePositions() {
    const cps = this.track.checkpoints;
    const n = cps.length;
    const L = this.line.length;
    for (const r of this.racers) {
      const c = Math.min(r.crossings, this.totalCrossings - 1);
      // crossing #c (0-based) is checkpoint c % n; crossing 0 is the start line at distance 0
      const lapIdx = Math.floor(Math.max(0, c - 1) / n);
      const cpIdx = c % n;
      const target = c === 0 ? 0 : lapIdx * L + (cpIdx === 0 ? L : this.cpS[cpIdx]);
      const cp = cps[cpIdx];
      r.raceDist = target - (r.finishTime !== null ? 0 : Math.hypot(r.ctrl.x - cp.x, r.ctrl.z - cp.z));
    }
    this.standings = [...this.racers].sort((a, b) => {
      if (a.finishTime !== null || b.finishTime !== null) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      return b.raceDist - a.raceDist;
    });
    this.standings.forEach((r, i) => (r.position = i + 1));
  }

  /** Finished racers keep their time; others get an estimate from their average pace (kept in order). */
  results() {
    const total = this.laps * this.line.length;
    let prevT = 0;
    return this.standings.map((r) => {
      let t = r.finishTime;
      if (t === null) {
        const pace = r.raceDist > 10 && this.time > 0 ? r.raceDist / this.time : r.baseTopSpeed * 0.7;
        t = this.time + Math.max(0, total - r.raceDist) / Math.max(1, pace);
        t = Math.max(t, prevT + R.estimateGap);
      }
      prevT = t;
      return { racer: r, totalTime: t, estimated: r.finishTime === null };
    });
  }
}
