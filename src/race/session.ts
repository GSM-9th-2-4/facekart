import * as THREE from 'three';
import { AI_TUNING } from '../config/aiTuning';
import { ChaseCamera, getKart, getKarts, KartVisual, makeWallColliderFromPushOut, DEFAULT_KART_ID, type KartControls } from '../kart';
import { applyFaceToHead, makeDefaultHeadTexture } from '../face';
import { buildTrack } from '../track';
import { LinePath, buildRacingLine } from '../ai/LinePath';
import type { HudState, MinimapMarker, RaceSetup, ResultsParams } from '../ui';
import { storage } from '../core/storage';
import { audio } from '../core/audio';
import { KartEffects } from '../kart/effects';
import { Race, type RaceTrack, type RacerSpec } from './Race';

let defaultFace: string | null = null;
/** Cartoon face for drivers without a photo (built once). */
export const getDefaultFace = () => (defaultFace ??= makeDefaultHeadTexture());

const shuffle = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export type RaceSession = ReturnType<typeof createRaceSession>;

/** Builds track + karts for one race into its own scene. Call dispose() before starting another. */
export function createRaceSession(setup: RaceSetup, camera: THREE.PerspectiveCamera) {
  const scene = new THREE.Scene();
  const track = buildTrack(setup.trackId, scene);
  const halfW = track.checkpoints[0].halfWidth;
  const line = new LinePath(buildRacingLine(track.racingLine, halfW));

  // Grid headings: make sure they point along the driving direction in the kart convention (forward = sin h, cos h).
  const cp0 = track.checkpoints[0];
  const grid = track.startGrid.map((g) => ({
    x: g.x,
    z: g.z,
    heading: Math.sin(g.heading) * cp0.nx + Math.cos(g.heading) * cp0.nz >= 0 ? g.heading : g.heading + Math.PI,
  }));
  const raceTrack: RaceTrack = {
    checkpoints: track.checkpoints,
    startGrid: grid,
    surfaceAt: (x, z) => track.surfaceAt(x, z),
    heightAt: (x, z) => track.heightAt(x, z),
    rampAt: (x, z, s) => track.rampAt(x, z, s),
    walls: makeWallColliderFromPushOut((x, z, r) => track.collide({ x, z }, r)),
  };

  // Field: player in the middle of the grid, AI on distinct random karts with spread-out skills.
  const aiCount = setup.mode === 'time' ? 0 : Math.max(0, Math.min(7, setup.aiCount));
  const { skillMin, skillMax } = AI_TUNING.ai;
  const karts = shuffle([...getKarts()]);
  const faces = shuffle([...setup.aiFaceDataUrls]);
  const skills = shuffle(Array.from({ length: aiCount }, (_, i) => (aiCount > 1 ? skillMin + ((skillMax - skillMin) * i) / (aiCount - 1) : skillMax)));
  const ai: RacerSpec[] = skills.map((skill, i) => {
    const kart = karts[i % karts.length];
    return { name: kart.name, kart, color: kart.color, isPlayer: false, faceUrl: faces[i] ?? null, skill };
  });
  const playerKart = getKart(setup.kartId) ?? getKart(DEFAULT_KART_ID)!;
  const player: RacerSpec = { name: 'You', kart: playerKart, color: setup.kartColor, isPlayer: true, faceUrl: setup.faceDataUrl };
  const specs = [...ai];
  specs.splice(Math.floor(aiCount / 2), 0, player);

  const race = new Race(raceTrack, line, halfW, setup.laps, specs);
  const visuals = race.racers.map((r) => {
    const v = new KartVisual(r.color);
    applyFaceToHead(v.head, r.faceUrl ?? getDefaultFace());
    scene.add(v.group);
    return v;
  });
  const chase = new ChaseCamera(camera, race.player.ctrl);
  const fx = new KartEffects(scene);
  let lastCountdown: string | null = null;
  audio.engine.start();
  const outline = track.minimap.main;

  return {
    scene,
    race,
    track,
    outline,
    step(dt: number, controls: KartControls) {
      track.update(dt);
      const k = race.player.ctrl;
      const before = { boost: k.boostTimer, inst: k.instantBoostTimer, stock: k.boosterStock, speed: k.speed };
      race.step(dt, controls);
      // player sound cues from state changes
      if (k.boostTimer > before.boost + 0.01) audio.play('boost');
      else if (k.instantBoostTimer > before.inst + 0.01) audio.play('instantBoost');
      if (k.boosterStock > before.stock) audio.play('gaugeFull');
      if (before.speed - k.speed > AI_TUNING.race.crashSpeedDrop * dt * 60 && controls.throttle >= 0) audio.play('crash');
      const cd = race.countdownLabel;
      if (cd !== lastCountdown && cd) audio.play(cd === 'GO!' ? 'go' : 'countdown');
      lastCountdown = cd;
    },
    /** frameDt = 0 while paused (freezes particles and silences the engine). */
    render(frameDt: number) {
      const pk = race.player.ctrl;
      const live = frameDt > 0 && race.state !== 'results';
      audio.engine.update(live ? Math.abs(pk.speed) / pk.params.topSpeed : 0, live ? 1 : 0);
      audio.drift.set(live && pk.isDrifting, Math.min(1, Math.abs(pk.slip) / pk.params.maxDriftAngle));
      fx.update(frameDt, race.racers.map((r) => r.ctrl));
      const t = performance.now() / 1000;
      race.racers.forEach((r, i) => {
        visuals[i].update(r.ctrl, frameDt, t);
        visuals[i].group.position.y = r.y;
      });
      chase.update(race.player.ctrl, frameDt);
    },
    hudState(): HudState {
      const p = race.player;
      const k = p.ctrl;
      return {
        speedKmh: Math.abs(k.speed) * 3.6,
        boostGauge: k.gauge,
        boostStock: k.boosterStock,
        lap: race.lapOf(p),
        laps: race.laps,
        position: p.position,
        racers: race.racers.length,
        lapTime: p.finishTime !== null ? (p.lapTimes.at(-1) ?? 0) : race.time - p.lapStart,
        lapTimes: p.lapTimes,
        countdown: race.countdownLabel,
      };
    },
    markers(): MinimapMarker[] {
      return race.racers.map((r) => ({ x: r.ctrl.x, z: r.ctrl.z, color: r.color, isPlayer: r.isPlayer }));
    },
    /** Saves records and builds the Results screen params. Call once when race.state === 'results'. */
    finish(): ResultsParams {
      const res = race.results();
      const p = race.player;
      const bestLap = p.lapTimes.length ? Math.min(...p.lapTimes) : null;
      // a total only compares fairly at the track's standard lap count
      const total = setup.laps === track.meta.laps ? p.finishTime : null;
      const newRecord = storage.submitRecord(setup.trackId, bestLap, total);
      return {
        trackName: track.meta.name,
        standings: res.map(({ racer, totalTime }) => ({ name: racer.name, isPlayer: racer.isPlayer, totalTime, color: racer.color })),
        lapTimes: p.lapTimes,
        newRecord,
        winnerFaceUrl: res[0]?.racer.faceUrl ?? getDefaultFace(),
      };
    },
    dispose() {
      race.onEvent = undefined;
      audio.engine.stop();
      audio.drift.set(false, 0);
      fx.dispose();
      for (const v of visuals) {
        applyFaceToHead(v.head, null);
        v.dispose();
      }
      track.dispose();
    },
  };
}
