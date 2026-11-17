// Kart data access shared by Lobby / Garage / Track select.
import karts from '../../data/karts.json';
import { storage } from '../../core/storage';

export type KartDef = (typeof karts)[number];
export const KARTS: KartDef[] = karts;

export function selectedKart(): KartDef {
  const id = storage.getSelectedKartId();
  return KARTS.find((k) => k.id === id) ?? KARTS[0];
}
export const kartColor = (k: KartDef) => storage.getKartColors()[k.id] ?? k.color;
