// Audio-only numbers (kept apart from kart handling in tuning.ts).
export const AUDIO_TUNING = {
  master: 0.7, // default master volume (0..1), overridden by audio.setVolume
  sfx: {
    click: 0.25,
    countdown: 0.4,
    go: 0.5,
    boost: 0.5,
    instantBoost: 0.45,
    crash: 0.6,
    gaugeFull: 0.35,
    finish: 0.5,
    lap: 0.4,
  },
  engine: {
    gain: 0.12, // at full speed
    idleGain: 0.05, // at standstill
    throttleGain: 0.04, // extra gain at full throttle
    idleHz: 55, // base oscillator pitch at standstill
    topHz: 165, // pitch at speedNorm 1 (keeps rising above 1 while boosting)
    filterHz: 900, // lowpass cutoff on the engine
    smoothing: 0.08, // setTargetAtTime time constant (s)
  },
  drift: {
    gain: 0.18, // at intensity 1
    bandHz: 2600, // bandpass centre for the screech
    bandQ: 6,
    fadeIn: 0.05, // time constants (s)
    fadeOut: 0.15,
  },
} as const;
