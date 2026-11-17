import { btn, h, screen, type UiCtx } from '../dom';

export function pauseScreen(ctx: UiCtx) {
  const resume = () => ctx.setPaused(false, true);
  const el = screen(
    'fk-pause fk-dim',
    h('div', { class: 'fk-panel fk-menu' },
      h('h2', {}, 'Paused'),
      btn('Resume', resume, 'fk-primary', { autofocus: true }),
      btn('Retry', () => {
        ctx.setPaused(false);
        ctx.deps.on.onRetry();
      }),
      btn('Lobby', () => {
        ctx.go('lobby');
        ctx.deps.on.onLobby();
      }),
    ),
  );
  return {
    el,
    back: resume,
    onKey(e: KeyboardEvent) {
      if (e.repeat || e.code === 'Escape' || !ctx.deps.input.getBindings().pause.includes(e.code)) return false;
      resume();
      return true;
    },
  };
}
