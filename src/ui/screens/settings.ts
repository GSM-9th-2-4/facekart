import type { Action, Bindings } from '../../core/input';
import { storage } from '../../core/storage';
import { btn, h, keyLabel, screen, type ScreenName, type UiCtx } from '../dom';

const ACTION_LABELS: Record<Action, string> = {
  up: 'Accelerate', down: 'Brake / Reverse', left: 'Steer left', right: 'Steer right',
  drift: 'Drift', boost: 'Use booster', pause: 'Pause',
};
const SCALES = [0.5, 0.75, 1];

export function settingsScreen(ctx: UiCtx, params?: { from?: ScreenName }) {
  const { input, on } = ctx.deps;
  let bindings: Bindings = input.getBindings();
  let settings = storage.getSettings();
  /** [action, slot index] waiting for a key press */
  let capturing: [Action, number] | null = null;
  const status = h('p', { class: 'fk-note' });
  const rows = h('div', { class: 'fk-bindings' });

  function saveBindings(next: Bindings) {
    bindings = next;
    input.setBindings(next);
    const r = storage.setKeyBindings(next);
    status.textContent = r.ok ? '' : r.error;
    render();
  }

  function render() {
    rows.replaceChildren(
      ...(Object.keys(ACTION_LABELS) as Action[]).map((a) =>
        h('div', { class: 'fk-row' },
          h('span', { class: 'fk-row-label' }, ACTION_LABELS[a]),
          h('span', { class: 'fk-chips' },
            ...[...bindings[a], null].map((code, i) => {
              const waiting = capturing?.[0] === a && capturing[1] === i;
              return btn(waiting ? 'Press a key…' : code ? keyLabel(code) : '+', () => startCapture(a, i),
                `fk-chip ${waiting ? 'fk-waiting' : ''} ${code ? '' : 'fk-chip-add'}`, { title: code ? 'Click, then press a new key' : 'Add a key' });
            }),
          ),
        ),
      ),
    );
    if (capturing) rows.querySelector<HTMLElement>('.fk-waiting')?.focus();
  }

  function startCapture(a: Action, slot: number) {
    capturing = [a, slot];
    status.textContent = 'Press a key (Esc to cancel, Backspace to remove).';
    render();
  }

  // capture phase so the screen manager never sees the key being bound
  function onCaptureKey(e: KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const [a, slot] = capturing;
    capturing = null;
    status.textContent = '';
    if (e.code === 'Escape') return render();
    const next = structuredClone(bindings);
    if (e.code === 'Backspace') {
      if (slot < next[a].length && next[a].length > 1) next[a].splice(slot, 1);
      else if (next[a].length <= 1) status.textContent = 'Each action needs at least one key.';
      return saveBindings(next);
    }
    // a key can only drive one action: steal it from wherever it was
    for (const k of Object.keys(next) as Action[]) {
      if (k !== a && next[k].includes(e.code) && next[k].length === 1) {
        status.textContent = `${keyLabel(e.code)} is the only key for "${ACTION_LABELS[k]}". Rebind that first.`;
        return render();
      }
    }
    for (const k of Object.keys(next) as Action[]) next[k] = next[k].filter((c) => c !== e.code);
    next[a][slot] = e.code;
    next[a] = next[a].filter(Boolean);
    saveBindings(next);
  }
  window.addEventListener('keydown', onCaptureKey, true);

  function saveSettings(patch: Partial<typeof settings>) {
    settings = { ...settings, ...patch };
    const r = storage.setSettings(settings);
    if (!r.ok) status.textContent = r.error;
    on.onSettingsChanged?.(settings);
  }

  const volLabel = h('span', { class: 'fk-value' }, `${Math.round(settings.volume * 100)}%`);
  const volume = h('input', {
    type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(settings.volume * 100)), 'aria-label': 'Volume',
    oninput: () => {
      volLabel.textContent = `${volume.value}%`;
      saveSettings({ volume: Number(volume.value) / 100 });
    },
  });
  const scaleBtns = SCALES.map((s) =>
    btn(`${Math.round(s * 100)}%`, () => {
      saveSettings({ resolutionScale: s });
      scaleBtns.forEach((b, i) => b.classList.toggle('fk-on', SCALES[i] === s));
    }, settings.resolutionScale === s ? 'fk-seg fk-on' : 'fk-seg'),
  );

  const back = () => ctx.go(params?.from ?? 'title');
  render();
  const el = screen(
    'fk-settings',
    h('div', { class: 'fk-panel fk-wide' },
      h('h2', {}, 'Settings'),
      h('h3', {}, 'Controls'),
      rows,
      btn('Reset to defaults', () => saveBindings(structuredClone(input.defaultBindings)), 'fk-small'),
      h('h3', {}, 'Sound'),
      h('div', { class: 'fk-row' }, h('span', { class: 'fk-row-label' }, 'Volume'), volume, volLabel),
      h('h3', {}, 'Graphics'),
      h('div', { class: 'fk-row' }, h('span', { class: 'fk-row-label' }, 'Resolution scale'), h('span', { class: 'fk-segs' }, ...scaleBtns)),
      status,
      h('div', { class: 'fk-actions' }, btn('Back', back, 'fk-primary')),
    ),
  );
  return { el, back, destroy: () => window.removeEventListener('keydown', onCaptureKey, true) };
}
