// Particle-effect numbers (kept apart from kart handling in tuning.ts).
export const FX_TUNING = {
  rearWheelX: 0.6, // local ± x of rear wheels
  rearWheelZ: -0.9, // local z of rear wheels (forward is +z)
  wheelY: 0.15,
  exhaustZ: -1.1, // local z of the boost flame
  exhaustY: 0.4,
  smoke: {
    pool: 600,
    size: 0.9, // world units
    rate: 40, // particles / s / wheel at full slip
    life: 0.7, // s
    rise: 1.2, // m/s upward
    spread: 0.8, // m/s random
    drag: 1.5, // 1/s
    alpha: 0.45,
    color: [0.85, 0.85, 0.85],
  },
  sparks: {
    pool: 500,
    size: 0.22,
    rate: 60, // per wheel per second while drifting
    life: 0.3,
    speed: 4, // m/s random burst
    gravity: 12,
    drag: 2,
    colorLow: [1.0, 0.75, 0.2], // small slip: orange-yellow
    colorHigh: [0.35, 0.65, 1.0], // big slip: blue
    slipForHigh: 0.6, // rad of slip at which color reaches colorHigh
  },
  boost: {
    pool: 500,
    size: 0.45,
    rate: 90, // per kart per second
    life: 0.35,
    backSpeed: 6, // m/s backwards relative to the kart
    spread: 1.2,
    drag: 3,
    color: [1.0, 0.45, 0.1],
    instantColor: [0.4, 0.95, 1.0],
  },
  minDriftSpeed: 3, // m/s; no smoke/sparks below this
} as const;
