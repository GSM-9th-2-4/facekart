import { storage } from '../../core/storage';
import { btn, fmtTime, h, screen, themeColor, type TrackInfo, type UiCtx } from '../dom';
import { kartColor, selectedKart } from './karts';

const MAX_LAPS = 9;
const MAX_AI = 7;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Simple themed thumbnail: colored ground + a looping road whose wiggle depends on the track id. */
function thumb(t: TrackInfo): SVGSVGElement {
  let seed = 0;
  for (const ch of t.id) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 0.7 + 0.3 * Math.sin(a * 3 + (seed % 7)) * (0.4 + t.difficulty * 0.12);
    pts.push(`${(50 + Math.cos(a) * 38 * r).toFixed(1)},${(30 + Math.sin(a) * 20 * r).toFixed(1)}`);
  }
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 60');
  svg.setAttribute('class', 'fk-thumb');
  svg.innerHTML = `<rect width="100" height="60" rx="6" fill="${themeColor(t.theme)}"/>
    <polygon points="${pts.join(' ')}" fill="none" stroke="#333" stroke-width="7" stroke-linejoin="round"/>
    <polygon points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3 3"/>`;
  return svg;
}

const stars = (n: number) => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));

export function trackSelectScreen(ctx: UiCtx) {
  const { tracks, on } = ctx.deps;
  const mode = storage.getMode();
  const prefs = storage.getRaceSetup();
  let track = tracks.find((t) => t.id === prefs.trackId) ?? tracks[0];
  let laps = prefs.laps;
  let aiCount = mode === 'time' ? 0 : prefs.aiCount;
  const cards = new Map<string, HTMLButtonElement>();

  const lapVal = h('b', { class: 'fk-value' });
  const aiVal = h('b', { class: 'fk-value' });
  const pb = h('div', { class: 'fk-pb' });
  const persist = () => track && storage.setRaceSetup({ trackId: track.id, laps, aiCount: mode === 'time' ? prefs.aiCount : aiCount });

  function render() {
    lapVal.textContent = String(laps);
    aiVal.textContent = mode === 'time' ? '0 (time attack)' : String(aiCount);
    for (const [id, c] of cards) c.classList.toggle('fk-on', id === track?.id);
    const rec = track && storage.getRecord(track.id);
    pb.replaceChildren(
      h('div', { class: 'fk-kicker' }, 'Personal best'),
      h('div', {}, 'Lap ', h('b', {}, fmtTime(rec?.bestLap))),
      h('div', {}, 'Total ', h('b', {}, fmtTime(rec?.bestTotal))),
    );
  }

  const stepper = (val: HTMLElement, dec: () => void, inc: () => void, disabled = false) =>
    h('span', { class: 'fk-stepper' },
      btn('−', () => { dec(); persist(); render(); }, 'fk-small', { disabled, 'aria-label': 'Less' }),
      val,
      btn('+', () => { inc(); persist(); render(); }, 'fk-small', { disabled, 'aria-label': 'More' }),
    );

  const grid = h('div', { class: 'fk-track-grid' },
    ...tracks.map((t) => {
      const rec = storage.getRecord(t.id);
      const card = btn('', () => {
        if (track?.id === t.id) return start();
        track = t;
        laps = t.laps;
        persist();
        render();
      }, 'fk-track-card', { autofocus: t.id === track?.id, style: `--theme:${themeColor(t.theme)}` });
      card.append(
        thumb(t),
        h('b', { class: 'fk-track-title' }, t.name),
        h('span', { class: 'fk-stars', 'aria-label': `Difficulty ${t.difficulty} of 5` }, stars(t.difficulty)),
        h('small', {}, rec?.bestTotal != null ? `PB ${fmtTime(rec.bestTotal)}` : 'No record yet'),
      );
      cards.set(t.id, card);
      return card;
    }),
  );

  function start() {
    if (!track) return;
    persist();
    const kart = selectedKart();
    const faces = storage.getFaces();
    const ai = new Set(storage.getAiFaceIds());
    on.onStartRace({
      trackId: track.id,
      laps,
      aiCount: mode === 'time' ? 0 : aiCount,
      mode,
      kartId: kart.id,
      kartColor: kartColor(kart),
      faceDataUrl: storage.getSelectedFace()?.dataUrl ?? null,
      aiFaceDataUrls: faces.filter((f) => ai.has(f.id)).map((f) => f.dataUrl),
    });
  }

  const back = () => ctx.go('lobby');
  render();
  const el = screen(
    'fk-tracks',
    h('h2', { class: 'fk-screen-title' }, 'Track select'),
    tracks.length ? grid : h('div', { class: 'fk-panel' }, 'No tracks found.'),
    h('div', { class: 'fk-panel fk-race-setup' },
      pb,
      h('div', { class: 'fk-row' }, h('span', { class: 'fk-row-label' }, 'Laps'),
        stepper(lapVal, () => (laps = Math.max(1, laps - 1)), () => (laps = Math.min(MAX_LAPS, laps + 1)))),
      h('div', { class: 'fk-row' }, h('span', { class: 'fk-row-label' }, 'AI racers'),
        stepper(aiVal, () => (aiCount = Math.max(0, aiCount - 1)), () => (aiCount = Math.min(MAX_AI, aiCount + 1)), mode === 'time')),
      h('div', { class: 'fk-actions' },
        btn('Back', back),
        btn('Start race', start, 'fk-primary fk-big', { disabled: !track }),
      ),
    ),
  );
  return { el, back };
}
