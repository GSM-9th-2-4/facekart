import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import type { KartController } from './KartController';

/** Primitive kart: body, 4 wheels, driver, big sphere head (`head`, textured by the face step), boost flame. Local +Z = forward. */
export class KartVisual {
  readonly group = new THREE.Group();
  readonly head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private wheels: THREE.Mesh[] = [];
  private frontPivots: THREE.Group[] = [];
  private flame: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  private spin = 0;
  private disposables: { dispose(): void }[] = [];

  constructor(color: THREE.ColorRepresentation) {
    const mat = <T extends { dispose(): void }>(m: T) => (this.disposables.push(m), m);
    const bodyMat = mat(new THREE.MeshStandardMaterial({ color }));
    const darkMat = mat(new THREE.MeshStandardMaterial({ color: 0x222222 }));

    const body = new THREE.Mesh(mat(new THREE.BoxGeometry(1.4, 0.45, 2.2)), bodyMat);
    body.position.y = 0.45;
    const nose = new THREE.Mesh(mat(new THREE.BoxGeometry(1.0, 0.3, 0.6)), bodyMat);
    nose.position.set(0, 0.4, 1.3);

    const wheelGeo = mat(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 14));
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-0.8, 0.75], [0.8, 0.75], [-0.8, -0.75], [0.8, -0.75]] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.32, z);
      const w = new THREE.Mesh(wheelGeo, darkMat);
      pivot.add(w);
      this.wheels.push(w);
      if (z > 0) this.frontPivots.push(pivot);
      this.group.add(pivot);
    }

    const driver = new THREE.Mesh(mat(new THREE.CylinderGeometry(0.3, 0.38, 0.7, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xffffff })));
    driver.position.set(0, 1.0, -0.25);
    this.head = new THREE.Mesh(mat(new THREE.SphereGeometry(0.55, 32, 24)), mat(new THREE.MeshStandardMaterial({ color: 0xffd7b5 })));
    this.head.position.set(0, 1.85, -0.25);

    const flameGeo = mat(new THREE.ConeGeometry(0.25, 1.2, 12));
    flameGeo.rotateX(-Math.PI / 2); // tip points backward (-Z)
    flameGeo.translate(0, 0, -0.6);
    this.flame = new THREE.Mesh(flameGeo, mat(new THREE.MeshBasicMaterial({ color: TUNING.visual.flameColorInstant, transparent: true, opacity: 0.85 })));
    this.flame.position.set(0, 0.45, -1.1);
    this.flame.visible = false;

    for (const m of [body, nose, driver, this.head]) m.castShadow = true;
    this.group.add(body, nose, driver, this.head, this.flame);
  }

  /** Sync from physics. Body yaw = heading, so slip vs travel direction is visible in drifts. */
  update(k: KartController, frameDt: number, time: number) {
    const v = TUNING.visual;
    this.group.position.set(k.x, 0, k.z);
    this.group.rotation.y = k.heading;
    this.spin += k.speed * frameDt * v.wheelSpinScale;
    for (const w of this.wheels) w.rotation.x = this.spin;
    const steerVis = k.isDrifting ? k.driftDir : 0;
    for (const p of this.frontPivots) p.rotation.y = -steerVis * v.steerWheelAngle;

    const boosting = k.boostTimer > 0 || k.instantBoostTimer > 0;
    this.flame.visible = boosting;
    if (boosting) {
      const flick = v.flameFlickerMin + v.flameFlickerAmp * Math.abs(Math.sin(time * v.flameFlickerHz));
      const big = k.boostTimer > 0 ? v.flameScaleBoost : v.flameScaleInstant;
      this.flame.scale.set(big, big, big * flick);
      this.flame.material.color.setHex(k.boostTimer > 0 ? v.flameColorBoost : v.flameColorInstant);
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose();
  }
}
