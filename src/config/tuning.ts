// All handling / feel numbers live here. Other files import from this module only.
// Units: metres, seconds, radians. 1 m/s = 3.6 km/h.
export const TUNING = {
  world: {
    groundSize: 2000,
    markerCount: 400, // scattered boxes so motion is visible on the empty plane
    markerSpread: 400, // half-size of the area markers are scattered in (m)
  },
  physics: {
    stepHz: 60, // fixed simulation rate
    maxFrameTime: 0.25, // clamp long frames (tab switch) so we don't spiral
  },
  kart: {
    // --- speed ---
    topSpeed: 30, // m/s (~108 km/h) for the Practice Kart
    accel: 14, // m/s² at standstill; tapers toward top speed
    accelTaper: 0.6, // 0 = constant accel, 1 = accel reaches 0 at top speed
    brakeDecel: 30, // m/s² when pressing ↓ while rolling forward
    reverseAccel: 10, // m/s² reversing
    reverseTopSpeed: 9, // m/s
    coastDecel: 5, // m/s² rolling resistance with no throttle
    overspeedDecel: 10, // m/s² bleed when above current max speed (smooth boost tail)

    // --- steering / grip ---
    steerRate: 2.2, // rad/s yaw at full steer, normal driving
    steerFullSpeed: 8, // m/s; below this steering scales down linearly
    grip: 14, // 1/s; how fast velocity direction converges to heading (high = grippy)

    // --- drift ---
    driftMinSpeed: 8, // m/s; can't start / keep a drift below this
    driftSteerDeadzone: 0.1, // |steer| needed (with Shift) to start a drift
    driftEntryKick: 0.12, // rad; instant yaw added on drift start so the slide shows immediately
    driftSteerRate: 3.0, // rad/s yaw at full steer while drifting (heading outruns velocity)
    driftHoldSteer: 0.45, // extra steer toward drift side so a neutral stick keeps the arc
    driftGrip: 1.6, // 1/s; lateral grip while drifting (low = long slide)
    maxDriftAngle: 0.65, // rad (~37°) slip cap
    driftSpeedLoss: 0.25, // fraction of speed lost per second while drifting (throttle partly offsets; long drift settles ~12% below top)
    gripRecoveryTime: 0.35, // s; grip ramps driftGrip → grip after the drift ends

    // --- booster gauge ---
    gaugeRate: 0.35, // gauge per second at top speed and max slip (≈3 s of full drift = 1 booster)
    maxBoosterStock: 2,

    // --- booster (Ctrl) ---
    boostTime: 1.2, // s; re-firing while boosting refreshes the timer
    boostTopSpeedMul: 1.35, // top speed multiplier while boosting
    boostAccel: 30, // m/s² extra forward accel while boosting

    // --- instant boost (↑ right after a drift) ---
    instantBoostWindow: 0.25, // s after drift end in which ↑ triggers it
    instantBoostTime: 0.5, // s
    instantBoostPower: 18, // m/s² extra forward accel
    instantBoostTopSpeedMul: 1.12, // top speed multiplier during instant boost

    // --- walls ---
    wallSpeedLoss: 0.4, // fraction of speed lost on wall hit
    radius: 1.1, // m; collision radius passed to the wall hook
  },
  camera: {
    fov: 70,
    boostFovAdd: 10, // degrees added while boosting
    fovLerp: 4, // 1/s
    distance: 7,
    height: 3,
    lookAhead: 4,
    lookHeight: 0.8,
    posLerp: 8, // 1/s; position follow speed
    yawLerp: 6, // 1/s; how fast camera swings behind the kart
    driftYawFollow: 0.35, // 0 = camera follows velocity in drifts (slide fully visible), 1 = follows heading
  },
  visual: {
    wheelSpinScale: 2.5, // wheel rotation per metre (≈ 1 / wheel radius)
    steerWheelAngle: 0.4, // rad; front wheel visual steer angle
    flameFlickerHz: 30,
  },
} as const;
