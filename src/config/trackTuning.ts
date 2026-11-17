// Track-only numbers (surfaces, geometry generation). Part of the tuning config; kart handling lives in tuning.ts.
// Units: metres, seconds.
export const TRACK_TUNING = {
  surface: {
    ice: { gripMul: 0.3, speedMul: 1.0 },
    puddle: { gripMul: 0.8, speedMul: 0.6 },
    road: { gripMul: 1, speedMul: 1 },
    moving: { gripMul: 1, speedMul: 1 }, // push comes from zone params.speed / params.lateral
    defaultConveyorSpeed: 6, // m/s if a moving zone has no params.speed
  },
  ramp: {
    defaultHeight: 2.5, // m at the lip if a ramp zone has no params.height
    lipLength: 3, // m before the ramp end where rampAt() reports a launch
  },
  gen: {
    sampleSpacing: 2, // m between centreline samples (road mesh + collision)
    checkpointSpacing: 40, // m between checkpoints
    forkCheckpointMargin: 10, // m: no checkpoints this close to a fork split / merge
    wallHeight: 1.1,
    wallThickness: 0.6,
    curbWidth: 1.0,
    curbCurvature: 0.02, // 1/m: curbs where the centreline curvature exceeds this (radius < 50 m)
    gridFirstRow: 6, // m behind the start line
    gridRowGap: 6, // m between grid rows
    gridStagger: 3, // m: right column sits this much further back
    gridLateral: 0.3, // fraction of half-width for the two columns
    minWallGap: 4, // m: validator warns when two road parts are closer than this (wall-to-wall)
  },
  scenery: {
    minOffset: 4, // m outside the road edge
    maxOffset: 45,
  },
  obstacle: {
    defaultSize: 2.5,
    defaultPeriod: 3, // s per oscillation
    defaultAmp: 0.7, // fraction of half-width
  },
} as const;
