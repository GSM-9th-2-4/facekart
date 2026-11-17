import { TUNING } from '../config/tuning';
import kartsData from '../data/karts.json';
import type { KartPhysicsParams } from './KartController';

export interface KartStats {
  topSpeed: number;
  accel: number;
  cornering: number;
  boostCharge: number;
}
export interface KartDef {
  id: string;
  name: string;
  tier: string;
  color: string;
  stats: KartStats;
  notes: string;
}

const KARTS: readonly KartDef[] = kartsData;
export const DEFAULT_KART_ID = 'practice';

export const getKarts = (): readonly KartDef[] => KARTS;
export const getKart = (id: string): KartDef | undefined => KARTS.find((k) => k.id === id);

/** Base (Practice Kart) physics scaled by kart stats. No kart → baseline. Same path for player and AI. */
export function makeKartParams(kart?: KartDef): KartPhysicsParams {
  const p: KartPhysicsParams = { ...TUNING.kart };
  if (!kart) return p;
  const { baseStat, statStepPct } = TUNING.stats;
  const mul = (stat: number) => 1 + (stat - baseStat) * statStepPct;
  const s = kart.stats;
  p.topSpeed *= mul(s.topSpeed); // booster / instant-boost top speed are multipliers of this, so they follow
  p.accel *= mul(s.accel);
  const corner = mul(s.cornering);
  p.steerRate *= corner;
  p.driftSteerRate *= corner;
  p.grip *= corner;
  p.driftGrip *= corner;
  p.gaugeRate *= mul(s.boostCharge);
  return p;
}
