// All localStorage access goes through here. Every read is validated; corrupted / missing data → defaults.
const PREFIX = 'facekart:v1:';
export const MAX_FACES = 8;
const MAX_FACE_URL_LEN = 400_000; // a 256×256 PNG is well under this

export type GameMode = 'speed' | 'item' | 'time';
export interface SavedFace { id: string; name: string; dataUrl: string }
export interface Settings { volume: number; resolutionScale: number }
export interface TrackRecord { bestLap: number | null; bestTotal: number | null; date: string }
export interface RaceSetupPrefs { trackId: string | null; laps: number; aiCount: number }
export type KeyBindings = Record<string, string[]>;
export type SaveResult = { ok: true } | { ok: false; error: string };

export const DEFAULT_SETTINGS: Settings = { volume: 0.8, resolutionScale: 1 };
export const DEFAULT_RACE_SETUP: RaceSetupPrefs = { trackId: null, laps: 3, aiCount: 7 };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const numOrNull = (v: unknown) => v === null || isNum(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function read<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const v: unknown = JSON.parse(raw);
    return valid(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): SaveResult {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    return { ok: false, error: quota ? 'Browser storage is full. Delete a saved face and try again.' : 'Could not save (storage unavailable).' };
  }
}

const validFace = (v: unknown): v is SavedFace =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isStr(v.dataUrl) && v.dataUrl.startsWith('data:image/') && v.dataUrl.length <= MAX_FACE_URL_LEN;

export const storage = {
  getSelectedKartId: () => read<string | null>('selectedKartId', null, isStr),
  setSelectedKartId: (id: string) => write('selectedKartId', id),

  getKartColors: () => read<Record<string, string>>('kartColors', {}, (v) => isObj(v) && Object.values(v).every(isStr)),
  /** color = null resets to the kart's default color. */
  setKartColor(kartId: string, color: string | null) {
    const all = storage.getKartColors();
    if (color === null) delete all[kartId];
    else all[kartId] = color;
    return write('kartColors', all);
  },

  /** Invalid entries are dropped, the rest kept. */
  getFaces: (): SavedFace[] => read<unknown[]>('faces', [], Array.isArray).filter(validFace).slice(0, MAX_FACES),
  addFace(face: SavedFace): SaveResult {
    if (!validFace(face)) return { ok: false, error: 'Face image is invalid or too large.' };
    const faces = storage.getFaces();
    if (faces.length >= MAX_FACES) return { ok: false, error: `You can save up to ${MAX_FACES} faces. Delete one first.` };
    return write('faces', [...faces, face]);
  },
  deleteFace(id: string): SaveResult {
    const r = write('faces', storage.getFaces().filter((f) => f.id !== id));
    if (storage.getSelectedFaceId() === id) storage.setSelectedFaceId(null);
    storage.setAiFaceIds(storage.getAiFaceIds().filter((x) => x !== id));
    return r;
  },
  getSelectedFaceId: () => read<string | null>('selectedFaceId', null, isStr),
  setSelectedFaceId: (id: string | null) => write('selectedFaceId', id),
  getSelectedFace: (): SavedFace | null => storage.getFaces().find((f) => f.id === storage.getSelectedFaceId()) ?? null,
  /** Saved faces AI karts may wear. */
  getAiFaceIds: () => read<string[]>('aiFaceIds', [], (v) => Array.isArray(v) && v.every(isStr)),
  setAiFaceIds: (ids: string[]) => write('aiFaceIds', ids),

  getKeyBindings: () =>
    read<KeyBindings | null>('keyBindings', null, (v) => isObj(v) && Object.values(v).every((a) => Array.isArray(a) && a.every(isStr))),
  setKeyBindings: (b: KeyBindings | null) => write('keyBindings', b),

  getSettings(): Settings {
    const s = read<Partial<Settings>>('settings', {}, isObj);
    return {
      volume: isNum(s.volume) ? clamp(s.volume, 0, 1) : DEFAULT_SETTINGS.volume,
      resolutionScale: isNum(s.resolutionScale) ? clamp(s.resolutionScale, 0.25, 2) : DEFAULT_SETTINGS.resolutionScale,
    };
  },
  setSettings: (s: Settings) => write('settings', s),

  getMode: () => read<GameMode>('mode', 'speed', (v) => v === 'speed' || v === 'time'), // 'item' not playable yet
  setMode: (m: GameMode) => write('mode', m),

  getRecords: () =>
    read<Record<string, TrackRecord>>('records', {}, (v) =>
      isObj(v) && Object.values(v).every((r) => isObj(r) && numOrNull(r.bestLap) && numOrNull(r.bestTotal) && isStr(r.date)),
    ),
  getRecord: (trackId: string): TrackRecord | null => storage.getRecords()[trackId] ?? null,
  /** Times in seconds. Saves improvements and reports which ones are new records. */
  submitRecord(trackId: string, bestLap: number | null, total: number | null) {
    const all = storage.getRecords();
    const old = all[trackId];
    const newLap = isNum(bestLap) && (old?.bestLap == null || bestLap < old.bestLap);
    const newTotal = isNum(total) && (old?.bestTotal == null || total < old.bestTotal);
    if (newLap || newTotal) {
      all[trackId] = {
        bestLap: newLap ? bestLap : (old?.bestLap ?? null),
        bestTotal: newTotal ? total : (old?.bestTotal ?? null),
        date: new Date().toISOString(),
      };
      write('records', all);
    }
    return { newLap, newTotal };
  },

  getRaceSetup(): RaceSetupPrefs {
    const s = read<Partial<RaceSetupPrefs>>('raceSetup', {}, isObj);
    return {
      trackId: isStr(s.trackId) ? s.trackId : null,
      laps: isNum(s.laps) ? clamp(Math.round(s.laps), 1, 9) : DEFAULT_RACE_SETUP.laps,
      aiCount: isNum(s.aiCount) ? clamp(Math.round(s.aiCount), 0, 7) : DEFAULT_RACE_SETUP.aiCount,
    };
  },
  setRaceSetup: (s: RaceSetupPrefs) => write('raceSetup', s),
};
