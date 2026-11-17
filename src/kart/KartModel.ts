import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Procedural KartRider-style kart: short, wide, chunky, rounded, fat tires, big-headed driver.
// Forward = +Z, up = +Y, origin on the ground at the kart center. ~1.9 long, 1.6 wide.
// Swap for glTF later (CLAUDE.md "primitives first").

export interface KartParts {
  root: THREE.Group;
  body: THREE.Group;            // tilt for drift lean / squash
  frontWheels: THREE.Group[];   // rotate .rotation.y to steer
  wheelSpins: THREE.Object3D[]; // rotate .rotation.x to roll
  steeringWheel: THREE.Object3D;
  head: THREE.Mesh;             // face decal goes on this sphere (step 6); u=0.5 faces +Z
  placeholderFace: THREE.Group; // hide once a photo face is applied
  exhausts: THREE.Object3D[];   // booster flame anchors
  setColor(hex: number): void;
}

const std = (color: number, roughness = 0.5, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 4, r);

function wheel(r: number, w: number, tire: THREE.Material, rim: THREE.Material, hub: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // fat rounded tire: lathe a rounded-rect cross section around the axle (X)
  const pts: THREE.Vector2[] = [];
  const inner = r * 0.55, round = w * 0.3;
  pts.push(new THREE.Vector2(inner, -w / 2));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(r - round + Math.cos(a) * round, -w / 2 + round + Math.sin(a) * round)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(r - round + Math.cos(a) * round, w / 2 - round + Math.sin(a) * round)); }
  pts.push(new THREE.Vector2(inner, w / 2));
  const t = add(g, new THREE.LatheGeometry(pts, 32), tire);
  t.rotation.z = Math.PI / 2;
  (t.material as THREE.Material).side = THREE.DoubleSide;
  // tread grooves
  for (const off of [-w * 0.18, w * 0.18]) {
    const groove = add(g, new THREE.TorusGeometry(r - 0.004, 0.012, 6, 40), std(0x0a0a0a, 1), off, 0, 0);
    groove.rotation.y = Math.PI / 2;
  }
  // dished rim + 6 spokes + center cap, on both faces
  for (const sx of [-1, 1]) {
    const face = add(g, new THREE.CylinderGeometry(inner, inner * 0.9, 0.04, 24), rim, sx * w * 0.36, 0, 0);
    face.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const s = add(g, new THREE.BoxGeometry(0.03, inner * 1.7, inner * 0.22), hub, sx * w * 0.39, 0, 0);
      s.rotation.x = (i / 6) * Math.PI;
    }
    add(g, new THREE.SphereGeometry(inner * 0.3, 12, 8), rim, sx * w * 0.4, 0, 0).scale.x = 0.5;
  }
  return g;
}

export type KartDesign = 'racer' | 'bubble';
export const KART_DESIGNS: KartDesign[] = ['racer', 'bubble'];

export function createKart(color = 0xe8322b, design: KartDesign = 'racer'): KartParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
  const paintDark = std(0, 0.4, 0.2);
  const black = std(0x18181b, 0.7);
  const carbon = std(0x2a2c33, 0.4, 0.4);
  const chrome = std(0xe4e8ee, 0.12, 1);
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf6f6f6, roughness: 0.3, clearcoat: 1 });
  const tireMat = std(0x1b1b1d, 0.85);
  const rimMat = std(0xf2f2f2, 0.2, 0.7);
  const hubMat = std(0x9aa1ab, 0.25, 0.9);
  const setColor = (hex: number) => {
    paint.color.setHex(hex);
    paintDark.color.copy(paint.color).multiplyScalar(0.5);
  };
  setColor(color);

  const exhausts: THREE.Object3D[] = [];
  if (design === 'racer') {
    // ---------- chassis
    add(body, rbox(1.05, 0.08, 1.75, 0.03), carbon, 0, 0.17, -0.02);           // floor tray
    add(body, rbox(0.98, 0.3, 1.2, 0.13), paint, 0, 0.34, -0.12);              // main tub
    const nose = add(body, rbox(0.86, 0.2, 0.62, 0.1), paint, 0, 0.32, 0.56); // sloped nose
    nose.rotation.x = 0.16;
    add(body, rbox(0.4, 0.06, 0.5, 0.03), white, 0, 0.43, 0.5).rotation.x = 0.16; // nose stripe
    add(body, rbox(0.7, 0.06, 0.72, 0.03), black, 0, 0.49, -0.3);             // cockpit opening
    // cockpit rim / cowl in front of driver
    const cowl = add(body, rbox(0.78, 0.14, 0.26, 0.07), paint, 0, 0.5, 0.15);
    cowl.rotation.x = -0.25;
    // windshield
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.55 });
    const shield = add(body, rbox(0.6, 0.16, 0.02, 0.01), glass, 0, 0.64, 0.17);
    shield.rotation.x = -0.45;

    // ---------- front bumper: chunky wraparound, paint + chrome lip
    add(body, rbox(1.42, 0.16, 0.2, 0.08), paintDark, 0, 0.22, 0.98);
    add(body, rbox(1.3, 0.04, 0.22, 0.02), chrome, 0, 0.31, 0.98);
    for (const sx of [-1, 1]) {
      const arm = add(body, rbox(0.12, 0.1, 0.34, 0.05), carbon, sx * 0.5, 0.22, 0.8);
      arm.rotation.y = sx * 0.3;
      // headlights in the nose
      const lens = add(body, new THREE.SphereGeometry(0.07, 18, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 1.5 }), sx * 0.27, 0.36, 0.86);
      lens.scale.z = 0.45;
      add(body, new THREE.TorusGeometry(0.07, 0.014, 8, 20), chrome, sx * 0.27, 0.36, 0.87);
    }
    // number badge
    const badge = add(body, new THREE.CircleGeometry(0.09, 28), white, 0, 0.42, 0.85);
    badge.rotation.x = -0.6;

    // ---------- side pods + fenders covering the fat tires
    for (const sx of [-1, 1]) {
      add(body, rbox(0.3, 0.24, 0.85, 0.11), paint, sx * 0.6, 0.31, -0.08);    // side pod
      add(body, rbox(0.06, 0.08, 0.7, 0.03), white, sx * 0.755, 0.34, -0.08);  // stripe
      add(body, rbox(0.04, 0.12, 0.22, 0.03), black, sx * 0.76, 0.3, 0.24);    // intake
      // solid rounded fenders shrouding the tops of the tires
      add(body, rbox(0.42, 0.1, 0.66, 0.05), paint, sx * 0.74, 0.63, -0.66);
      add(body, rbox(0.12, 0.2, 0.3, 0.04), carbon, sx * 0.6, 0.52, -0.66);   // fender stay into the pod
      add(body, rbox(0.44, 0.03, 0.08, 0.015), white, sx * 0.74, 0.69, -0.4);
      add(body, rbox(0.3, 0.08, 0.5, 0.04), paint, sx * 0.68, 0.51, 0.62);
      add(body, rbox(0.3, 0.05, 0.08, 0.02), carbon, sx * 0.5, 0.48, 0.62);  // fender stay into the nose
    }
    // ---------- engine, exhausts, wing
    add(body, rbox(0.56, 0.26, 0.3, 0.06), carbon, 0, 0.4, -0.86);
    for (let i = 0; i < 4; i++) add(body, rbox(0.5, 0.02, 0.03, 0.008), chrome, 0, 0.54, -0.96 + i * 0.07);
    for (const sx of [-1, 1]) {
      const pipe = add(body, new THREE.CylinderGeometry(0.055, 0.045, 0.34, 16), chrome, sx * 0.18, 0.44, -1.05);
      pipe.rotation.x = Math.PI / 2 - 0.3;
      const mouth = add(body, new THREE.TorusGeometry(0.055, 0.012, 8, 18), chrome, sx * 0.18, 0.39, -1.21);
      mouth.rotation.x = -0.3;
      add(body, new THREE.CircleGeometry(0.048, 16), black, sx * 0.18, 0.39, -1.205).rotation.y = Math.PI;
      const tip = new THREE.Object3D();
      tip.position.set(sx * 0.18, 0.38, -1.24);
      body.add(tip);
      exhausts.push(tip);
    }
    for (const sx of [-1, 1]) {
      const strut = add(body, rbox(0.05, 0.36, 0.1, 0.02), carbon, sx * 0.32, 0.66, -0.98);
      strut.rotation.x = -0.25;
    }
    const wing = add(body, rbox(1.3, 0.05, 0.3, 0.025), paint, 0, 0.86, -1.05);
    wing.rotation.x = 0.12;
    add(body, rbox(1.2, 0.02, 0.06, 0.01), white, 0, 0.885, -0.92);
  } else {
    // ---------- egg-shaped bubble body
    const shell = add(body, new THREE.SphereGeometry(0.6, 40, 28), paint, 0, 0.42, -0.05);
    shell.scale.set(0.9, 0.42, 1.3);
    add(body, rbox(1.0, 0.1, 1.5, 0.05), carbon, 0, 0.2, -0.05);              // skirt
    const belt = add(body, new THREE.TorusGeometry(0.6, 0.025, 8, 48), white, 0, 0.4, -0.05);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(0.91, 1.31, 1);
    const pit = add(body, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 32), black, 0, 0.63, -0.3);
    pit.scale.z = 1.25;
    add(body, new THREE.TorusGeometry(0.34, 0.03, 8, 40), chrome, 0, 0.655, -0.3).rotation.x = Math.PI / 2;
    // big frog-eye headlights on the hood
    for (const sx of [-1, 1]) {
      add(body, new THREE.SphereGeometry(0.11, 20, 14), paint, sx * 0.24, 0.56, 0.42);
      const lens = add(body, new THREE.SphereGeometry(0.085, 20, 14),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 1.5 }), sx * 0.24, 0.58, 0.48);
      lens.scale.z = 0.5;
      add(body, new THREE.TorusGeometry(0.088, 0.016, 8, 24), chrome, sx * 0.24, 0.58, 0.5);
      // round taillights
      const tl = add(body, new THREE.SphereGeometry(0.06, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 1 }), sx * 0.3, 0.45, -0.8);
      tl.scale.z = 0.4;
      // round fenders hugging every wheel
      for (const [z, r] of [[0.6, 0.3], [-0.62, 0.34]] as const) {
        const f = add(body, new THREE.SphereGeometry(r * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint, sx * 0.7, r * 1.6, z);
        f.scale.set(0.62, 0.55, 1);
        (f.material as THREE.Material).side = THREE.DoubleSide;
      }
    }
    // chrome grille
    add(body, rbox(0.6, 0.16, 0.06, 0.04), chrome, 0, 0.34, 0.8);
    for (let i = -2; i <= 2; i++) add(body, rbox(0.02, 0.1, 0.03, 0.005), black, i * 0.1, 0.34, 0.835);
    add(body, rbox(1.3, 0.1, 0.14, 0.05), chrome, 0, 0.22, 0.88);              // bumper bar
    // ducktail spoiler + single big center exhaust
    const duck = add(body, rbox(0.8, 0.05, 0.2, 0.025), paint, 0, 0.62, -0.82);
    duck.rotation.x = -0.3;
    const pipe = add(body, new THREE.CylinderGeometry(0.08, 0.065, 0.3, 18), chrome, 0, 0.36, -0.88);
    pipe.rotation.x = Math.PI / 2 - 0.35;
    const mouth = add(body, new THREE.TorusGeometry(0.08, 0.016, 8, 20), chrome, 0, 0.31, -1.02);
    mouth.rotation.x = -0.35;
    const tip = new THREE.Object3D();
    tip.position.set(0, 0.3, -1.05);
    body.add(tip);
    exhausts.push(tip);
  }

  // ---------- seat, steering
  const seatMat = std(0x26262b, 0.85);
  add(body, rbox(0.46, 0.1, 0.4, 0.04), seatMat, 0, 0.5, -0.38);
  const back = add(body, rbox(0.5, 0.5, 0.12, 0.05), seatMat, 0, 0.74, -0.6);
  back.rotation.x = -0.22;
  add(body, rbox(0.24, 0.14, 0.06, 0.03), std(0xd23b3b, 0.6), 0, 0.92, -0.65).rotation.x = -0.22; // headrest pad
  const column = add(body, new THREE.CylinderGeometry(0.022, 0.022, 0.36, 8), carbon, 0, 0.6, 0.02);
  column.rotation.x = 1.0;
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 0.7, -0.12);
  steeringWheel.rotation.x = -0.75;
  steeringWheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 10, 28), black));
  steeringWheel.add(new THREE.Mesh(rbox(0.22, 0.04, 0.03, 0.01), carbon));
  steeringWheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12).rotateX(Math.PI / 2), paint));
  body.add(steeringWheel);


  // ---------- driver: chibi proportions (big head, small body)
  const suit = std(0x2f6fd8, 0.6);
  const torso = add(body, new THREE.CapsuleGeometry(0.17, 0.16, 6, 16), suit, 0, 0.73, -0.4);
  torso.rotation.x = -0.15;
  add(body, rbox(0.3, 0.05, 0.2, 0.02), white, 0, 0.84, -0.3).rotation.x = -0.15; // chest stripe
  for (const sx of [-1, 1]) {
    const arm = add(body, new THREE.CapsuleGeometry(0.06, 0.24, 4, 10), suit, sx * 0.16, 0.74, -0.24);
    arm.rotation.set(1.15, 0, -sx * 0.4);
    add(body, new THREE.SphereGeometry(0.065, 12, 10), white, sx * 0.1, 0.71, -0.1);
  }
  const headY = 1.2, headZ = -0.38, headR = 0.34;
  const head = add(body, new THREE.SphereGeometry(headR, 40, 28), std(0xf6d2b0, 0.75), 0, headY, headZ);
  head.rotation.y = -Math.PI / 2; // default sphere u=0.5 faces +X; rotate so it faces +Z (forward)

  // helmet: full shell with the face opening cut out at the front (+Z = phi π/2)
  const helmet = add(body, new THREE.SphereGeometry(headR * 1.07, 40, 24, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.72), paint, 0, headY, headZ);
  (helmet.material as THREE.Material).side = THREE.DoubleSide;
  // stripe from the back of the helmet up over the crown (stops before the face)
  const stripe = add(body, new THREE.TorusGeometry(headR * 1.075, 0.025, 8, 32, Math.PI * 0.62), white, 0, headY, headZ);
  stripe.rotation.y = Math.PI / 2;
  // goggles resting on the helmet forehead
  for (const sx of [-1, 1]) {
    const g = add(body, new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), chrome, sx * 0.1, headY + 0.27, headZ + 0.2);
    g.rotation.x = Math.PI / 2 - 0.9;
    const lens = add(body, new THREE.CircleGeometry(0.06, 20), new THREE.MeshStandardMaterial({ color: 0x66ccff, roughness: 0.1, metalness: 0.5 }), sx * 0.1, headY + 0.292, headZ + 0.223);
    lens.rotation.x = -0.9;
  }

  // placeholder face (simple eyes + smile) until step 6 applies the photo
  const placeholderFace = new THREE.Group();
  placeholderFace.position.set(0, headY, headZ);
  body.add(placeholderFace);
  const eyeMat = std(0x1d1d1f, 0.3);
  for (const sx of [-1, 1]) {
    const eye = add(placeholderFace, new THREE.SphereGeometry(0.045, 14, 10), eyeMat, sx * 0.11, 0.02, headR * 0.93);
    eye.scale.set(0.8, 1.2, 0.5);
    add(placeholderFace, new THREE.SphereGeometry(0.014, 8, 6), white, sx * 0.11 + 0.012, 0.045, headR * 0.97);
    add(placeholderFace, new THREE.SphereGeometry(0.04, 10, 8), std(0xff9a9a, 0.8), sx * 0.19, -0.07, headR * 0.86).scale.z = 0.3; // blush
  }
  const smile = add(placeholderFace, new THREE.TorusGeometry(0.055, 0.012, 6, 16, Math.PI), eyeMat, 0, -0.09, headR * 0.96);
  smile.rotation.z = Math.PI;

  // ---------- wheels (outside `body` so body lean doesn't lift them)
  const frontWheels: THREE.Group[] = [];
  const wheelSpins: THREE.Object3D[] = [];
  const addWheel = (x: number, z: number, r: number, w: number, steer: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const spin = wheel(r, w, tireMat, rimMat, hubMat);
    pivot.add(spin);
    root.add(pivot);
    wheelSpins.push(spin);
    if (steer) frontWheels.push(pivot);
  };
  // [front x, front z, front r, front w, rear x, rear z, rear r, rear w]
  const [fx, fz, fr, fw, rx, rz, rr, rw] = design === 'racer'
    ? [0.68, 0.62, 0.24, 0.24, 0.74, -0.66, 0.3, 0.36]
    : [0.7, 0.6, 0.26, 0.26, 0.7, -0.62, 0.29, 0.3];
  for (const sx of [-1, 1]) {
    addWheel(sx * fx, fz, fr, fw, true);
    addWheel(sx * rx, rz, rr, rw, false);
  }
  add(root, new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), carbon, 0, rr, rz).rotation.z = Math.PI / 2;
  add(root, new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), carbon, 0, fr, fz).rotation.z = Math.PI / 2;

  return { root, body, frontWheels, wheelSpins, steeringWheel, head, placeholderFace, exhausts, setColor };
}
