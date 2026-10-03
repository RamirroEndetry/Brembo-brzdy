import * as THREE from 'three';
import { orientedBox } from './geo.js';
import { tween, Ease } from './tween.js';
import { buildSuspension } from './suspension.js';
import { buildBrakes, SPEC } from './brakes.js';
import { HUB } from './world.js';

const FLAT = [-Math.PI / 2, 0, 0]; // outer side up
const FLIP = [Math.PI / 2, 0, 0]; // inner side up
const LYING = [0, Math.PI / 2, 0]; // bolt lying on its side

// Where each removed part rests on the cart (x, z on the cart top + orientation).
const TRAY = {
  standard: {
    disc: [-0.27, 0.0, FLAT],
    bracket: [0.03, -0.11, FLAT],
    padOuter: [0.0, 0.12, FLAT],
    padInner: [0.14, 0.12, FLIP],
    clip1: [0.21, -0.17, [0, 0, Math.PI / 2]],
    clip2: [0.21, -0.09, [0, 0, -Math.PI / 2]],
    bracketBolt1: [0.345, 0.03, LYING],
    bracketBolt2: [0.345, 0.07, LYING],
    guideBolt1: [0.39, 0.03, LYING],
    guideBolt2: [0.39, 0.07, LYING],
    discScrew: [0.37, 0.105, LYING],
  },
  sport: {
    disc: [-0.265, 0.0, FLAT],
    padOuter: [0.035, 0.13, FLAT],
    padInner: [0.035, 0.02, FLIP],
    padSpring: [0.04, -0.14, FLAT],
    retPin1: [0.3, -0.13, LYING],
    retPin2: [0.3, -0.17, LYING],
    caliperBolt1: [0.345, 0.04, LYING],
    caliperBolt2: [0.345, 0.08, LYING],
    discScrew: [0.39, 0.06, LYING],
  },
};

// mode: 'preview' (assembled, clean), 'demontaz' (assembled, worn) or 'montaz'
// (bare hub, new parts waiting on the cart, caliper hanging on its hook).
export function createRig({ world, mats, variant, mode }) {
  const root = new THREE.Group();
  world.scene.add(root);
  const S = SPEC[variant];
  const sus = buildSuspension(variant, S, mats);
  sus.root.position.copy(HUB);
  root.add(sus.root);
  const br = buildBrakes({ variant, worn: mode === 'demontaz', preview: mode === 'preview', sus, mats });
  const { parts, caliper } = br;
  root.updateMatrixWorld(true);

  for (const [name, p] of Object.entries(parts)) {
    if (name === 'hub' || name.startsWith('pin')) continue;
    p.userData.home = { parent: p.parent, pos: p.position.clone(), quat: p.quaternion.clone() };
    const t = TRAY[variant][name];
    if (!t) continue;
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...t[2]));
    const bb = orientedBox(p, quat);
    p.userData.tray = { pos: new THREE.Vector3(t[0], -bb.min.y + 0.001, t[1]), quat };
  }

  const hoseMesh = new THREE.Mesh(new THREE.BufferGeometry(), mats.hose);
  hoseMesh.castShadow = true;
  hoseMesh.userData.label = 'Brzdová hadice';
  root.add(hoseMesh);
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const lastA = new THREE.Vector3(1e9, 0, 0);
  const lastB = new THREE.Vector3(1e9, 0, 0);
  const dirA = new THREE.Vector3();
  function updateHose() {
    const anchor = caliper.userData.hoseAnchor;
    anchor.getWorldPosition(A);
    sus.hoseAnchor.getWorldPosition(B);
    if (A.distanceToSquared(lastA) < 1e-9 && B.distanceToSquared(lastB) < 1e-9) return;
    lastA.copy(A);
    lastB.copy(B);
    dirA.set(0, 0, -1).transformDirection(caliper.matrixWorld);
    const p1 = A.clone().addScaledVector(dirA, 0.04);
    const p3 = B.clone().add(new THREE.Vector3(0.012, -0.045, 0.0));
    const mid = p1.clone().add(p3).multiplyScalar(0.5).addScaledVector(dirA, 0.03);
    mid.y -= 0.025;
    const curve = new THREE.CatmullRomCurve3([A.clone(), p1, mid, p3, B.clone()]);
    hoseMesh.geometry.dispose();
    hoseMesh.geometry = new THREE.TubeGeometry(curve, 32, 0.0052, 8);
  }

  const cartTop = world.cartTop;
  const tmpQ = new THREE.Quaternion();
  function trayWorld(p) {
    cartTop.updateWorldMatrix(true, false);
    return {
      pos: p.userData.tray.pos.clone().applyMatrix4(cartTop.matrixWorld),
      quat: cartTop.getWorldQuaternion(new THREE.Quaternion()).multiply(p.userData.tray.quat),
    };
  }
  function homeWorld(p, offset) {
    const h = p.userData.home;
    h.parent.updateWorldMatrix(true, false);
    const pos = h.pos.clone();
    if (offset) pos.add(offset);
    return { pos: pos.applyMatrix4(h.parent.matrixWorld), quat: h.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(h.quat) };
  }
  // root has an identity transform, so a part attached to it uses world coordinates.
  async function fly(p, to, dur, lift = 0.1) {
    root.attach(p);
    const from = p.position.clone();
    const fq = p.quaternion.clone();
    await tween(dur, (k) => {
      p.position.lerpVectors(from, to.pos, k);
      const arc = Math.sin(k * Math.PI);
      p.position.y += arc * lift;
      p.position.z += arc * 0.14;
      p.quaternion.slerpQuaternions(fq, to.quat, k);
    }, Ease.inOut);
  }

  const rig = {
    root,
    sus,
    variant,
    mode,
    parts,
    greases: br.greases,
    caliper,
    hook: br.hook,
    pistonMin: br.pistonMin,
    pistonWorn: br.pistonWorn,
    setPiston: br.setPistonExt,

    snapToTray(p) {
      root.attach(p);
      const t = trayWorld(p);
      p.position.copy(t.pos);
      p.quaternion.copy(t.quat);
    },
    snapHome(p) {
      const h = p.userData.home;
      h.parent.add(p);
      p.position.copy(h.pos);
      p.quaternion.copy(h.quat);
    },
    flyToTray(p, dur = 0.85) {
      return fly(p, trayWorld(p), dur);
    },
    // Flies to the home pose shifted by `offset` (given in the home parent's frame).
    async flyHome(p, offset = null, dur = 0.9) {
      await fly(p, homeWorld(p, offset), dur);
      this.snapHome(p);
      if (offset) p.position.add(offset);
    },
    moveLocal(p, delta, dur = 0.45) {
      const from = p.position.clone();
      const to = from.clone().add(delta);
      return tween(dur, (k) => p.position.lerpVectors(from, to, k), Ease.inOut);
    },
    async hangCaliper(dur = 0.9) {
      sus.hubFrame.attach(caliper);
      const from = caliper.position.clone();
      const fq = caliper.quaternion.clone();
      await tween(dur, (k) => {
        caliper.position.lerpVectors(from, br.hang.pos, k);
        caliper.position.z += Math.sin(k * Math.PI) * 0.05;
        caliper.quaternion.slerpQuaternions(fq, br.hang.quat, k);
      }, Ease.inOut);
    },
    snapHang() {
      sus.hubFrame.attach(caliper);
      caliper.position.copy(br.hang.pos);
      caliper.quaternion.copy(br.hang.quat);
    },
    // Fades a set of grease patches in (k: 0..1).
    setGrease(names, k) {
      for (const n of names) {
        const g = br.greases[n];
        if (!g) continue;
        if (!g.userData.mat) {
          let src = null;
          g.traverse((o) => {
            if (o.isMesh && !src) src = o.material;
          });
          g.userData.mat = src.clone();
          g.traverse((o) => {
            if (o.isMesh) o.material = g.userData.mat;
          });
        }
        g.visible = k > 0;
        g.userData.mat.opacity = 0.88 * k;
      }
    },
    update() {
      sus.update();
      updateHose();
    },
    destroy() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      world.scene.remove(root);
    },
  };

  // initial state
  sus.hub.userData.clean(mode === 'preview' ? 1 : 0);
  br.setPistonExt(mode === 'preview' ? br.pistonMin : br.pistonWorn);
  if (mode === 'montaz') {
    for (const p of Object.values(parts)) if (p.userData.tray) rig.snapToTray(p);
    rig.snapHang();
    br.hook.visible = true;
  }
  root.updateMatrixWorld(true);
  rig.update();
  return rig;
}
