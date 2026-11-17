/**
 * FaceKart UI — HTML overlay screens inside #ui.
 *
 * Wiring (main.ts):
 *   import { createUi } from './ui';
 *   import * as input from './core/input';
 *   import { listTracks } from './track';
 *   import { createFaceFromImage, startWebcam } from './face';
 *
 *   const ui = createUi({
 *     root: document.getElementById('ui')!,
 *     tracks: listTracks(),
 *     input: { getBindings: input.getBindings, setBindings: input.setBindings, defaultBindings: input.DEFAULT_BINDINGS },
 *     face: { createFaceFromImage, startWebcam },
 *     on: { onStartRace, onRetry, onLobby, onPauseToggle, onSettingsChanged?, onSelectionChanged?, onScreenChange? },
 *   });
 *   ui.show('title');
 *
 * createUi() also applies saved key bindings (storage → input.setBindings) on startup.
 *
 * ui.show(name, params) returns the screen handle:
 *   show('title' | 'settings' | 'lobby' | 'garage' | 'face' | 'trackSelect')
 *   show('loading', { trackName })            → { setProgress(0..1) }
 *   show('hud', { trackName? })               → HudApi: update(HudState), setTrackOutline(pts), setMarkers(m), pop(text)
 *   show('results', ResultsParams)            → {}
 * ui.setPaused(bool)  shows/hides the pause overlay over the HUD (does not fire onPauseToggle).
 * ui.hide()           removes everything (e.g. while racing without HUD).
 * ui.destroy()        removes the global key listener.
 *
 * Flow: Title → Lobby → (Garage | Face | Settings) → Track select → [onStartRace] → main: show('loading')
 *       → show('hud') → each frame hud.update(...) → finish: show('results') → Retry [onRetry] / Lobby [onLobby].
 *
 * PAUSE KEY: the UI owns it. While the HUD is shown, any key bound to the 'pause' action (default Esc)
 * opens the pause menu and fires onPauseToggle(true); Esc / Resume closes it → onPauseToggle(false).
 * main.ts must NOT also react to input.wasPressed('pause') or it will toggle twice.
 *
 * Units: times are seconds, speed is km/h, boost gauge 0..1, minimap points are world {x, z}.
 * Keyboard: arrows move focus, Enter activates, Esc = back. Mouse works everywhere.
 */
import './styles.css';
import { storage } from '../core/storage';
import type { Bindings } from '../core/input';
import type { ScreenInstance, ScreenName, UiCtx, UiDeps } from './dom';
import { titleScreen } from './screens/title';
import { settingsScreen } from './screens/settings';
import { lobbyScreen } from './screens/lobby';
import { garageScreen } from './screens/garage';
import { faceScreen } from './screens/face';
import { trackSelectScreen } from './screens/trackSelect';
import { loadingScreen } from './screens/loading';
import { hudScreen } from './screens/hud';
import { pauseScreen } from './screens/pause';
import { resultsScreen } from './screens/results';

export type { UiDeps, UiCallbacks, RaceSetup, TrackInfo, FaceResult, ScreenName } from './dom';
export type { HudState, HudApi, MinimapMarker } from './screens/hud';
export type { ResultsParams, Standing } from './screens/results';

const SCREENS = {
  title: titleScreen,
  settings: settingsScreen,
  lobby: lobbyScreen,
  garage: garageScreen,
  face: faceScreen,
  trackSelect: trackSelectScreen,
  loading: loadingScreen,
  hud: hudScreen,
  results: resultsScreen,
} satisfies Record<ScreenName, (ctx: UiCtx, params: never) => ScreenInstance>;

type Screens = typeof SCREENS;
type ParamsOf<N extends ScreenName> = Parameters<Screens[N]>[1];

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), [tabindex="0"]';

export function createUi(deps: UiDeps) {
  const { root } = deps;
  let current: ScreenInstance | null = null;
  let overlay: ScreenInstance | null = null;

  const saved = storage.getKeyBindings();
  if (saved) {
    // merge so a stored map from an older version never drops an action
    const merged = { ...deps.input.defaultBindings } as Bindings;
    for (const k of Object.keys(merged) as (keyof Bindings)[]) if (saved[k]) merged[k] = saved[k];
    deps.input.setBindings(merged);
  }

  function mount(inst: ScreenInstance) {
    inst.el.classList.add('fk-layer');
    root.appendChild(inst.el);
    // focus first control so Enter works immediately
    (inst.el.querySelector<HTMLElement>('[autofocus]') ?? inst.el.querySelector<HTMLElement>(FOCUSABLE))?.focus();
  }
  function unmount(inst: ScreenInstance | null) {
    if (!inst) return;
    inst.destroy?.();
    inst.el.remove();
  }

  function show<N extends ScreenName>(name: N, ...params: undefined extends ParamsOf<N> ? [ParamsOf<N>?] : [ParamsOf<N>]): ReturnType<Screens[N]> {
    unmount(overlay);
    overlay = null;
    unmount(current);
    const factory = SCREENS[name] as (ctx: UiCtx, p: unknown) => ScreenInstance;
    const inst = factory(ctx, params[0]);
    current = inst;
    mount(inst);
    deps.on.onScreenChange?.(name);
    return inst as ReturnType<Screens[N]>;
  }

  function setPaused(paused: boolean, notify = false) {
    if (paused === !!overlay) return;
    if (paused) {
      overlay = pauseScreen(ctx);
      mount(overlay);
    } else {
      unmount(overlay);
      overlay = null;
    }
    if (notify) deps.on.onPauseToggle(paused);
  }

  const ctx: UiCtx = {
    deps,
    go: (name, params) => (show as (n: ScreenName, p?: unknown) => unknown)(name, params),
    setPaused,
  };

  function onKey(e: KeyboardEvent) {
    const top = overlay ?? current;
    if (!top) return;
    if (top.onKey?.(e)) return;
    const active = document.activeElement as HTMLElement | null;
    const inTop = !!active && top.el.contains(active);
    const typing = inTop && active instanceof HTMLInputElement && (active.type === 'text' || active.type === 'range');

    if (e.key === 'Escape') {
      if (top.back) {
        e.preventDefault();
        top.back();
      }
      return;
    }
    if (e.key === 'Enter' && inTop && active instanceof HTMLInputElement && active.type === 'checkbox') {
      e.preventDefault();
      active.click();
      return;
    }
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // let caret / slider move
    const items = [...top.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    e.preventDefault();
    const i = inTop ? items.indexOf(active!) : -1;
    const next = items[(i + dir + items.length) % items.length] ?? items[0];
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
  }
  window.addEventListener('keydown', onKey);

  return {
    show,
    setPaused: (paused: boolean) => setPaused(paused, false),
    get isPaused() {
      return !!overlay;
    },
    hide() {
      unmount(overlay);
      unmount(current);
      overlay = current = null;
    },
    destroy() {
      window.removeEventListener('keydown', onKey);
      unmount(overlay);
      unmount(current);
      overlay = current = null;
    },
  };
}

export type Ui = ReturnType<typeof createUi>;
