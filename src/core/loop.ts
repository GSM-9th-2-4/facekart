import { TUNING } from '../config/tuning';

/** Fixed-timestep loop. `step(dt)` runs at TUNING.physics.stepHz; `render(alpha)` once per frame. */
export function startLoop(step: (dt: number) => void, render: (alpha: number, frameDt: number) => void) {
  const dt = 1 / TUNING.physics.stepHz;
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const frameDt = Math.min((now - last) / 1000, TUNING.physics.maxFrameTime);
    last = now;
    acc += frameDt;
    while (acc >= dt) {
      step(dt);
      acc -= dt;
    }
    render(acc / dt, frameDt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop: () => cancelAnimationFrame(raf) };
}
