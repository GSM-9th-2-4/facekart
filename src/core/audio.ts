// Procedural Web Audio SFX (no asset files needed).
//
// Wiring (main.ts / race code):
//   import { audio } from './core/audio';
//   window.addEventListener('pointerdown', () => audio.unlock(), { once: true });  // + 'keydown'
//   audio.setVolume(settings.volume);              // 0..1, from storage/settings screen
//   audio.play('click');                           // UI buttons; 'countdown' on 3-2-1, 'go' on GO,
//                                                  // 'boost' / 'instantBoost' when they fire, 'crash' on wall hit,
//                                                  // 'gaugeFull' when a booster is earned, 'lap' / 'finish'
//   race start: audio.engine.start();  race end / leave: audio.engine.stop(); audio.drift.set(false, 0);
//   each frame:  audio.engine.update(Math.abs(kart.speed) / kart.params.topSpeed, input.throttle);
//                audio.drift.set(kart.isDrifting, Math.min(1, Math.abs(kart.slip) / 0.6));
// If public/assets/sfx/<name>.(ogg|mp3|wav) exists it is used instead of the synth for that name.
// Every call is a silent no-op when Web Audio is unavailable or not yet unlocked.
import { AUDIO_TUNING as T } from '../config/audioTuning';

export type SfxName = keyof typeof T.sfx;

type Ctx = AudioContext;

const SFX_NAMES = Object.keys(T.sfx) as SfxName[];
const EXTS = ['ogg', 'mp3', 'wav'];

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let volume: number = T.master;
const samples = new Map<string, AudioBuffer>();
const LAYERS = T.engine.layers;

function getCtx(): Ctx | null {
  if (ctx) return ctx;
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    void loadSamples(ctx);
  } catch {
    ctx = null;
  }
  return ctx;
}

async function loadSamples(c: Ctx) {
  const base = import.meta.env.BASE_URL ?? '/';
  await Promise.all(
    [...SFX_NAMES, ...LAYERS.map((l) => l.name)].map(async (name) => {
      for (const ext of EXTS) {
        try {
          const res = await fetch(`${base}assets/sfx/${name}.${ext}`);
          // Vite's SPA fallback answers missing files with index.html (200), so check the type.
          if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) continue;
          samples.set(name, await c.decodeAudioData(await res.arrayBuffer()));
          return;
        } catch {
          /* try next extension */
        }
      }
    }),
  );
}

// --- synth helpers ---
function tone(c: Ctx, out: AudioNode, t0: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function burst(c: Ctx, out: AudioNode, t0: number, filter: BiquadFilterType, hz: number, dur: number, gain: number) {
  if (!noise) return;
  const s = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = noise;
  f.type = filter;
  f.frequency.value = hz;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t0);
  s.stop(t0 + dur + 0.02);
}

const RECIPES: Record<SfxName, (c: Ctx, out: AudioNode, t: number, v: number) => void> = {
  click: (c, o, t, v) => tone(c, o, t, 'square', 1200, 800, 0.05, v),
  countdown: (c, o, t, v) => tone(c, o, t, 'square', 440, 440, 0.25, v),
  go: (c, o, t, v) => tone(c, o, t, 'square', 880, 880, 0.6, v),
  boost: (c, o, t, v) => {
    burst(c, o, t, 'lowpass', 1500, 0.6, v);
    tone(c, o, t, 'sawtooth', 120, 480, 0.5, v * 0.6);
  },
  instantBoost: (c, o, t, v) => {
    burst(c, o, t, 'highpass', 2500, 0.25, v * 0.8);
    tone(c, o, t, 'triangle', 600, 1400, 0.2, v);
  },
  crash: (c, o, t, v) => {
    burst(c, o, t, 'lowpass', 600, 0.35, v);
    tone(c, o, t, 'square', 140, 50, 0.25, v * 0.7);
  },
  gaugeFull: (c, o, t, v) => {
    tone(c, o, t, 'triangle', 880, 880, 0.12, v);
    tone(c, o, t + 0.1, 'triangle', 1320, 1320, 0.2, v);
  },
  lap: (c, o, t, v) => {
    tone(c, o, t, 'square', 660, 660, 0.12, v);
    tone(c, o, t + 0.13, 'square', 990, 990, 0.25, v);
  },
  finish: (c, o, t, v) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, o, t + i * 0.14, 'square', f, f, i === 3 ? 0.6 : 0.14, v));
  },
};

// --- looping voices ---
class Engine {
  private osc: OscillatorNode[] = [];
  // Recorded layers (used when every engine loop file loaded); otherwise the synth oscillators.
  private loops: { src: AudioBufferSourceNode; gain: GainNode; hz: number }[] = [];
  private wanted = false;
  private gain: GainNode | null = null;

  start() {
    this.wanted = true;
    const c = ctx; // never create before a user gesture (Chrome autoplay warning); update() retries once unlocked
    if (!c || c.state !== "running" || !master || this.gain) return;
    try {
      this.gain = c.createGain();
      this.gain.gain.value = 0;
      if (LAYERS.every((l) => samples.has(l.name))) {
        this.gain.connect(master);
        for (const l of LAYERS) {
          const src = c.createBufferSource();
          const gain = c.createGain();
          src.buffer = samples.get(l.name)!;
          src.loop = true;
          gain.gain.value = 0;
          src.connect(gain).connect(this.gain);
          src.start(c.currentTime, Math.random() * src.buffer.duration); // random phase so restarts don't sound identical
          this.loops.push({ src, gain, hz: l.hz });
        }
        return;
      }
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = T.engine.filterHz;
      lp.connect(this.gain).connect(master);
      // Saw at base pitch + square an octave down for body.
      for (const [type, mul] of [['sawtooth', 1], ['square', 0.5]] as const) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = T.engine.idleHz * mul;
        o.connect(lp);
        o.start();
        this.osc.push(o);
      }
    } catch {
      this.stop();
    }
  }

  update(speedNorm: number, throttle: number) {
    if (this.wanted && !this.gain) this.start();
    if (!ctx || !this.gain) return;
    const s = Math.max(0, Math.min(1.5, speedNorm));
    const g = T.engine.idleGain + (T.engine.gain - T.engine.idleGain) * Math.min(1, s) + T.engine.throttleGain * Math.max(0, throttle);
    const t = ctx.currentTime;
    if (this.loops.length) {
      const hz = T.engine.sampleIdleHz + (T.engine.sampleTopHz - T.engine.sampleIdleHz) * s;
      // Crossfade between the two layers whose recorded pitch brackets hz (in log-pitch space).
      const lh = Math.log(hz);
      this.loops.forEach((l, i) => {
        const lo = i > 0 ? Math.log(this.loops[i - 1].hz) : -Infinity;
        const hi = i < this.loops.length - 1 ? Math.log(this.loops[i + 1].hz) : Infinity;
        const me = Math.log(l.hz);
        const w = lh <= me ? (lh <= lo ? 0 : isFinite(lo) ? (lh - lo) / (me - lo) : 1) : lh >= hi ? 0 : isFinite(hi) ? (hi - lh) / (hi - me) : 1;
        l.gain.gain.setTargetAtTime(Math.sqrt(w), t, T.engine.smoothing); // equal-power
        l.src.playbackRate.setTargetAtTime(hz / l.hz, t, T.engine.smoothing);
      });
      this.gain.gain.setTargetAtTime(g * T.engine.sampleGain, t, T.engine.smoothing);
      return;
    }
    const hz = T.engine.idleHz + (T.engine.topHz - T.engine.idleHz) * s;
    this.osc.forEach((o, i) => o.frequency.setTargetAtTime(hz * (i === 0 ? 1 : 0.5), t, T.engine.smoothing));
    this.gain.gain.setTargetAtTime(g, t, T.engine.smoothing);
  }

  stop() {
    this.wanted = false;
    for (const o of this.osc) {
      try {
        o.stop();
        o.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.osc = [];
    for (const l of this.loops) {
      try {
        l.src.stop();
      } catch {
        /* already stopped */
      }
      l.src.disconnect();
      l.gain.disconnect();
    }
    this.loops = [];
    this.gain?.disconnect();
    this.gain = null;
  }
}

class Drift {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;

  set(active: boolean, intensity: number) {
    const c = ctx; // never creates the context; needs unlock() first
    if (!c || !master || !noise) return;
    try {
      if (!this.gain) {
        this.gain = c.createGain();
        this.gain.gain.value = 0;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = T.drift.bandHz;
        bp.Q.value = T.drift.bandQ;
        this.src = c.createBufferSource();
        this.src.buffer = noise;
        this.src.loop = true;
        this.src.connect(bp).connect(this.gain).connect(master);
        this.src.start();
      }
      const target = active ? T.drift.gain * Math.max(0, Math.min(1, intensity)) : 0;
      this.gain.gain.setTargetAtTime(target, c.currentTime, active ? T.drift.fadeIn : T.drift.fadeOut);
    } catch {
      /* ignore */
    }
  }

  dispose() {
    try {
      this.src?.stop();
    } catch {
      /* ignore */
    }
    this.src?.disconnect();
    this.gain?.disconnect();
    this.src = null;
    this.gain = null;
  }
}

export const audio = {
  engine: new Engine(),
  drift: new Drift(),

  unlock() {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  },

  setVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));
    if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  },

  play(name: SfxName) {
    const c = ctx;
    if (!c || !master || c.state !== 'running') return;
    try {
      const v = T.sfx[name];
      const buf = samples.get(name);
      if (buf) {
        const s = c.createBufferSource();
        const g = c.createGain();
        s.buffer = buf;
        g.gain.value = v;
        s.connect(g).connect(master);
        s.start();
      } else {
        RECIPES[name](c, master, c.currentTime, v);
      }
    } catch {
      /* ignore */
    }
  },

  dispose() {
    this.engine.stop();
    this.drift.dispose();
    samples.clear();
    ctx?.close().catch(() => {});
    ctx = master = noise = null;
  },
};
