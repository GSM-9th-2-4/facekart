// Tiny DOM helpers + shared UI types. No framework.
import type { Bindings } from '../core/input';
import type { GameMode } from '../core/storage';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** h('button', { class: 'btn', onclick: fn }, 'Start') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k in el && k !== 'style' && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** seconds → m:ss.mmm ('--:--.---' for null) */
export function fmtTime(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '--:--.---';
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(3).padStart(6, '0')}`;
}

/** Stable bright color for a theme name (thumbnails, cards). */
const THEME_COLORS: Record<string, string> = {
  village: '#43a047', desert: '#f9a825', snow: '#4fc3f7', ice: '#4fc3f7', city: '#7e57c2', night: '#3949ab',
  beach: '#26c6da', forest: '#2e7d32', lava: '#e53935', volcano: '#e53935', space: '#5e35b1', candy: '#ec407a',
};
export function themeColor(theme: string): string {
  const key = theme.toLowerCase();
  for (const [k, c] of Object.entries(THEME_COLORS)) if (key.includes(k)) return c;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 70% 50%)`;
}

const ARROWS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
export const keyLabel = (code: string) => ARROWS[code] ?? code.replace(/^(Key|Digit)/, '').replace(/(.)(Left|Right)$/, '$1 $2');

// ---- shared types ----

export interface TrackInfo { id: string; name: string; theme: string; difficulty: number; laps: number }
export type FaceResult = { ok: true; dataUrl: string } | { ok: false; error: string };
export type FaceSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

export interface RaceSetup {
  trackId: string;
  laps: number;
  aiCount: number;
  mode: GameMode;
  kartId: string;
  kartColor: string;
  /** Player's active face (null = default head). */
  faceDataUrl: string | null;
  /** Faces AI karts may wear (may be empty). */
  aiFaceDataUrls: string[];
}

export type ScreenName = 'title' | 'settings' | 'lobby' | 'garage' | 'face' | 'trackSelect' | 'loading' | 'hud' | 'results';

export interface UiCallbacks {
  /** Track select → Start. Main should show('loading', …), build the race, then show('hud'). */
  onStartRace(setup: RaceSetup): void;
  /** Results / Pause → Retry. Main restarts the same race (and shows loading/hud itself). */
  onRetry(): void;
  /** Results / Pause → Lobby. UI already switched to the lobby; main should tear down the race. */
  onLobby(): void;
  /** User paused (true) or resumed (false) from the HUD / pause menu. */
  onPauseToggle(paused: boolean): void;
  /** Settings changed (volume, resolution scale). */
  onSettingsChanged?(s: { volume: number; resolutionScale: number }): void;
  /** Kart, kart color or face selection changed (refresh the lobby 3D preview). */
  onSelectionChanged?(): void;
  /** Fired after every show(); use it to enable the lobby 3D preview when name === 'lobby'. */
  onScreenChange?(name: ScreenName): void;
}

export interface UiDeps {
  root: HTMLElement;
  tracks: TrackInfo[];
  input: { getBindings(): Bindings; setBindings(b: Bindings): void; defaultBindings: Bindings };
  face: {
    createFaceFromImage(src: FaceSource): Promise<FaceResult>;
    startWebcam(video: HTMLVideoElement): Promise<() => void>;
  };
  on: UiCallbacks;
}

/** What screens get from the manager. */
export interface UiCtx {
  deps: UiDeps;
  go(name: ScreenName, params?: unknown): void;
  setPaused(paused: boolean, notify?: boolean): void;
}

export interface ScreenInstance {
  el: HTMLElement;
  /** Esc. */
  back?(): void;
  /** Return true to consume the key before default nav. */
  onKey?(e: KeyboardEvent): boolean;
  destroy?(): void;
}

export const btn = (label: Child, onclick: () => void, cls = '', extra: Props = {}) =>
  h('button', { class: `fk-btn ${cls}`, type: 'button', onclick, ...extra }, label);

/** Full-screen layer with a centered panel. */
export const screen = (cls: string, ...children: Child[]) => h('div', { class: `fk-screen ${cls}` }, ...children);
