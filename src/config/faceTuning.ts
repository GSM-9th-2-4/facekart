// Face-pipeline-only numbers (kept apart from kart handling in tuning.ts).
export const FACE_TUNING = {
  /** Output texture size (px, square). */
  size: 256,
  /** Target distance between eye centers in the output (px). Shrunk if the face would not fit. */
  eyeDistancePx: 72,
  /** Max fraction of the canvas the expanded face oval may span. */
  maxFaceSpan: 0.96,
  /** Face-oval polygon is scaled by this around its center before masking. */
  ovalExpand: 1.08,
  /** Mask edge blur radius (px). */
  featherPx: 6,
  /** Max nose-vs-cheek asymmetry (0 = frontal, 1 = full profile) before "turn to front". */
  maxYaw: 0.35,
  /** Cartoon tone step (saturation boost + posterize). */
  cartoon: true,
  saturation: 1.25,
  posterizeLevels: 8,
  /** Angular size of the decal patch on the head sphere (degrees, horizontal and vertical). */
  decalCoverDeg: 150,
  /** Decal radius as a multiple of the head radius (sits just above the surface). */
  decalLift: 1.01,
  /** Head color when skin can't be sampled. */
  defaultSkin: '#f2c9a0',
} as const;
