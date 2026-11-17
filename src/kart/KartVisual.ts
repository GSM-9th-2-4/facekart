import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import type { KartController } from './KartController';

// Immutable primitive geometry is shared by every racer; each kart owns its materials.
const geo = {
  sphere: new THREE.SphereGeometry(1, 12, 8),
  body: new THREE.SphereGeometry(1, 14, 8),
  tyre: new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12),
  hub: new THREE.CylinderGeometry(0.205, 0.205, 0.30, 12),
  torus: new THREE.TorusGeometry(0.27, 0.055, 6, 16),
  flame: new THREE.ConeGeometry(0.19, 0.8, 8),
};
geo.tyre.rotateZ(Math.PI / 2);
geo.hub.rotateZ(Math.PI / 2);
geo.flame.rotateX(-Math.PI / 2);

const toon = (color: THREE.ColorRepresentation) => new THREE.MeshToonMaterial({ color });

/** Original toy racer and bobblehead driver. Local +Z is forward. */
export class KartVisual {
  readonly group = new THREE.Group();
  readonly head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private wheels: THREE.Mesh[] = [];
  private frontPivots: THREE.Group[] = [];
  private flames: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>[] = [];
  private spin = 0;
  private disposables: { dispose(): void }[] = [];
  private driverLean = new THREE.Group();

  constructor(color: THREE.ColorRepresentation) {
    const mat = <T extends { dispose(): void }>(m: T) => (this.disposables.push(m), m);
    const base = new THREE.Color(color);
    const bodyMat = mat(toon(base));
    const lightMat = mat(toon(base.clone().lerp(new THREE.Color(0xffffff), 0.22)));
    const shadeMat = mat(toon(base.clone().multiplyScalar(0.72)));
    const rubber = mat(toon(0x20242b));
    const trim = mat(toon(0xf5f3e9));
    const metal = mat(new THREE.MeshStandardMaterial({ color: 0xadb7c1, metalness: 0.35, roughness: 0.48 }));
    const suit = mat(toon(0x263b59));
    const skin = mat(new THREE.MeshStandardMaterial({ color: 0xffd7b5, roughness: 0.86 }));
    const visorMat = mat(new THREE.MeshStandardMaterial({ color: 0x42c8df, metalness: 0.18, roughness: 0.3 }));
    const dark = mat(toon(0x17212b));

    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number], scale?: [number, number, number]) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(...pos);
      if (scale) m.scale.set(...scale);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    // Plump lower tub with a raised rounded nose and contrasting wraparound bumper.
    add(geo.body, bodyMat, [0, 0.57, -0.03], [0.93, 0.32, 1.35]);
    add(geo.body, bodyMat, [0, 0.69, 0.91], [0.68, 0.25, 0.73]);
    add(geo.body, shadeMat, [0, 0.47, -0.94], [0.79, 0.28, 0.44]);
    add(geo.body, trim, [0, 0.42, 1.49], [0.83, 0.115, 0.16]);
    // Side pods and raised front fenders create a compact molded shell silhouette.
    for (const s of [-1, 1]) {
      add(geo.body, bodyMat, [s * 0.76, 0.58, 0.15], [0.22, 0.24, 0.83]);
      add(geo.body, bodyMat, [s * 0.69, 0.72, 0.91], [0.30, 0.15, 0.52]);
    }
    // Rear spoiler, struts, twin exhausts and a small rear number panel.
    for (const s of [-1, 1]) add(geo.body, dark, [s * 0.48, 0.88, -1.05], [0.075, 0.29, 0.075]);
    add(geo.body, bodyMat, [0, 1.13, -1.08], [0.82, 0.13, 0.25]);
    add(geo.body, trim, [0, 0.69, -1.37], [0.48, 0.22, 0.055]);
    for (const s of [-1, 1]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.3, 12), metal);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(s * 0.43, 0.38, -1.26);
      this.group.add(exhaust);
      this.disposables.push(exhaust.geometry);
    }

    // Chunky rubber with layered hubcaps. Front assemblies pivot for drift steering.
    for (const [x, z] of [[-0.88, 0.78], [0.88, 0.78], [-0.88, -0.82], [0.88, -0.82]] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.38, z);
      const tyre = new THREE.Mesh(geo.tyre, rubber);
      const hub = new THREE.Mesh(geo.hub, metal);
      const cap = new THREE.Mesh(geo.sphere, lightMat);
      cap.scale.set(0.11, 0.11, 0.11);
      tyre.castShadow = hub.castShadow = true;
      pivot.add(tyre, hub, cap);
      this.group.add(pivot);
      this.wheels.push(tyre);
      if (z > 0) this.frontPivots.push(pivot);
    }

    // Seat and driver sit low in the tub; hands reach toward the wheel.
    add(geo.body, dark, [0, 0.76, -0.35], [0.48, 0.35, 0.46]);
    const torso = add(geo.body, suit, [0, 1.04, -0.31], [0.37, 0.39, 0.31]);
    this.driverLean.add(torso);
    this.group.remove(torso);
    this.group.add(this.driverLean);
    this.driverLean.position.set(0, 0, 0);
    for (const s of [-1, 1]) {
      const arm = add(geo.body, suit, [s * 0.39, 1.0, 0.06], [0.14, 0.15, 0.39]);
      arm.rotation.x = -0.5;
      add(geo.sphere, trim, [s * 0.34, 0.91, 0.32], [0.13, 0.11, 0.13]);
    }
    // Steering column and wheel.
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 10), dark);
    column.position.set(0, 0.92, 0.35); column.rotation.x = -0.6; this.group.add(column); this.disposables.push(column.geometry);
    const steering = new THREE.Mesh(geo.torus, dark);
    steering.position.set(0, 1.03, 0.48); steering.rotation.x = 0.32; this.group.add(steering);
    const wheelCenter = new THREE.Mesh(geo.sphere, trim); wheelCenter.scale.setScalar(0.07); wheelCenter.position.set(0, 1.03, 0.48); this.group.add(wheelCenter);

    // Required face head stays open at the front; helmet and forehead visor sit above it.
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), skin);
    this.head.position.set(0, 1.93, -0.22);
    this.head.scale.setScalar(1.08);
    this.head.castShadow = true;
    this.group.add(this.head);
    add(geo.body, bodyMat, [0, 2.27, -0.25], [0.66, 0.30, 0.66]); // helmet crown
    add(geo.body, shadeMat, [0, 2.12, -0.72], [0.49, 0.30, 0.22]); // rear helmet shell
    for (const s of [-1, 1]) {
      add(geo.sphere, lightMat, [s * 0.58, 1.91, -0.2], [0.15, 0.19, 0.16]); // ear covers
    }
    // Keep the whole front hemisphere clear for the face decal; visor details sit above it.
    add(geo.body, visorMat, [0, 2.43, -0.02], [0.43, 0.075, 0.14]);
    add(geo.body, trim, [0, 2.52, -0.08], [0.47, 0.045, 0.15]);

    // Small front plate and round lamp details.
    add(geo.body, trim, [0, 0.74, 1.34], [0.34, 0.20, 0.075]);
    for (const s of [-1, 1]) add(geo.sphere, mat(new THREE.MeshBasicMaterial({ color: 0xfff3be })), [s * 0.48, 0.68, 1.43], [0.12, 0.07, 0.05]);

    const flameMat = mat(new THREE.MeshBasicMaterial({ color: TUNING.visual.flameColorInstant, transparent: true, opacity: 0.88 }));
    for (const s of [-1, 1]) {
      const flame = new THREE.Mesh(geo.flame, flameMat);
      flame.position.set(s * 0.43, 0.39, -1.64);
      flame.visible = false;
      this.group.add(flame);
      this.flames.push(flame);
    }
  }

  update(k: KartController, frameDt: number, time: number) {
    const v = TUNING.visual;
    this.group.position.set(k.x, 0, k.z);
    this.group.rotation.y = k.heading;
    this.spin += k.speed * frameDt * v.wheelSpinScale;
    for (const w of this.wheels) w.rotation.x = this.spin;
    const steerVis = k.isDrifting ? k.driftDir : 0;
    for (const p of this.frontPivots) p.rotation.y = -steerVis * v.steerWheelAngle;
    this.group.rotation.z = THREE.MathUtils.damp(this.group.rotation.z, k.isDrifting ? -k.driftDir * v.driftRoll : 0, v.rollDamp, frameDt);
    this.driverLean.rotation.z = k.isDrifting ? -k.driftDir * v.driverLean : 0;

    const boosting = k.boostTimer > 0 || k.instantBoostTimer > 0;
    const flick = v.flameFlickerMin + v.flameFlickerAmp * Math.abs(Math.sin(time * v.flameFlickerHz));
    const scale = k.boostTimer > 0 ? v.flameScaleBoost : v.flameScaleInstant;
    for (const flame of this.flames) {
      flame.visible = boosting;
      if (boosting) {
        flame.scale.set(scale, scale, scale * flick);
        flame.material.color.setHex(k.boostTimer > 0 ? v.flameColorBoost : v.flameColorInstant);
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose();
    this.head.geometry.dispose();
  }
}
