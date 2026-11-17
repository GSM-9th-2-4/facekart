import { btn, fmtTime, h, screen, type UiCtx } from '../dom';

export interface Standing {
  name: string;
  isPlayer?: boolean;
  /** total race time in seconds; null = did not finish */
  totalTime: number | null;
  color?: string;
}
export interface ResultsParams {
  trackName: string;
  /** sorted 1st → last */
  standings: Standing[];
  /** player's lap times, seconds */
  lapTimes: number[];
  /** from storage.submitRecord() */
  newRecord: { newLap: boolean; newTotal: boolean };
  /** face of the 1st-place racer (null → default head) */
  winnerFaceUrl: string | null;
}

export function resultsScreen(ctx: UiCtx, p: ResultsParams) {
  const winner = p.standings[0];
  const playerPos = p.standings.findIndex((s) => s.isPlayer) + 1;
  const best = p.lapTimes.length ? Math.min(...p.lapTimes) : null;
  const lobby = () => {
    ctx.go('lobby');
    ctx.deps.on.onLobby();
  };

  const el = screen(
    'fk-results',
    h('h2', { class: 'fk-screen-title' }, p.trackName, ' — ', playerPos ? `You finished #${playerPos}` : 'Results'),
    h('div', { class: 'fk-split' },
      h('div', { class: 'fk-panel fk-winner' },
        h('div', { class: 'fk-kicker' }, '1st place'),
        h('div', { class: 'fk-head fk-head-big' },
          p.winnerFaceUrl ? h('img', { src: p.winnerFaceUrl, alt: winner?.name ?? 'Winner' }) : h('span', { class: 'fk-head-empty' }, '?'),
        ),
        h('h2', {}, winner?.name ?? '—'),
        (p.newRecord.newLap || p.newRecord.newTotal) &&
          h('div', { class: 'fk-badge' }, 'NEW RECORD!', h('small', {}, [p.newRecord.newTotal && 'Total', p.newRecord.newLap && 'Lap'].filter(Boolean).join(' + '))),
      ),
      h('div', { class: 'fk-panel' },
        h('table', { class: 'fk-table' },
          h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Racer'), h('th', {}, 'Time'))),
          h('tbody', {},
            ...p.standings.map((s, i) =>
              h('tr', { class: s.isPlayer ? 'fk-me' : '' },
                h('td', {}, i + 1),
                h('td', {}, s.color && h('span', { class: 'fk-dot', style: `background:${s.color}` }), s.name),
                h('td', {}, s.totalTime == null ? 'DNF' : fmtTime(s.totalTime)),
              ),
            ),
          ),
        ),
        h('h3', {}, 'Your laps'),
        h('ol', { class: 'fk-lap-list fk-lap-list-big' },
          ...p.lapTimes.map((t) => h('li', { class: t === best ? 'fk-best' : '' }, fmtTime(t))),
        ),
        h('div', { class: 'fk-actions' },
          btn('Retry', () => ctx.deps.on.onRetry(), 'fk-primary fk-big', { autofocus: true }),
          btn('Lobby', lobby, 'fk-big'),
        ),
      ),
    ),
  );
  return { el, back: lobby };
}
