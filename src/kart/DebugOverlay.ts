import type { KartController } from './KartController';

/** F1-toggled text overlay with kart physics state. */
export class DebugOverlay {
  private el = document.createElement('div');

  constructor(parent: HTMLElement) {
    this.el.style.cssText =
      'position:absolute;top:8px;left:8px;padding:8px 10px;background:rgba(0,0,0,.6);color:#0f0;font:12px/1.4 monospace;white-space:pre;display:none';
    parent.appendChild(this.el);
    window.addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.code !== 'F1') return;
    e.preventDefault();
    this.el.style.display = this.el.style.display === 'none' ? 'block' : 'none';
  };

  update(k: KartController) {
    if (this.el.style.display === 'none') return;
    const deg = (r: number) => ((r * 180) / Math.PI).toFixed(1);
    this.el.textContent = [
      `speed    ${(k.speed * 3.6).toFixed(1)} km/h (${k.speed.toFixed(1)} m/s)`,
      `slip     ${deg(k.slip)}°  ${k.isDrifting ? 'DRIFT' : ''}`,
      `gauge    ${(k.gauge * 100).toFixed(0)}%`,
      `boosters ${k.boosterStock}`,
      `surface  grip×${k.surface.gripMul} speed×${k.surface.speedMul}`,
      `boost    ${k.boostTimer.toFixed(2)}s  instant ${k.instantBoostTimer.toFixed(2)}s`,
      `window   ${k.instantBoostWindow.toFixed(2)}s  gripRec ${k.gripRecovery.toFixed(2)}s`,
    ].join('\n');
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
