import { storage } from '../../core/storage';
import { btn, h, screen, type UiCtx } from '../dom';
import { KARTS, kartColor, selectedKart, type KartDef } from './karts';

const TIER_LABELS: Record<string, string> = { high: 'High tier', mid: 'Mid tier', rookie: 'Rookie', practice: 'Practice' };
const STATS = [
  ['topSpeed', 'Top speed'], ['accel', 'Acceleration'], ['cornering', 'Cornering'], ['boostCharge', 'Boost charge'],
] as const;
const STAT_MAX = 10;
const PALETTE = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#ec407a', '#ffffff', '#212121'];

export function garageScreen(ctx: UiCtx) {
  let viewing = selectedKart();
  const detail = h('div', { class: 'fk-panel fk-kart-detail' });
  const cardsById = new Map<string, HTMLButtonElement>();

  function renderDetail() {
    const sel = selectedKart();
    const isSel = sel.id === viewing.id;
    const color = kartColor(viewing);
    detail.replaceChildren(
      h('div', { class: 'fk-kart-head' },
        h('span', { class: 'fk-swatch fk-swatch-big', style: `background:${color}` }),
        h('div', {}, h('h2', {}, viewing.name), h('p', { class: 'fk-note' }, `${TIER_LABELS[viewing.tier] ?? viewing.tier} · ${viewing.notes}`)),
      ),
      ...STATS.map(([key, label]) => {
        const v = viewing.stats[key];
        const diff = v - sel.stats[key];
        return h('div', { class: 'fk-stat' },
          h('span', { class: 'fk-row-label' }, label),
          h('div', { class: 'fk-bar' },
            // ghost = currently selected kart, for comparison
            !isSel && h('div', { class: 'fk-bar-ghost', style: `width:${(sel.stats[key] / STAT_MAX) * 100}%` }),
            h('div', { class: 'fk-bar-fill', style: `width:${(v / STAT_MAX) * 100}%` }),
          ),
          h('b', { class: 'fk-value' }, v, !isSel && diff !== 0 && h('small', { class: diff > 0 ? 'fk-up' : 'fk-down' }, diff > 0 ? ` +${diff}` : ` ${diff}`)),
        );
      }),
      h('h3', {}, 'Color'),
      h('div', { class: 'fk-palette' },
        ...PALETTE.map((c) =>
          btn('', () => setColor(c), `fk-color ${c === color ? 'fk-on' : ''}`, { style: `background:${c}`, 'aria-label': `Color ${c}` }),
        ),
        btn('Default', () => setColor(null), 'fk-small'),
      ),
      h('div', { class: 'fk-actions' },
        btn(isSel ? 'Selected ✓' : 'Select this kart', () => {
          storage.setSelectedKartId(viewing.id);
          ctx.deps.on.onSelectionChanged?.();
          refreshCards();
          renderDetail();
        }, 'fk-primary', { disabled: isSel }),
        btn('Back', back),
      ),
    );
  }

  function setColor(c: string | null) {
    storage.setKartColor(viewing.id, c);
    ctx.deps.on.onSelectionChanged?.();
    refreshCards();
    renderDetail();
  }

  function refreshCards() {
    const selId = selectedKart().id;
    for (const k of KARTS) {
      const card = cardsById.get(k.id)!;
      card.classList.toggle('fk-on', k.id === viewing.id);
      card.classList.toggle('fk-selected', k.id === selId);
      card.querySelector<HTMLElement>('.fk-swatch')!.style.background = kartColor(k);
    }
  }

  const view = (k: KartDef) => {
    if (viewing.id === k.id) return;
    viewing = k;
    refreshCards();
    renderDetail();
  };

  const tiers = [...new Set(KARTS.map((k) => k.tier))];
  const list = h('div', { class: 'fk-panel fk-kart-list' },
    ...tiers.flatMap((t) => [
      h('h3', {}, TIER_LABELS[t] ?? t),
      h('div', { class: 'fk-kart-grid' },
        ...KARTS.filter((k) => k.tier === t).map((k) => {
          const card = btn('', () => view(k), 'fk-kart-card', {
            onfocus: () => view(k),
            autofocus: k.id === viewing.id,
          });
          card.replaceChildren(h('span', { class: 'fk-swatch' }), h('span', {}, k.name));
          cardsById.set(k.id, card);
          return card;
        }),
      ),
    ]),
  );

  const back = () => ctx.go('lobby');
  refreshCards();
  renderDetail();
  return { el: screen('fk-garage', h('h2', { class: 'fk-screen-title' }, 'Garage'), h('div', { class: 'fk-split' }, list, detail)), back };
}
