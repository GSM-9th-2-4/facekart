import { storage, type GameMode } from '../../core/storage';
import { btn, h, screen, type UiCtx } from '../dom';
import { kartColor, selectedKart } from './karts';

const MODES: { id: GameMode; label: string; disabled?: boolean }[] = [
  { id: 'speed', label: 'Speed' },
  { id: 'item', label: 'Item', disabled: true },
  { id: 'time', label: 'Time attack' },
];

export function lobbyScreen(ctx: UiCtx) {
  let mode = storage.getMode();
  const kart = selectedKart();
  const face = storage.getSelectedFace();

  const modeBtns = MODES.map((m) =>
    btn(
      m.disabled ? h('span', {}, m.label, h('small', {}, 'coming soon')) : m.label,
      () => {
        mode = m.id;
        storage.setMode(mode);
        modeBtns.forEach((b, i) => b.classList.toggle('fk-on', MODES[i].id === mode));
      },
      `fk-seg ${m.id === mode ? 'fk-on' : ''}`,
      { disabled: m.disabled },
    ),
  );

  const el = screen(
    'fk-lobby',
    h('header', { class: 'fk-topbar' },
      h('h2', { class: 'fk-logo fk-logo-small' }, 'Face', h('span', {}, 'Kart')),
      h('div', { class: 'fk-mode-wrap' }, h('span', { class: 'fk-kicker' }, 'Choose your race'), h('div', { class: 'fk-segs' }, ...modeBtns)),
    ),
    // transparent stage: main.ts renders the rotating 3D kart preview behind this
    h('div', { class: 'fk-stage' }),
    h('footer', { class: 'fk-bottombar' },
      h('div', { class: 'fk-panel fk-driver' },
        h('span', { class: 'fk-swatch', style: `background:${kartColor(kart)}` }),
        h('div', {},
          h('div', { class: 'fk-kicker' }, 'Your ride'), h('b', {}, kart.name),
          h('div', { class: 'fk-kicker' }, 'Your driver'), h('b', {}, face?.name ?? 'Default head'),
        ),
        face && h('img', { class: 'fk-face-thumb', src: face.dataUrl, alt: face.name }),
      ),
      h('div', { class: 'fk-menu fk-menu-row' },
        btn('Garage', () => ctx.go('garage')),
        btn('Face', () => ctx.go('face')),
        btn('Settings', () => ctx.go('settings', { from: 'lobby' })),
        btn('Race!', () => ctx.go('trackSelect'), 'fk-primary fk-big', { autofocus: true }),
      ),
    ),
  );
  return { el, back: () => ctx.go('title') };
}
