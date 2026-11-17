import { h, screen, type UiCtx } from '../dom';

const TIPS = [
  'Drift through corners to fill the booster gauge.',
  'You can hold up to 2 boosters. Use them on straights!',
  'Press Up right as a drift ends for an INSTANT BOOST.',
  'Register your face in the lobby and race as yourself.',
  'High-tier karts are fast but harder to corner.',
  'Rookie karts charge boosters faster. Great for learning.',
  'Time attack: no rivals, just you and the clock.',
  'Let AI racers wear your saved faces in Face registration.',
];

export function loadingScreen(_ctx: UiCtx, params: { trackName: string }) {
  const bar = h('div', { class: 'fk-progress-fill' });
  const el = screen(
    'fk-loading',
    h('div', { class: 'fk-panel' },
      h('p', { class: 'fk-kicker' }, 'Engines on · Loading track'),
      h('h1', { class: 'fk-track-name' }, params.trackName),
      h('div', { class: 'fk-progress' }, bar),
      h('p', { class: 'fk-tip' }, h('b', {}, 'TIP '), TIPS[Math.floor(Math.random() * TIPS.length)]),
    ),
  );
  return {
    el,
    /** 0..1 */
    setProgress(p: number) {
      bar.style.width = `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;
    },
  };
}
