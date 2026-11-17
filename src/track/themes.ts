// Theme colour table. Themes only change colours, lighting, scenery and surface look (PLAN §4.2).
export interface Theme {
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  ground: number;
  road: number;
  roadLine: number;
  wall: number;
  wallTop: number;
  curbA: number;
  curbB: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sun: number;
  sunIntensity: number;
}

const base: Theme = {
  sky: 0x87ceeb,
  fog: 0x87ceeb,
  fogNear: 150,
  fogFar: 700,
  ground: 0x4caf50,
  road: 0x55585e,
  roadLine: 0xffffff,
  wall: 0xe8e8e8,
  wallTop: 0xd32f2f,
  curbA: 0xd32f2f,
  curbB: 0xffffff,
  hemiSky: 0xffffff,
  hemiGround: 0x556644,
  hemiIntensity: 1.2,
  sun: 0xffffff,
  sunIntensity: 2.2,
};

export const THEMES: Record<string, Theme> = {
  practice: base,
  village: { ...base, sky: 0x9fd8ff, fog: 0xbfe4ff, ground: 0x6abf4b, road: 0x5a5a5a, wall: 0xb5835a, wallTop: 0x8d5a34 },
  desert: { ...base, sky: 0xf6d7a7, fog: 0xf0c890, fogFar: 800, ground: 0xd9a066, road: 0x8a6d4b, roadLine: 0xf5e6c8, wall: 0xb5651d, wallTop: 0x8a4a12, hemiGround: 0xa0704a, sun: 0xfff1d0 },
  ice: { ...base, sky: 0x0b1a2e, fog: 0x1d3557, fogNear: 60, fogFar: 380, ground: 0xcfe8ff, road: 0x9ad0ec, roadLine: 0xe6f7ff, wall: 0x6fa8dc, wallTop: 0xd6f0ff, curbA: 0x3a7bd5, hemiSky: 0xbfdfff, hemiGround: 0x335577, hemiIntensity: 1.0, sun: 0xbfe0ff, sunIntensity: 1.4 },
  mine: { ...base, sky: 0x1a120b, fog: 0x2b1d12, fogNear: 50, fogFar: 320, ground: 0x4a3626, road: 0x6b5843, roadLine: 0xd9b26f, wall: 0x5c4033, wallTop: 0x8a6a40, curbA: 0xd9a400, curbB: 0x222222, hemiSky: 0xffd9a0, hemiGround: 0x332211, hemiIntensity: 0.9, sun: 0xffb060, sunIntensity: 1.3 },
  city: { ...base, sky: 0x0a0a23, fog: 0x14143a, fogNear: 80, fogFar: 520, ground: 0x222233, road: 0x2c2c34, roadLine: 0xffe066, wall: 0x3a3a48, wallTop: 0xffcc00, curbA: 0xffcc00, curbB: 0x222222, hemiSky: 0x8888ff, hemiGround: 0x111122, hemiIntensity: 0.8, sun: 0x9fb4ff, sunIntensity: 0.9 },
  beach: { ...base, sky: 0x7fd6ff, fog: 0xa8e4ff, ground: 0xf2deaa, road: 0x9e8b6e, roadLine: 0xfff4d6, wall: 0x8b5a2b, wallTop: 0x5d3a1a, curbA: 0x1e88e5, hemiGround: 0xc8b080 },
  factory: { ...base, sky: 0x30343b, fog: 0x3a3f47, fogNear: 70, fogFar: 420, ground: 0x4a4e55, road: 0x3a3d42, roadLine: 0xf2c200, wall: 0x6b7078, wallTop: 0xf2c200, curbA: 0xf2c200, curbB: 0x222222, hemiSky: 0xdde4ff, hemiGround: 0x333333, hemiIntensity: 1.0, sun: 0xffffff, sunIntensity: 1.6 },
};

export function getTheme(id: string): Theme {
  return THEMES[id] ?? base;
}
