// AI driver + race-flow numbers. Units: metres, seconds, radians.
export const AI_TUNING = {
  race: {
    introTime: 1.0, // s before "3" appears
    countdownStep: 1.0, // s per 3 / 2 / 1
    goShowTime: 0.8, // s the "GO!" label stays up
    startBoostWindow: 0.3, // s: ↑ pressed this close to GO (before or after) gives a start boost
    startBoostTime: 0.8, // s of instant-boost thrust
    finishToResults: 3.0, // s after the player finishes before the Results screen
    checkpointMargin: 2, // m added to a checkpoint's half-width when testing crossings
    estimateGap: 0.4, // s minimum gap between estimated finish times of unfinished AI
    gravity: 25, // m/s² for ramp jumps
    crashSpeedDrop: 4, // m/s lost in one 60 Hz step (not braking) = wall crash sound
  },
  ai: {
    skillMin: 0.35, // default field: skills spread evenly between these, shuffled
    skillMax: 0.95,
    // racing line: centreline pulled toward the inside of corners
    lineInsideMax: 0.55, // fraction of half-width at most
    lineCurvatureFull: 0.03, // 1/m curvature that gives the full inside offset
    lineSmooth: 6, // samples each side for curvature / offset smoothing
    // following
    lookAheadBase: 6, // m
    lookAheadPerSpeed: 0.35, // extra m per m/s
    steerGain: 2.2, // steer per rad of heading error
    wanderMax: 0.45, // fraction of half-width a skill-0 AI drifts off the line
    wanderHz: 0.07, // lane wander speed
    paceMin: 0.88, // skill-0 AI lifts off above this fraction of its top speed (skill 1 = full speed)
    brakeAngle: 1.1, // rad heading error above which AI lifts / brakes
    // drifting
    cornerScanDist: 30, // m ahead to measure the upcoming turn
    driftTurnAngle: 0.55, // rad of turn within cornerScanDist that triggers a drift (skill 1)
    driftTurnAngleLowSkill: 0.9, // same, for skill 0 (drifts only in hairpins)
    driftExitAngle: 0.25, // rad: release the drift when the remaining turn falls below this
    instantBoostChance: [0.2, 0.9], // [skill 0, skill 1] chance to hit the instant boost after a drift
    // boosters
    boostStraightAngle: 0.2, // rad: fire boosters only when the upcoming turn is below this
    boostUseChance: [0.4, 1.0], // per straight, [skill 0, skill 1]
    // reactions
    reactionMin: 0.05, // s, skill 1
    reactionMax: 0.35, // s, skill 0
    // recovery
    stuckSpeed: 2, // m/s below this counts as stuck (after GO)
    stuckTime: 1.5, // s stuck → reverse
    reverseTime: 1.0, // s reversing
    respawnTime: 6, // s stuck → respawn on the line at the last checkpoint
  },
  rubberBand: {
    enabled: true,
    maxTopSpeedMul: 0.05, // ±5 % top speed
    range: 120, // m behind / ahead of the player for the full effect
  },
} as const;
