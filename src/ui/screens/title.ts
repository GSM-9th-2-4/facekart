import { btn, h, screen, type UiCtx } from '../dom';

export function titleScreen(ctx: UiCtx) {
  const msg = h('p', { class: 'fk-note', hidden: true }, 'Thanks for playing! You can close this tab now.');
  const el = screen(
    'fk-title',
    h('h1', { class: 'fk-logo' }, 'Face', h('span', {}, 'Kart')),
    h('p', { class: 'fk-tagline' }, 'Race with your own face!'),
    h(
      'div',
      { class: 'fk-menu' },
      btn('Start', () => ctx.go('lobby'), 'fk-primary fk-big', { autofocus: true }),
      btn('Settings', () => ctx.go('settings', { from: 'title' }), 'fk-big'),
      btn('Quit', () => (msg.hidden = false), 'fk-big'),
    ),
    msg,
  );
  return { el };
}
