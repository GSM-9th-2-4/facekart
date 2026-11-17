import { btn, fmtTime, h, type UiCtx } from '../dom';

export interface HudState {
  speedKmh: number;
  /** 0..1 */
  boostGauge: number;
  /** 0..2 */
  boostStock: number;
  lap: number;
  laps: number;
  position: number;
  racers: number;
  /** current lap time, seconds */
  lapTime: number;
  /** finished lap times, seconds */
  lapTimes: number[];
  /** '3' | '2' | '1' | 'GO!' | null (hidden) */
  countdown: string | null;
}
export interface MinimapMarker { x: number; z: number; color: string; isPlayer?: boolean }
export type HudApi = ReturnType<typeof hudScreen>;

const MAP_PX = 180;
const MAP_PAD = 12;
const MAX_STOCK = 2;

export function hudScreen(ctx: UiCtx, _params?: { trackName?: string }) {
  const speed = h('b', { class: 'fk-speed-num' }, '0');
  const gaugeFill = h('div', { class: 'fk-gauge-fill' });
  const stocks = Array.from({ length: MAX_STOCK }, () => h('span', { class: 'fk-stock' }));
  const lap = h('b', {}, '1/3');
  const pos = h('b', { class: 'fk-pos-num' }, '1');
  const posOf = h('small', {}, '/8');
  const lapTime = h('b', { class: 'fk-time' }, fmtTime(0));
  const lapList = h('ol', { class: 'fk-lap-list' });
  const countdown = h('div', { class: 'fk-countdown', hidden: true });
  const pops = h('div', { class: 'fk-pops' });
  const map = h('canvas', { class: 'fk-minimap', width: MAP_PX, height: MAP_PX });
  const g = map.getContext('2d');
  let mapBg: HTMLCanvasElement | null = null;
  let toMap = (x: number, z: number): [number, number] => [x, z];

  const el = h('div', { class: 'fk-hud' },
    h('div', { class: 'fk-hud-tl' },
      h('div', { class: 'fk-hud-box fk-pos' }, pos, posOf),
      h('div', { class: 'fk-hud-box' }, h('span', { class: 'fk-kicker' }, 'LAP'), lap),
    ),
    h('div', { class: 'fk-hud-tr' },
      h('div', { class: 'fk-hud-box fk-times' }, lapTime, lapList),
      btn('II', () => ctx.setPaused(true, true), 'fk-small fk-pause-btn', { 'aria-label': 'Pause', tabindex: '-1' }),
    ),
    h('div', { class: 'fk-hud-bl' }, map),
    h('div', { class: 'fk-hud-br' },
      h('div', { class: 'fk-hud-box fk-speed' }, speed, h('small', {}, 'km/h')),
      h('div', { class: 'fk-hud-box fk-boost' },
        h('div', { class: 'fk-gauge' }, gaugeFill),
        h('div', { class: 'fk-stocks' }, ...stocks),
      ),
    ),
    countdown,
    pops,
  );

  // only touch the DOM when a value actually changes
  const last: Record<string, unknown> = {};
  const changed = (k: string, v: unknown) => (last[k] === v ? false : ((last[k] = v), true));

  return {
    el,
    onKey(e: KeyboardEvent) {
      if (e.repeat || !ctx.deps.input.getBindings().pause.includes(e.code)) return false;
      e.preventDefault();
      ctx.setPaused(true, true);
      return true;
    },
    update(s: HudState) {
      const kmh = Math.max(0, Math.round(s.speedKmh));
      if (changed('speed', kmh)) speed.textContent = String(kmh);
      const gauge = Math.round(Math.min(1, Math.max(0, s.boostGauge)) * 200) / 2; // 0.5% steps
      if (changed('gauge', gauge)) gaugeFill.style.transform = `scaleX(${gauge / 100})`;
      if (changed('stock', s.boostStock)) stocks.forEach((st, i) => st.classList.toggle('fk-full', i < s.boostStock));
      if (changed('lap', `${s.lap}/${s.laps}`)) lap.textContent = `${Math.min(s.lap, s.laps)}/${s.laps}`;
      if (changed('pos', s.position)) pos.textContent = String(s.position);
      if (changed('racers', s.racers)) posOf.textContent = `/${s.racers}`;
      const lt = fmtTime(s.lapTime).slice(0, -1); // 0.01 s resolution is plenty on screen
      if (changed('lapTime', lt)) lapTime.textContent = lt;
      if (changed('lapCount', s.lapTimes.length)) lapList.replaceChildren(...s.lapTimes.map((t) => h('li', {}, fmtTime(t))));
      if (changed('countdown', s.countdown)) {
        countdown.hidden = !s.countdown;
        if (s.countdown) {
          countdown.textContent = s.countdown;
          countdown.classList.remove('fk-anim');
          void countdown.offsetWidth; // restart CSS animation
          countdown.classList.add('fk-anim');
        }
      }
    },
    /** Flash a message, e.g. 'BOOST!' or 'INSTANT BOOST!'. */
    pop(text: string, cls = '') {
      const p = h('div', { class: `fk-pop ${cls}` }, text);
      p.addEventListener('animationend', () => p.remove());
      pops.append(p);
    },
    /** World-space centerline points; call once per race. */
    setTrackOutline(points: { x: number; z: number }[]) {
      if (!points.length) return;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      const scale = (MAP_PX - MAP_PAD * 2) / Math.max(maxX - minX, maxZ - minZ, 1e-6);
      const ox = (MAP_PX - (maxX - minX) * scale) / 2;
      const oz = (MAP_PX - (maxZ - minZ) * scale) / 2;
      toMap = (x, z) => [ox + (x - minX) * scale, oz + (z - minZ) * scale];
      mapBg = document.createElement('canvas');
      mapBg.width = mapBg.height = MAP_PX;
      const b = mapBg.getContext('2d');
      if (!b) return;
      b.lineJoin = b.lineCap = 'round';
      b.beginPath();
      points.forEach((p, i) => (i ? b.lineTo(...toMap(p.x, p.z)) : b.moveTo(...toMap(p.x, p.z))));
      b.closePath();
      b.strokeStyle = 'rgba(0,0,0,0.55)';
      b.lineWidth = 10;
      b.stroke();
      b.strokeStyle = '#fff';
      b.lineWidth = 5;
      b.stroke();
      g?.clearRect(0, 0, MAP_PX, MAP_PX);
      g?.drawImage(mapBg, 0, 0);
    },
    /** Call every frame (or every few frames) with all racers. */
    setMarkers(markers: MinimapMarker[]) {
      if (!g) return;
      g.clearRect(0, 0, MAP_PX, MAP_PX);
      if (mapBg) g.drawImage(mapBg, 0, 0);
      // player last so it's drawn on top
      for (const m of [...markers].sort((a, b) => Number(!!a.isPlayer) - Number(!!b.isPlayer))) {
        const [x, y] = toMap(m.x, m.z);
        g.beginPath();
        g.arc(x, y, m.isPlayer ? 6 : 4, 0, Math.PI * 2);
        g.fillStyle = m.color;
        g.fill();
        g.lineWidth = m.isPlayer ? 2.5 : 1.5;
        g.strokeStyle = m.isPlayer ? '#fff' : '#222';
        g.stroke();
      }
    },
  };
}
