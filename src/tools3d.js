import * as THREE from 'three';
import { M, cylZ, cylY, cylX, box, at, TAU } from './geo.js';
import { tween, Ease } from './tween.js';
import { audio } from './audio.js';

const Z = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);

// 3D tool models. Each one is built with its working tip at the origin and its
// body extending along +Z, i.e. away from the part it is working on.
export function createTools(scene, mats) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const models = {};
  const add = (name, downRef, build) => {
    const g = new THREE.Group();
    build(g);
    g.visible = false;
    g.userData.downRef = downRef;
    g.traverse((o) => {
      if (o.isMesh) o.receiveShadow = false;
    });
    root.add(g);
    models[name] = g;
  };

  add('ratchet', new THREE.Vector3(1, 0, 0), (g) => {
    g.add(M(cylZ(0.0115, 0, 0.03, 20), mats.toolChrome));
    g.add(M(cylZ(0.006, 0.03, 0.082, 12), mats.toolChrome));
    g.add(M(cylZ(0.017, 0.078, 0.096, 24), mats.toolChrome));
    g.add(M(at(cylX(0.0075, 0, 0.13, 12), 0, 0, 0.087), mats.toolChrome));
    g.add(M(at(cylX(0.0125, 0.12, 0.23, 16), 0, 0, 0.087), mats.toolGrip));
  });
  add('torque', new THREE.Vector3(1, 0, 0), (g) => {
    g.add(M(cylZ(0.0115, 0, 0.03, 20), mats.toolChrome));
    g.add(M(cylZ(0.006, 0.03, 0.082, 12), mats.toolChrome));
    g.add(M(cylZ(0.018, 0.078, 0.097, 24), mats.toolChrome));
    g.add(M(at(cylX(0.008, 0, 0.22, 12), 0, 0, 0.0875), mats.toolChrome));
    g.add(M(at(cylX(0.0135, 0.2, 0.28, 16), 0, 0, 0.0875), mats.toolBrass));
    g.add(M(at(cylX(0.015, 0.28, 0.41, 16), 0, 0, 0.0875), mats.toolGripDark));
    g.add(M(at(cylX(0.016, 0.41, 0.42, 16), 0, 0, 0.0875), mats.toolGrip));
  });
  add('screwdriver', null, (g) => {
    g.add(M(cylZ(0.003, 0, 0.1, 10), mats.toolChrome));
    g.add(M(cylZ(0.015, 0.1, 0.2, 12), mats.toolGrip));
    g.add(M(cylZ(0.012, 0.2, 0.207, 12), mats.toolGripDark));
  });
  add('brush', new THREE.Vector3(0, 1, 0), (g) => {
    g.add(M(box(-0.012, 0.012, -0.02, 0.03, 0, 0.014), mats.toolBrass));
    g.add(M(box(-0.013, 0.013, -0.025, 0.035, 0.014, 0.03, 0.004), mats.toolWood));
    g.add(M(box(-0.0105, 0.0105, 0.03, 0.2, 0.016, 0.03, 0.005), mats.toolWood));
  });
  add('cleaner', new THREE.Vector3(0, -1, 0), (g) => {
    g.add(M(at(cylY(0.031, -0.21, -0.035, 28), 0, 0, 0.035), mats.toolDark));
    g.add(M(at(cylY(0.0315, -0.16, -0.09, 28), 0, 0, 0.035), mats.toolGrip));
    g.add(M(at(cylY(0.027, -0.035, -0.022, 28, 0.016), 0, 0, 0.035), mats.toolChrome));
    g.add(M(at(cylY(0.013, -0.022, 0.006, 16), 0, 0, 0.035), mats.toolWhite));
    g.add(M(box(-0.003, 0.003, -0.006, 0.0, 0, 0.03), mats.toolWhite));
    const N = 160;
    const pos = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * 0.28;
      seeds.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, speed: 0.7 + Math.random() * 0.8, phase: Math.random() });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xeaf2ff, size: 0.007, transparent: true, opacity: 0.55, depthWrite: false }));
    pts.frustumCulled = false;
    pts.visible = false;
    g.add(pts);
    g.userData.spray = (time, reach) => {
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const t = (time * s.speed * 2.2 + s.phase) % 1;
        pos[i * 3] = s.dx * t * reach;
        pos[i * 3 + 1] = s.dy * t * reach;
        pos[i * 3 + 2] = -t * reach;
      }
      geo.attributes.position.needsUpdate = true;
    };
    g.userData.sprayPts = pts;
  });
  const tube = (body, band) => (g) => {
    g.add(M(cylZ(0.0025, 0, 0.022, 12, 0.008), mats.toolWhite));
    g.add(M(cylZ(0.017, 0.022, 0.135, 20), body));
    g.add(M(cylZ(0.0175, 0.05, 0.095, 20), band));
    g.add(M(box(-0.018, 0.018, -0.003, 0.003, 0.135, 0.15), body));
  };
  add('paste', null, tube(mats.toolGrip, mats.toolWhite));
  add('silicone', null, tube(mats.toolWhite, mats.toolBlue));
  add('pistonTool', null, (g) => {
    g.add(M(cylZ(0.024, 0, 0.005, 28), mats.toolDark));
    g.add(M(cylZ(0.006, 0.005, 0.125, 12), mats.toolChrome));
    g.add(M(box(-0.035, 0.035, -0.012, 0.012, 0.05, 0.064, 0.004), mats.toolDark));
    const spin = new THREE.Group();
    spin.add(M(at(cylX(0.0045, -0.06, 0.06, 10), 0, 0, 0.125), mats.toolChrome));
    g.add(spin);
    g.userData.spin = spin;
  });
  add('hammer', new THREE.Vector3(0, -1, 0), (g) => {
    g.add(M(cylZ(0.0025, 0, 0.02, 10, 0.0045), mats.toolDark));
    g.add(M(cylZ(0.0045, 0.02, 0.13, 10), mats.toolDark));
    const ham = new THREE.Group();
    ham.add(M(cylZ(0.015, -0.03, 0.03, 20), mats.toolChrome));
    ham.add(M(cylY(0.009, -0.27, -0.008, 12), mats.toolWood));
    ham.position.z = 0.26;
    g.add(ham);
    g.userData.ham = ham;
  });

  const pos = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const base = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const ref = new THREE.Vector3();
  const want = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();

  // Runs a tool animation on `obj`. `point` and `axis` are given in obj's local
  // frame; the tool follows the object while `progress(k)` moves it.
  async function use(kind, { obj, point = new THREE.Vector3(), localAxis = Z, motion = 'hold', dur = 1.2, progress, onStrike, strikes = 2, standoff = 0, radius = 0.03 }) {
    const model = models[kind];
    if (!model) {
      if (progress) await tween(dur, (k) => progress(k), Ease.inOut);
      return;
    }
    const locate = () => {
      obj.updateWorldMatrix(true, false);
      pos.copy(point).applyMatrix4(obj.matrixWorld);
    };
    locate();
    obj.getWorldQuaternion(q);
    axis.copy(localAxis).applyQuaternion(q).normalize();
    base.setFromUnitVectors(Z, axis);
    if (model.userData.downRef) {
      // roll the tool about its axis so the handle hangs down naturally
      ref.copy(model.userData.downRef).applyQuaternion(base);
      want.copy(DOWN).addScaledVector(axis, -axis.dot(DOWN));
      if (want.lengthSq() < 0.02) want.set(1, 0, 0).addScaledVector(axis, -axis.x);
      want.normalize();
      const ang = Math.atan2(u.crossVectors(ref, want).dot(axis), ref.dot(want));
      base.premultiply(roll.setFromAxisAngle(axis, ang));
    }
    u.set(1, 0, 0).applyQuaternion(base);
    v.set(0, 1, 0).applyQuaternion(base);

    for (const m of Object.values(models)) m.visible = m === model;
    root.visible = true;
    let away = 0.14;
    let swing = 0;
    let lx = 0;
    let ly = 0;
    const apply = () => {
      locate();
      root.position.copy(pos).addScaledVector(axis, standoff + away).addScaledVector(u, lx).addScaledVector(v, ly);
      root.quaternion.copy(base).multiply(roll.setFromAxisAngle(Z, swing));
    };
    root.scale.setScalar(0.6);
    await tween(0.28, (k) => {
      away = 0.14 * (1 - k);
      root.scale.setScalar(0.6 + 0.4 * k);
      apply();
    }, Ease.out);

    if (motion === 'ratchet') {
      const strokes = 3;
      audio.ratchet(8);
      let last = -1;
      await tween(dur, (k) => {
        const s = k * strokes;
        const i = Math.floor(s);
        if (i !== last && i > 0 && i < strokes) audio.ratchet(8);
        last = i;
        const f = s - Math.floor(s);
        swing = (f < 0.5 ? f * 2 : 2 - f * 2) * 0.7 - 0.35;
        if (progress) progress(k);
        apply();
      }, Ease.linear);
    } else if (motion === 'torque') {
      audio.ratchet(6);
      await tween(dur * 0.45, (k) => {
        swing = Math.sin(k * TAU * 1.5) * 0.3;
        if (progress) progress(k);
        apply();
      }, Ease.linear);
      await tween(dur * 0.55, (k) => {
        swing = -0.35 + 0.6 * k;
        apply();
      }, Ease.in);
      audio.torqueClick();
      await tween(0.16, (k) => {
        swing = 0.25 + Math.sin(k * Math.PI) * 0.05;
        apply();
      }, Ease.linear);
    } else if (motion === 'spin') {
      audio.ratchet(10);
      await tween(dur, (k) => {
        swing = k * TAU * 3;
        if (progress) progress(k);
        apply();
      }, Ease.inOut);
    } else if (motion === 'scrub') {
      audio.scrub(dur);
      await tween(dur, (k) => {
        const a = k * TAU * 3.2;
        const r = radius * (0.75 + 0.25 * Math.sin(k * 40));
        lx = Math.cos(a) * r;
        ly = Math.sin(a) * r;
        if (progress) progress(k);
        apply();
      }, Ease.linear);
    } else if (motion === 'spray') {
      const pts = model.userData.sprayPts;
      pts.visible = true;
      audio.spray(dur);
      await tween(dur, (k, raw) => {
        lx = Math.sin(raw * TAU * 1.5) * radius;
        ly = Math.cos(raw * TAU) * radius * 0.6;
        model.userData.spray(raw * dur, standoff * 1.05);
        if (progress) progress(k);
        apply();
      }, Ease.linear);
      pts.visible = false;
    } else if (motion === 'dab') {
      audio.squish();
      await tween(dur, (k) => {
        const a = k * TAU * 2;
        lx = Math.cos(a) * radius;
        ly = Math.sin(a) * radius;
        away = Math.abs(Math.sin(k * TAU * 2.5)) * 0.006;
        if (progress) progress(k);
        apply();
      }, Ease.linear);
    } else if (motion === 'press') {
      audio.ratchet(12);
      await tween(dur, (k) => {
        model.userData.spin.rotation.z = k * TAU * 3;
        if (progress) progress(k);
        apply();
      }, Ease.inOut);
    } else if (motion === 'strike') {
      const ham = model.userData.ham;
      for (let i = 0; i < strikes; i++) {
        await tween(0.11, (k) => {
          ham.position.z = 0.26 - 0.1 * k;
          apply();
        }, Ease.in);
        audio.hammer();
        if (onStrike) onStrike(i);
        await tween(0.22, (k) => {
          ham.position.z = 0.16 + 0.1 * k;
          apply();
        }, Ease.out);
      }
    } else {
      await tween(dur, (k) => {
        if (progress) progress(k);
        apply();
      }, Ease.linear);
    }

    await tween(0.22, (k) => {
      away = 0.14 * k;
      root.scale.setScalar(1 - 0.4 * k);
      apply();
    }, Ease.in);
    root.visible = false;
    model.visible = false;
  }

  return { use, hide: () => (root.visible = false) };
}
