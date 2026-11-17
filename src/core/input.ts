// Remappable keyboard input. Bindings use KeyboardEvent.code.
export type Action = 'up' | 'down' | 'left' | 'right' | 'drift' | 'boost' | 'pause';
export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  drift: ['ShiftLeft', 'ShiftRight'],
  boost: ['ControlLeft', 'ControlRight', 'KeyZ'], // KeyZ: macOS grabs Ctrl+arrows for Spaces
  pause: ['Escape'],
};

let bindings: Bindings = structuredClone(DEFAULT_BINDINGS);
const down = new Set<string>();
const pressed = new Set<string>();

const isBound = (code: string) => Object.values(bindings).some((codes) => codes.includes(code));

function onKeyDown(e: KeyboardEvent) {
  if (!isBound(e.code)) return;
  e.preventDefault();
  if (!e.repeat && !down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
}
function onKeyUp(e: KeyboardEvent) {
  if (!isBound(e.code)) return;
  e.preventDefault();
  down.delete(e.code);
}
function onBlur() {
  down.clear();
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', onBlur);

export function setBindings(next: Bindings) {
  bindings = structuredClone(next);
  down.clear();
  pressed.clear();
}
export const getBindings = (): Bindings => structuredClone(bindings);
export const isDown = (a: Action) => bindings[a].some((c) => down.has(c));
export const wasPressed = (a: Action) => bindings[a].some((c) => pressed.has(c));
/** Clears edge flags. Call after each consumer has read wasPressed(). */
export const endFrame = () => pressed.clear();

export function dispose() {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', onBlur);
  down.clear();
  pressed.clear();
}
