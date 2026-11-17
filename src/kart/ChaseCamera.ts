import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import type { KartController } from './KartController';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Chase cam behind/above the kart. Follows velocity direction more than heading in drifts so the slide shows. */
export class ChaseCamera {
  private yaw: number;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera, k: KartController) {
    this.yaw = k.heading;
    this.place(k, 1);
  }

  update(k: KartController, dt: number) {
    const c = TUNING.camera;
    const target = k.travel + k.slip * (k.isDrifting ? c.driftYawFollow : 1);
    this.yaw = wrap(this.yaw + wrap(target - this.yaw) * (1 - Math.exp(-c.yawLerp * dt)));
    this.place(k, 1 - Math.exp(-c.posLerp * dt));

    const boosting = k.boostTimer > 0 || k.instantBoostTimer > 0;
    const fov = c.fov + (boosting ? c.boostFovAdd : 0);
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-c.fovLerp * dt));
    this.camera.updateProjectionMatrix();
  }

  private place(k: KartController, t: number) {
    const c = TUNING.camera;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.pos.lerp(new THREE.Vector3(k.x - fx * c.distance, c.height, k.z - fz * c.distance), t);
    this.look.set(k.x + fx * c.lookAhead, c.lookHeight, k.z + fz * c.lookAhead);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
