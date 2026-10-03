import * as THREE from 'three';
import { M, cylZ, cylY, cylX, box, at, extrudeXY, polyShape, ringShape, Helix, linkRod, TAU } from './geo.js';

// Kingpin inclination and lower ball joint position (relative to the hub centre).
const ALPHA = 0.2;
const BJ = new THREE.Vector3(0, -0.14, -0.07);
const X = new THREE.Vector3(1, 0, 0);

const tag = (obj, label) => {
  obj.userData.label = label;
  return obj;
};

// Front-left McPherson corner. Everything is modelled with the hub centre at the
// origin, +Z pointing out of the car and +X towards the rear.
export function buildSuspension(variant, spec, mats) {
  const root = new THREE.Group();

  const steerPivot = new THREE.Group();
  steerPivot.position.copy(BJ);
  steerPivot.rotation.x = -ALPHA;
  root.add(steerPivot);
  const steer = new THREE.Group();
  steerPivot.add(steer);
  // hubFrame undoes the pivot transform, so its children use plain hub coordinates.
  const hubFrame = new THREE.Group();
  hubFrame.rotation.x = ALPHA;
  hubFrame.position.copy(BJ).negate().applyAxisAngle(X, ALPHA);
  steer.add(hubFrame);
  // calFrame puts "radially outwards" on +Y for a caliper sitting at 3 o'clock.
  const calFrame = new THREE.Group();
  calFrame.rotation.z = -Math.PI / 2;
  hubFrame.add(calFrame);

  // ---- strut (local Y = steering axis, origin = ball joint) ----
  const strut = tag(new THREE.Group(), 'Tlumič – vzpěra McPherson');
  steer.add(strut);
  strut.add(M(cylY(0.026, 0.25, 0.46), mats.blackGloss));
  strut.add(M(cylY(0.011, 0.46, 0.63, 16), mats.chrome));
  const lathe = (pts, mat, seg = 40) =>
    M(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg), mat);
  const rubberDS = mats.rubber.clone();
  rubberDS.side = THREE.DoubleSide;
  const steelDS = mats.blackSteel.clone();
  steelDS.side = THREE.DoubleSide;
  strut.add(lathe([[0.026, 0.446], [0.068, 0.45], [0.079, 0.463], [0.074, 0.465], [0.064, 0.457], [0.026, 0.455]], steelDS));
  const boot = [];
  for (let i = 0; i <= 12; i++) boot.push([0.022 + (i % 2 ? 0.005 : 0), 0.522 + i * 0.008]);
  strut.add(lathe(boot, rubberDS, 24));
  strut.add(M(cylY(0.079, 0.618, 0.632, 40), mats.blackSteel));
  strut.add(M(cylY(0.05, 0.632, 0.65, 32), mats.rubber));

  const springGeo = new THREE.TubeGeometry(new Helix(0.06, 0.15, 4), 220, 0.0068, 10);
  springGeo.translate(0, 0.467, 0);
  const spring = tag(M(springGeo, variant === 'sport' ? mats.springSport : mats.spring), 'Vinutá pružina');
  steer.add(spring);

  // hose bracket on the strut body
  strut.add(M(box(0.022, 0.04, 0.375, 0.405, -0.008, 0.012, 0.002), mats.blackSteel));
  const hoseAnchor = new THREE.Object3D();
  hoseAnchor.position.set(0.042, 0.39, 0.004);
  steer.add(hoseAnchor);
  // anti-roll bar drop link
  const link = tag(new THREE.Group(), 'Tyčka stabilizátoru');
  steer.add(link);
  const linkRodMesh = M(cylY(0.005, -0.5, 0.5, 12), mats.blackSteel);
  const la = new THREE.Vector3(-0.036, 0.4, 0.0);
  const lb = new THREE.Vector3(-0.07, 0.18, -0.1);
  linkRod(linkRodMesh, la, lb);
  link.add(linkRodMesh);
  for (const p of [la, lb]) link.add(M(at(new THREE.SphereGeometry(0.011, 16, 12), p.x, p.y, p.z), mats.blackSteel));
  strut.add(M(box(-0.04, -0.022, 0.385, 0.415, -0.008, 0.008, 0.002), mats.blackSteel));

  // ---- knuckle ----
  const knuckle = tag(new THREE.Group(), 'Těhlice');
  hubFrame.add(knuckle);
  const iron = mats.castIron;
  knuckle.add(M(cylZ(0.062, -0.12, -0.03, 48), iron));
  knuckle.add(M(extrudeXY(polyShape([[-0.045, 0.02], [0.045, 0.02], [0.034, 0.158], [-0.034, 0.158]]), -0.142, -0.095, { bevel: 0.004 }), iron));
  knuckle.add(M(extrudeXY(polyShape([[-0.042, -0.02], [0.042, -0.02], [0.028, -0.15], [-0.028, -0.15]]), -0.1, -0.05, { bevel: 0.004 }), iron));
  knuckle.add(M(at(cylY(0.024, -0.165, -0.128, 24), 0, 0, -0.07), iron));
  knuckle.add(
    M(extrudeXY(polyShape([[-0.03, 0.025], [-0.03, -0.04], [-0.135, -0.04], [-0.152, -0.022], [-0.135, -0.004]]), -0.128, -0.1, { bevel: 0.003 }), iron),
  );
  // strut clamp (lives in the steer frame so it follows the strut axis)
  const clamp = tag(M(cylY(0.034, 0.245, 0.335, 32), iron), 'Těhlice');
  steer.add(clamp);
  const pinch = tag(M(at(cylZ(0.006, -0.03, 0.03, 12), 0, 0.29, 0), mats.zinc), 'Těhlice');
  pinch.position.x = 0.036;
  steer.add(pinch);

  // caliper mounting ears, laid out in caliper coordinates
  const ears = new THREE.Group();
  ears.rotation.z = -Math.PI / 2;
  knuckle.add(ears);
  if (variant === 'sport') {
    ears.add(
      M(
        extrudeXY(
          polyShape([[-0.106, 0.098], [-0.078, 0.098], [-0.05, 0.07], [0.05, 0.07], [0.078, 0.098], [0.106, 0.098], [0.106, 0.062], [0.05, 0.02], [-0.05, 0.02], [-0.106, 0.062]]),
          -0.114,
          -0.084,
          { bevel: 0.003 },
        ),
        iron,
      ),
    );
  } else {
    ears.add(
      M(
        extrudeXY(
          polyShape([[-0.08, 0.092], [-0.045, 0.092], [-0.03, 0.07], [0.03, 0.07], [0.045, 0.092], [0.08, 0.092], [0.08, 0.058], [0.045, 0.02], [-0.045, 0.02], [-0.08, 0.058]]),
          -0.1,
          -0.08,
          { bevel: 0.003 },
        ),
        iron,
      ),
    );
  }

  // ---- wheel bearing + hub ----
  hubFrame.add(tag(M(cylZ(0.058, -0.03, -0.012, 48), mats.castDark), 'Ložisko kola'));
  const hub = tag(new THREE.Group(), 'Náboj kola');
  hub.userData.part = 'hub';
  hubFrame.add(hub);
  const hubMat = mats.castIron.clone();
  hubMat.color.set(0x80848a);
  hubMat.roughness = 0.45;
  hub.add(M(cylZ(0.072, -0.012, 0, 48), hubMat));
  const spigotClean = new THREE.Color(0x9a9ea4);
  const spigotRust = new THREE.Color(0x49301f);
  const spigotMat = hubMat.clone();
  spigotMat.color.copy(spigotRust);
  hub.add(M(extrudeXY(ringShape(0.02, 0.0285), 0, 0.02, { curveSegments: 20 }), spigotMat));
  hub.add(M(cylZ(0.0125, -0.01, 0.015, 24), mats.zinc));
  const nut = new THREE.CylinderGeometry(0.0185, 0.0185, 0.01, 6);
  nut.rotateX(Math.PI / 2);
  nut.translate(0, 0, 0.006);
  hub.add(M(nut, mats.zinc));
  const rustFaceMat = mats.rust.clone();
  rustFaceMat.transparent = true;
  rustFaceMat.polygonOffset = true;
  rustFaceMat.polygonOffsetFactor = -2;
  const rustFace = M(new THREE.RingGeometry(0.0285, 0.072, 48), rustFaceMat);
  rustFace.position.z = 0.0004;
  rustFace.castShadow = false;
  hub.add(rustFace);
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + (k * TAU) / 5;
    const h = M(new THREE.CircleGeometry(0.0068, 20), mats.hole);
    h.position.set(0.056 * Math.cos(a), 0.056 * Math.sin(a), 0.0009);
    h.castShadow = false;
    hub.add(h);
  }
  const sa = Math.PI / 2 + TAU / 10;
  const sh = M(new THREE.CircleGeometry(0.0032, 12), mats.hole);
  sh.position.set(0.056 * Math.cos(sa), 0.056 * Math.sin(sa), 0.0009);
  sh.castShadow = false;
  hub.add(sh);
  // k = 0 rusty ... 1 cleaned to bare metal
  hub.userData.clean = (k) => {
    rustFaceMat.opacity = 1 - k;
    rustFace.visible = k < 0.999;
    spigotMat.color.lerpColors(spigotRust, spigotClean, k);
  };

  // ---- dust shield ----
  const shieldMat = mats.blackSteel.clone();
  shieldMat.side = THREE.DoubleSide;
  const shield = tag(M(new THREE.RingGeometry(0.066, spec.shieldR, 72, 1, spec.shieldGap, TAU - 2 * spec.shieldGap), shieldMat), 'Krycí plech kotouče');
  shield.position.z = spec.shieldZ;
  hubFrame.add(shield);

  // ---- drive shaft ----
  const cv = tag(new THREE.Group(), 'Poloosa – homokinetický kloub s manžetou');
  hubFrame.add(cv);
  cv.add(M(cylZ(0.042, -0.17, -0.12, 32), mats.blackSteel));
  const bootPts = [[0.02, -0.265], [0.022, -0.248], [0.033, -0.236], [0.03, -0.226], [0.039, -0.216], [0.036, -0.206], [0.044, -0.196], [0.04, -0.186], [0.047, -0.176], [0.044, -0.168]];
  const cvBoot = lathe(bootPts, rubberDS, 32);
  cvBoot.geometry.rotateX(Math.PI / 2);
  cv.add(cvBoot);
  const shaft = tag(M(cylY(0.013, -0.5, 0.5, 16), mats.blackSteel), 'Poloosa');
  root.add(shaft);
  const shaftOuter = new THREE.Vector3(0, 0, -0.262);
  const shaftInner = new THREE.Vector3(0, -0.03, -0.8);

  // ---- tie rod ----
  const tieEnd = tag(new THREE.Group(), 'Kulový čep řízení');
  hubFrame.add(tieEnd);
  tieEnd.add(M(at(new THREE.SphereGeometry(0.018, 20, 14), -0.136, 0.006, -0.114), mats.blackSteel));
  tieEnd.add(M(at(cylY(0.013, -0.006, 0.004, 16, 0.017), -0.136, 0, -0.114), mats.rubber));
  tieEnd.add(M(at(cylY(0.006, -0.05, -0.034, 6), -0.136, 0, -0.114), mats.zinc));
  const tieRod = tag(M(cylY(0.0075, -0.5, 0.5, 12), mats.steel), 'Řídicí tyč');
  root.add(tieRod);
  const tieOuter = new THREE.Vector3(-0.136, 0.006, -0.114);
  const tieInner = new THREE.Vector3(-0.19, 0.03, -0.66);

  // ---- lower control arm + subframe (fixed to the body) ----
  const arm = tag(new THREE.Group(), 'Spodní rameno');
  root.add(arm);
  const armGeo = extrudeXY(
    polyShape([[-0.035, -0.04], [0.035, -0.04], [0.26, -0.5], [0.26, -0.55], [0.13, -0.55], [0.02, -0.3], [-0.1, -0.55], [-0.2, -0.55], [-0.2, -0.5]]),
    0,
    0.024,
    { bevel: 0.005 },
  );
  armGeo.rotateX(Math.PI / 2);
  armGeo.translate(0, -0.178, 0);
  arm.add(M(armGeo, mats.blackSteel));
  arm.add(M(at(cylX(0.021, 0.12, 0.27, 20), 0, -0.19, -0.55), mats.rubber));
  arm.add(M(at(cylX(0.021, -0.21, -0.09, 20), 0, -0.19, -0.55), mats.rubber));
  const bjBoot = tag(M(at(cylY(0.016, -0.18, -0.164, 20, 0.023), 0, 0, -0.07), mats.rubber), 'Spodní kulový čep');
  root.add(bjBoot);
  root.add(tag(M(box(-0.55, 0.55, -0.3, 0.06, -1.1, -0.6, 0.03), mats.castDark), 'Nápravnice'));

  const tmp = new THREE.Vector3();
  const toRoot = (local) => {
    tmp.copy(local).applyMatrix4(hubFrame.matrixWorld);
    return root.worldToLocal(tmp);
  };
  const a = new THREE.Vector3();
  function update() {
    hubFrame.updateWorldMatrix(true, false);
    a.copy(toRoot(shaftOuter));
    linkRod(shaft, a, shaftInner);
    a.copy(toRoot(tieOuter));
    linkRod(tieRod, a, tieInner);
  }

  return {
    root,
    steer,
    hubFrame,
    calFrame,
    hub,
    hoseAnchor,
    steerAngle: 0,
    setSteer(angle) {
      this.steerAngle = angle;
      steer.rotation.y = angle;
    },
    update,
  };
}
