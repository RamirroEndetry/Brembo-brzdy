import * as THREE from 'three';
import { M, cylZ, cylY, box, at, extrudeXY, extrudeZY, sectorShape, filletShape, arcPts, ringShape, circleHole, recenter, TAU } from './geo.js';

// Key dimensions [m]. Axial positions (z) are relative to the hub flange face,
// negative values lie towards the centre of the car.
export const SPEC = {
  standard: {
    R: 0.156, rIn: 0.074, zOut: -0.02, zIn: -0.045, plate: 0.008,
    padR1: 0.095, padR2: 0.154, padA: 0.37, padNew: 0.012, padWorn: 0.004,
    shieldR: 0.168, shieldGap: 0.98, shieldZ: -0.052,
  },
  sport: {
    R: 0.1775, rIn: 0.112, zOut: -0.02, zIn: -0.052, plate: 0.01,
    padR1: 0.118, padR2: 0.176, padA: 0.42, padNew: 0.012, padWorn: 0.004,
    shieldR: 0.166, shieldGap: 0.68, shieldZ: -0.06,
  },
};

const BOLT_ANGLE = (k) => Math.PI / 2 + (k * TAU) / 5;
const SCREW_ANGLE = Math.PI / 2 + TAU / 10;
const PCD_R = 0.056;

// Orientation whose local +Y points along yDir and local +Z as close to zHint as possible.
function basisQuat(yDir, zHint) {
  const y = new THREE.Vector3(...yDir).normalize();
  const z = new THREE.Vector3(...zHint);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function hatFaceShape(r) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, TAU, false);
  s.holes.push(circleHole(0, 0, 0.029));
  for (let k = 0; k < 5; k++) s.holes.push(circleHole(PCD_R * Math.cos(BOLT_ANGLE(k)), PCD_R * Math.sin(BOLT_ANGLE(k)), 0.0078));
  s.holes.push(circleHole(PCD_R * Math.cos(SCREW_ANGLE), PCD_R * Math.sin(SCREW_ANGLE), 0.0042));
  return s;
}

function buildDisc(S, sport, worn, mats) {
  const g = new THREE.Group();
  const face = worn ? mats.discFaceWorn : mats.discFace.clone();
  const plateShape = () => {
    const s = ringShape(S.rIn, S.R);
    if (sport) {
      for (let k = 0; k < 12; k++) {
        for (let j = 0; j < 4; j++) {
          const r = 0.127 + j * 0.0135;
          const a = (k * TAU) / 12 + j * 0.085;
          s.holes.push(circleHole(r * Math.cos(a), r * Math.sin(a), 0.0032));
        }
      }
    }
    return s;
  };
  const ringOpts = { curveSegments: 72, smooth: false };
  const outer = M(extrudeXY(plateShape(), S.zOut - S.plate, S.zOut, ringOpts), [face, mats.discEdge]);
  const inner = M(extrudeXY(plateShape(), S.zIn, S.zIn + S.plate, ringOpts), [face, mats.discEdge]);
  g.add(outer, inner);

  // cooling vanes between the two friction plates
  const gap = S.zOut - S.plate - (S.zIn + S.plate);
  const zMid = (S.zOut + S.zIn) / 2;
  const vaneLen = S.R - S.rIn - 0.012;
  const vanes = new THREE.InstancedMesh(new THREE.BoxGeometry(vaneLen, 0.0045, gap + 0.001), mats.discEdge, 40);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const rm = (S.R + S.rIn) / 2;
  for (let i = 0; i < 40; i++) {
    const a = (i * TAU) / 40;
    q.setFromAxisAngle(zAxis, a + (sport ? 0.32 : 0));
    m4.compose(new THREE.Vector3(rm * Math.cos(a), rm * Math.sin(a), zMid), q, new THREE.Vector3(1, 1, 1));
    vanes.setMatrixAt(i, m4);
  }
  vanes.castShadow = true;
  vanes.userData.noBounds = true;
  g.add(vanes);
  g.add(M(extrudeXY(ringShape(S.rIn, S.rIn + 0.012), S.zIn, S.zOut, { curveSegments: 48, smooth: false }), mats.discEdge));

  const overlay = (r0, r1, z, mat) => {
    const o = M(new THREE.RingGeometry(r0, r1, 72), mat);
    o.position.z = z;
    o.castShadow = false;
    g.add(o);
    return o;
  };

  if (sport) {
    // two-piece floating disc: aluminium bell + bobbins
    g.add(M(extrudeXY(hatFaceShape(0.074), 0, 0.008, { curveSegments: 20 }), mats.discBell));
    const cone = new THREE.LatheGeometry(
      [[0.068, 0.0], [0.11, -0.026], [0.11, -0.033], [0.119, -0.033], [0.119, -0.024], [0.074, 0.008]].map((p) => new THREE.Vector2(p[0], p[1])),
      64,
    );
    cone.rotateX(Math.PI / 2);
    g.add(M(cone, mats.discBell));
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10 + 0.3;
      g.add(M(at(cylZ(0.0062, -0.0345, -0.0225, 16), 0.1145 * Math.cos(a), 0.1145 * Math.sin(a), 0), mats.bobbin));
    }
  } else {
    const hatMat = worn ? mats.rust : mats.discHat;
    g.add(M(extrudeXY(hatFaceShape(0.078), 0, 0.007, { curveSegments: 24 }), [hatMat, hatMat]));
    g.add(M(extrudeXY(ringShape(0.071, 0.078), S.zOut - 0.002, 0.0005, { curveSegments: 64 }), hatMat));
  }

  if (worn) {
    // rust on the unswept bands and a wear lip on the outer edge
    const rust = mats.rust.clone();
    rust.polygonOffset = true;
    rust.polygonOffsetFactor = -2;
    overlay(S.R - 0.0035, S.R, S.zOut + 0.0003, rust);
    overlay(sport ? S.rIn : 0.078, S.padR1 - 0.003, S.zOut + 0.0003, rust);
  } else {
    // new disc: preservation oil that has to be wiped off before fitting
    face.roughness = 0.2;
    g.userData.degrease = (k) => {
      face.roughness = 0.2 + 0.22 * k;
    };
  }
  return g;
}

function buildScrew(mats) {
  const g = new THREE.Group();
  g.add(M(cylZ(0.0032, -0.003, 0.0003, 20, 0.006), mats.zinc));
  g.add(M(cylZ(0.0027, -0.018, -0.003, 12), mats.zinc));
  const recess = M(new THREE.CircleGeometry(0.0028, 6), mats.hole);
  recess.position.z = 0.0006;
  recess.castShadow = false;
  g.add(recess);
  return g;
}

// Bolt with its origin under the head; +Z points out of the threaded hole.
function buildBolt(mats, { af, headH, r, len, socket = false, flange = true }) {
  const g = new THREE.Group();
  const headR = socket ? af / 2 : af / 2 / Math.cos(Math.PI / 6);
  const z0 = flange ? 0.002 : 0;
  if (flange) g.add(M(cylZ(headR * 1.25, 0, z0, 24), mats.zinc));
  g.add(M(cylZ(headR, z0, z0 + headH, socket ? 24 : 6), mats.zinc));
  if (socket) {
    const rec = M(new THREE.CircleGeometry(headR * 0.55, 6), mats.hole);
    rec.position.z = z0 + headH + 0.0003;
    rec.castShadow = false;
    g.add(rec);
  }
  g.add(M(cylZ(r, -len, 0, 14), mats.zinc));
  g.userData.len = len;
  return g;
}

function greaseMesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.userData.noBounds = true;
  m.renderOrder = 2;
  return m;
}

// Brake pad in caliper coordinates (radial = +Y). `tf` is the lining thickness.
function buildPad(S, mats, { inner, tf, sport, greaseMat }) {
  const g = new THREE.Group();
  const a = S.padA;
  const dir = inner ? -1 : 1; // direction from the disc face towards the backing plate
  const zFace = inner ? S.zIn : S.zOut;
  const span = (z0, z1) => [Math.min(z0, z1), Math.max(z0, z1)];
  const [f0, f1] = span(zFace, zFace + dir * tf);
  const [b0, b1] = span(zFace + dir * tf, zFace + dir * (tf + 0.005));
  g.add(M(extrudeXY(sectorShape(S.padR1 + 0.001, S.padR2 - 0.001, -a + 0.012, a - 0.012), f0, f1, { bevel: 0.0008, curveSegments: 20 }), mats.padFriction));
  g.add(M(extrudeXY(sectorShape(S.padR1 - 0.003, S.padR2 + 0.002, -a - 0.006, a + 0.006), b0, b1, { curveSegments: 20 }), mats.padBack));
  // centre groove in the lining
  const slot = M(box(-0.0012, 0.0012, S.padR1 + 0.002, S.padR2 - 0.002, zFace - dir * 0.0002, zFace - dir * 0.0001), mats.hole);
  slot.castShadow = false;
  g.add(slot);
  const zBack = zFace + dir * (tf + 0.005);
  const [s0, s1] = span(zBack, zBack + dir * 0.0008);
  g.add(M(extrudeXY(sectorShape(S.padR1 + 0.006, S.padR2 - 0.008, -a + 0.05, a - 0.05), s0, s1, { curveSegments: 16 }), mats.shim));
  if (sport) {
    for (const sx of [-1, 1]) g.add(M(box(sx * 0.04 - 0.009, sx * 0.04 + 0.009, S.padR2, S.padR2 + 0.021, b0, b1, 0.002), mats.padBack));
  }
  const rMid = (S.padR1 + S.padR2) / 2;
  if (!inner) {
    const logo = M(new THREE.PlaneGeometry(0.04, 0.0117), mats.logoWhite);
    logo.position.set(0, sport ? 0.1655 : rMid + 0.0155, zBack + 0.0011);
    logo.castShadow = false;
    logo.userData.noBounds = true;
    g.add(logo);
  }

  // lubrication points on the backing plate (hidden until the paste is applied)
  const grease = new THREE.Group();
  grease.visible = false;
  const zG = zBack + dir * 0.0011;
  const flip = inner ? Math.PI : 0;
  const patch = (geo, x, y) => {
    const m = greaseMesh(geo, greaseMat);
    m.position.set(x, y, zG);
    m.rotation.y = flip;
    grease.add(m);
  };
  if (sport) {
    for (const sx of [-1, 1]) patch(new THREE.RingGeometry(0.01, 0.0165, 28), sx * 0.0306, 0.1437);
    for (const sx of [-1, 1]) patch(new THREE.PlaneGeometry(0.006, 0.04), sx * (S.padR2 * Math.sin(a) - 0.008), rMid + 0.004);
  } else if (inner) {
    patch(new THREE.RingGeometry(0.019, 0.027, 32), 0, 0.125);
  } else {
    for (const sx of [-1, 1]) patch(new THREE.PlaneGeometry(0.022, 0.026), sx * 0.03, 0.118);
  }
  g.add(grease);
  g.userData.grease = grease;
  return recenter(g, new THREE.Vector3(0, rMid, (f0 + b1) / 2));
}

// `preview` builds a clean, fully assembled set for the menu backdrop.
export function buildBrakes({ variant, worn, preview = false, sus, mats }) {
  const S = SPEC[variant];
  const sport = variant === 'sport';
  const parts = { hub: sus.hub };
  const greases = {};
  const cal = sus.calFrame;
  const reg = (name, obj, parent, label) => {
    obj.name = name;
    obj.userData.part = name;
    obj.userData.label = label;
    parent.add(obj);
    parts[name] = obj;
    return obj;
  };
  const tf = worn ? S.padWorn : S.padNew;
  const wear = S.padNew - tf;
  const paste = mats.greasePaste.clone();
  const silicone = mats.greaseSilicone.clone();

  // ---- hub paste film ----
  const hubGrease = new THREE.Group();
  hubGrease.visible = false;
  hubGrease.add(greaseMesh(cylZ(0.0291, 0.001, 0.019, 40), paste));
  sus.hub.add(hubGrease);
  greases.hub = hubGrease;

  // ---- disc + retaining screw ----
  const disc = reg('disc', buildDisc(S, sport, worn, mats), sus.hubFrame, sport ? 'Plovoucí děrovaný kotouč Brembo' : 'Brzdový kotouč');
  disc.userData.outPath = [[0, 0, 0.11]];
  const screw = reg('discScrew', buildScrew(mats), sus.hubFrame, 'Zajišťovací šroub kotouče');
  screw.position.set(PCD_R * Math.cos(SCREW_ANGLE), PCD_R * Math.sin(SCREW_ANGLE), sport ? 0.008 : 0.007);
  screw.userData.len = 0.02;

  let caliper;
  let pistons = [];
  let setPistonExt;
  let hang;
  let hookPose;

  if (!sport) {
    // ---------------- floating caliper ----------------
    const bracketMat = mats.bracket.clone();
    const dirty = new THREE.Color(0x3d3632);
    const clean = bracketMat.color.clone();
    const bracket = new THREE.Group();
    for (const sx of [-1, 1]) {
      const prof = [[-0.078, 0.062, 0.006], [-0.078, 0.182, 0.014], [0.006, 0.182, 0.014], [0.006, 0.1, 0.007], [-0.016, 0.1, 0.004], [-0.016, 0.16, 0.003], [-0.049, 0.16, 0.003], [-0.049, 0.062, 0.004]];
      bracket.add(M(extrudeZY(prof, sx > 0 ? 0.061 : -0.083, sx > 0 ? 0.083 : -0.061, { bevel: 0.0035, segs: 3 }), bracketMat));
    }
    bracket.add(M(box(-0.083, 0.083, 0.062, 0.088, -0.08, -0.056, 0.008), bracketMat));
    // guide pins travel with the caliper, so they sit further out on worn pads
    const pinZ = -0.09 - wear;
    const pinList = [];
    for (const sx of [-1, 1]) {
      const pin = new THREE.Group();
      pin.add(M(cylZ(0.0055, 0, 0.058, 16), mats.stainless));
      const hex = new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 6);
      hex.rotateX(Math.PI / 2);
      hex.translate(0, 0, 0.002);
      pin.add(M(hex, mats.zinc));
      const film = new THREE.Group();
      film.visible = false;
      film.add(greaseMesh(cylZ(0.0062, 0.008, 0.056, 16), silicone));
      pin.add(film);
      pin.position.set(sx * 0.072, 0.171, pinZ);
      pinList.push(pin);
      bracket.add(pin);
      greases[sx < 0 ? 'pin1' : 'pin2'] = film;
      bracket.add(M(at(cylZ(0.0098, pinZ + 0.004, -0.078, 16), sx * 0.072, 0.171, 0), mats.rubber));
    }
    recenter(bracket, new THREE.Vector3(0, 0.12, -0.036));
    reg('bracket', bracket, cal, 'Držák třmenu');
    bracket.userData.outPath = [[0, 0.075, 0]];
    // the origin sits in the pad gap over the disc, so the marker goes on the bridge
    bracket.userData.markerAt = new THREE.Vector3(0, -0.045, -0.032);
    bracket.userData.clean = (k) => bracketMat.color.lerpColors(dirty, clean, k);
    bracket.userData.clean(preview ? 1 : 0);
    pinList.forEach((p, i) => {
      p.userData.homePos = p.position.clone();
      p.name = `pin${i + 1}`;
      p.userData.part = p.name;
      p.userData.label = 'Vodicí čep třmenu';
      parts[p.name] = p;
    });

    for (const [i, sx] of [-1, 1].entries()) {
      const b = reg(`bracketBolt${i + 1}`, buildBolt(mats, { af: 0.018, headH: 0.008, r: 0.006, len: 0.04 }), cal, 'Šroub držáku třmenu');
      b.position.set(sx * 0.062, 0.075, -0.1);
      b.rotation.y = Math.PI;
    }

    // stainless abutment clips
    const clipMat = mats.stainless.clone();
    if (worn) {
      clipMat.color.set(0x8f8a80);
      clipMat.roughness = 0.5;
    }
    for (const [i, sx] of [-1, 1].entries()) {
      const clip = new THREE.Group();
      const clipGrease = new THREE.Group();
      clipGrease.visible = false;
      const x0 = sx > 0 ? 0.0583 : -0.0608;
      const x1 = sx > 0 ? 0.0608 : -0.0583;
      clip.add(M(box(x0, x1, 0.1, 0.157, -0.064, -0.049), clipMat));
      clip.add(M(box(x0, x1, 0.1, 0.157, -0.016, 0.0), clipMat));
      clip.add(M(box(x0, x1, 0.157, 0.1585, -0.064, 0.0), clipMat));
      for (const [z0, z1] of [[-0.063, -0.05], [-0.015, -0.001]]) {
        clipGrease.add(greaseMesh(box(sx > 0 ? 0.0577 : -0.0583, sx > 0 ? 0.0583 : -0.0577, 0.118, 0.152, z0, z1), paste));
      }
      clip.add(clipGrease);
      recenter(clip, new THREE.Vector3(sx * 0.0595, 0.1285, -0.032));
      reg(`clip${i + 1}`, clip, cal, 'Vodicí plech destiček');
      clip.userData.outPath = [[-sx * 0.004, 0, 0], [0, 0.075, 0]];
      greases[`clip${i + 1}`] = clipGrease;
    }

    const padOuter = reg('padOuter', buildPad(S, mats, { inner: false, tf, sport, greaseMat: paste }), cal, 'Vnější brzdová destička');
    padOuter.userData.outPath = [[0, 0, 0.012], [0, 0.085, 0]];
    const padInner = reg('padInner', buildPad(S, mats, { inner: true, tf, sport, greaseMat: paste }), cal, 'Vnitřní brzdová destička');
    padInner.userData.outPath = [[0, 0, -0.004], [0, 0.085, 0]];
    greases.padOuter = padOuter.userData.grease;
    greases.padInner = padInner.userData.grease;

    // caliper body
    caliper = new THREE.Group();
    const cm = mats.caliperStd;
    const soft = { bevel: 0.005, segs: 4, curveSegments: 12 };
    // piston housing: cylinder with a domed back and a cast web up to the bridge
    caliper.add(M(at(cylZ(0.036, -0.118, -0.064, 40), 0, 0.125, 0), cm));
    const back = new THREE.SphereGeometry(0.036, 40, 12, 0, TAU, 0, Math.PI / 2);
    back.scale(1, 0.32, 1);
    back.rotateX(-Math.PI / 2);
    caliper.add(M(at(back, 0, 0.125, -0.118), cm));
    caliper.add(
      M(extrudeXY(filletShape([[-0.032, 0.112, 0.01], [0.032, 0.112, 0.01], [0.047, 0.162, 0.012], [0.047, 0.186, 0.006], [-0.047, 0.186, 0.006], [-0.047, 0.162, 0.012]]), -0.114, -0.064, soft), cm),
    );
    // bridge follows the curvature of the disc, with two cast ribs on top
    caliper.add(M(extrudeXY(filletShape([...arcPts(0.188, -0.26, 0.26, 10, 0.005), ...arcPts(0.161, 0.3, -0.3, 10, 0.005)]), -0.114, 0.016, soft), cm));
    for (const sx of [-1, 1]) caliper.add(M(box(sx * 0.022 - 0.004, sx * 0.022 + 0.004, 0.18, 0.1915, -0.106, 0.008, 0.003), cm));
    // outer fingers with rounded tips
    caliper.add(
      M(
        extrudeXY(
          filletShape([[-0.048, 0.112, 0.012], [-0.017, 0.1, 0.008], [-0.013, 0.15, 0.012], [0.013, 0.15, 0.012], [0.017, 0.1, 0.008], [0.048, 0.112, 0.012], ...arcPts(0.188, 0.26, -0.26, 10, 0.006)]),
          -0.002,
          0.016,
          soft,
        ),
        cm,
      ),
    );
    for (const sx of [-1, 1]) {
      const lug = filletShape([[sx * 0.04, 0.16], [sx * 0.074, 0.16, 0.006], [sx * 0.086, 0.171, 0.008], [sx * 0.074, 0.182, 0.006], [sx * 0.04, 0.182]]);
      caliper.add(M(extrudeXY(lug, -0.102, -0.09, { bevel: 0.002, segs: 3 }), cm));
    }
    caliper.add(M(at(cylY(0.004, 0.184, 0.198, 10), 0.022, 0, -0.1), mats.zinc));
    caliper.add(M(at(cylY(0.0052, 0.195, 0.205, 10), 0.022, 0, -0.1), mats.rubber));
    const banjo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.009, 6);
    banjo.rotateX(Math.PI / 2);
    caliper.add(M(at(banjo, -0.018, 0.15, -0.1285), mats.zinc));
    caliper.add(M(at(new THREE.TorusGeometry(0.031, 0.004, 10, 32), 0, 0.125, -0.064), mats.rubber));
    const logo = M(new THREE.PlaneGeometry(0.08, 0.0234), mats.logoDark);
    logo.position.set(0, 0.17, 0.0166);
    logo.castShadow = false;
    caliper.add(logo);
    const piston = new THREE.Group();
    piston.add(M(cylZ(0.027, -0.03, 0, 32), mats.stainless));
    const cup = M(new THREE.CircleGeometry(0.021, 32), mats.blackSteel);
    cup.position.z = 0.0003;
    cup.castShadow = false;
    piston.add(cup);
    piston.position.set(0, 0.125, -0.064);
    caliper.add(piston);
    pistons = [piston];
    const anchor = new THREE.Object3D();
    anchor.position.set(-0.018, 0.15, -0.135);
    caliper.add(anchor);
    caliper.userData.hoseAnchor = anchor;
    caliper.userData.pistonAnchor = piston;
    recenter(caliper, new THREE.Vector3(0, 0.14, -0.05));
    caliper.position.z -= wear;
    reg('caliper', caliper, cal, 'Plovoucí brzdový třmen');
    caliper.userData.outPath = [[0, 0.08, 0]];
    const pistonBase = piston.position.z;
    setPistonExt = (ext) => {
      piston.position.z = pistonBase + ext;
    };

    for (const [i, sx] of [-1, 1].entries()) {
      const b = reg(`guideBolt${i + 1}`, buildBolt(mats, { af: 0.013, headH: 0.006, r: 0.004, len: 0.022 }), cal, 'Vodicí šroub třmenu');
      b.position.set(sx * 0.072, 0.171, -0.102 - wear);
      b.rotation.y = Math.PI;
    }

    // hangs with its open side towards the mechanic, so the piston can be reached
    hang = { pos: new THREE.Vector3(0.115, 0.265, -0.02), quat: basisQuat([-0.15, 0.35, -0.92], [-1, 0.15, 0.1]) };
    hookPose = { pos: new THREE.Vector3(0.075, 0.325, -0.075), euler: new THREE.Euler(0.5, 0.5, 0.25) };
    caliper.userData.pistonAxis = new THREE.Vector3(0, 0, 1);
  } else {
    // ---------------- fixed 4-piston monobloc ----------------
    caliper = new THREE.Group();
    const cm = mats.caliperRed;
    const A = 0.593;
    const A2 = 0.445;
    const LUG_X = 0.124;
    const soft = { bevel: 0.009, segs: 5, curveSegments: 12 };
    // Annular sector with rounded corners. The fillets take their full radius
    // out of the arcs (not just out of the first arc segment), otherwise the
    // corners end up tighter than the bevel and the extrusion tears there.
    const band = (r0, r1, p0, p1, fo, fi, n = 24) => {
      const P = (r, phi) => [r * Math.sin(phi), r * Math.cos(phi)];
      const s = new THREE.Shape();
      const corner = (c, to) => s.quadraticCurveTo(...c, ...to);
      const ao = fo / r1;
      const ai = fi / r0;
      s.moveTo(...P(r1 - fo, p0));
      corner(P(r1, p0), P(r1, p0 + ao));
      for (const q of arcPts(r1, p0 + ao, p1 - ao, n).slice(1)) s.lineTo(...q);
      corner(P(r1, p1), P(r1 - fo, p1));
      s.lineTo(...P(r0 + fi, p1));
      corner(P(r0, p1), P(r0, p1 - ai));
      for (const q of arcPts(r0, p1 - ai, p0 + ai, n).slice(1)) s.lineTo(...q);
      corner(P(r0, p0), P(r0 + fi, p0));
      s.closePath();
      return s;
    };
    // two halves with soft cast edges, plus the raised panel that carries the logo
    caliper.add(M(extrudeXY(band(0.11, 0.205, -A, A, 0.018, 0.022), 0, 0.046, soft), cm));
    caliper.add(M(extrudeXY(band(0.11, 0.205, -A, A, 0.018, 0.022), -0.118, -0.072, soft), cm));
    caliper.add(M(extrudeXY(band(0.126, 0.186, -0.44, 0.44, 0.014, 0.014), 0.038, 0.052, { bevel: 0.005, segs: 4, curveSegments: 12 }), cm));
    for (const [p0, p1] of [[A2, A], [-A, -A2]]) {
      caliper.add(M(extrudeXY(band(0.112, 0.203, p0, p1, 0.006, 0.006, 6), -0.0195, 0.006, { bevel: 0.003, segs: 3 }), cm));
      caliper.add(M(extrudeXY(band(0.112, 0.203, p0, p1, 0.006, 0.006, 6), -0.078, -0.0525, { bevel: 0.003, segs: 3 }), cm));
      caliper.add(M(extrudeXY(band(0.181, 0.204, p0, p1, 0.005, 0.005, 6), -0.078, 0.006, { bevel: 0.003, segs: 3 }), cm));
    }
    // piston bore caps on the inner half
    for (const sx of [-1, 1]) {
      const cap = new THREE.SphereGeometry(0.026, 32, 10, 0, TAU, 0, Math.PI / 2);
      cap.scale(1, 0.3, 1);
      cap.rotateX(-Math.PI / 2);
      caliper.add(M(at(cap, sx * 0.0306, 0.1437, -0.1175), cm));
    }
    for (const sx of [-1, 1]) {
      // radial mounting lugs, far enough out that the bolt heads clear the body
      caliper.add(M(at(cylY(0.017, 0.098, 0.128, 28), sx * LUG_X, 0, -0.098), cm));
      caliper.add(M(box(Math.min(sx * 0.064, sx * (LUG_X - 0.002)), Math.max(sx * 0.064, sx * (LUG_X - 0.002)), 0.1, 0.126, -0.113, -0.084, 0.005), cm));
      // bleed nipples on the outer half
      const bl = new THREE.Group();
      bl.add(M(cylY(0.004, 0, 0.012, 10), mats.zinc));
      bl.add(M(cylY(0.0052, 0.009, 0.018, 10), mats.rubber));
      const phi = sx * 0.5;
      bl.position.set(0.203 * Math.sin(phi), 0.203 * Math.cos(phi), 0.03);
      bl.rotation.z = -phi;
      caliper.add(bl);
    }
    // external crossover pipe linking the two halves
    {
      const er = new THREE.Vector3(Math.sin(A), Math.cos(A), 0);
      const et = new THREE.Vector3(Math.cos(A), -Math.sin(A), 0);
      const base = er.clone().multiplyScalar(0.148);
      const pt = (t, z) => base.clone().addScaledVector(et, t).setZ(z);
      const pipe = new THREE.CatmullRomCurve3([pt(-0.004, 0.022), pt(0.011, 0.02), pt(0.014, -0.036), pt(0.011, -0.092), pt(-0.004, -0.094)]);
      caliper.add(M(new THREE.TubeGeometry(pipe, 32, 0.0024, 8), mats.zinc));
      for (const z of [0.022, -0.094]) caliper.add(M(at(new THREE.SphereGeometry(0.0048, 10, 8), ...pt(0.001, z).toArray()), mats.zinc));
    }
    const logo = M(new THREE.PlaneGeometry(0.15, 0.044), mats.logoWhite);
    logo.position.set(0, 0.152, 0.0524);
    logo.castShadow = false;
    caliper.add(logo);
    const banjo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.009, 6);
    banjo.rotateX(Math.PI / 2);
    caliper.add(M(at(banjo, 0, 0.14, -0.1225), mats.zinc));
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 0.14, -0.13);
    caliper.add(anchor);
    caliper.userData.hoseAnchor = anchor;

    const pistonBases = [];
    for (const side of [1, -1]) {
      for (const sx of [-1, 1]) {
        const p = new THREE.Group();
        const body = side > 0 ? cylZ(0.019, 0, 0.03, 28) : cylZ(0.019, -0.03, 0, 28);
        p.add(M(body, mats.stainless));
        const cup = M(new THREE.CircleGeometry(0.014, 24), mats.blackSteel);
        cup.position.z = side > 0 ? -0.0003 : 0.0003;
        cup.rotation.y = side > 0 ? Math.PI : 0;
        cup.castShadow = false;
        p.add(cup);
        p.position.set(sx * 0.0306, 0.1437, side > 0 ? 0 : -0.072);
        p.userData.dir = -side;
        caliper.add(p);
        pistons.push(p);
      }
    }
    const pistonAnchor = new THREE.Object3D();
    pistonAnchor.position.set(0, 0.172, -0.036); // top of the pad slot, the spreader goes in from above
    caliper.add(pistonAnchor);
    caliper.userData.pistonAnchor = pistonAnchor;
    recenter(caliper, new THREE.Vector3(0, 0.158, -0.036));
    reg('caliper', caliper, cal, 'Pevný čtyřpístkový třmen Brembo');
    caliper.userData.outPath = [[0, 0.09, 0]];
    pistons.forEach((p) => pistonBases.push(p.position.z));
    setPistonExt = (ext) => {
      pistons.forEach((p, i) => {
        p.position.z = pistonBases[i] + p.userData.dir * ext;
      });
    };

    for (const [i, sx] of [-1, 1].entries()) {
      const b = reg(`caliperBolt${i + 1}`, buildBolt(mats, { af: 0.017, headH: 0.012, r: 0.006, len: 0.05, socket: true, flange: false }), cal, 'Radiální šroub třmenu');
      b.position.set(sx * LUG_X, 0.128, -0.098);
      b.rotation.x = -Math.PI / 2;
    }

    const padOuter = reg('padOuter', buildPad(S, mats, { inner: false, tf, sport, greaseMat: paste }), cal, 'Vnější brzdová destička');
    const padInner = reg('padInner', buildPad(S, mats, { inner: true, tf, sport, greaseMat: paste }), cal, 'Vnitřní brzdová destička');
    padOuter.userData.outPath = [[0, 0.12, 0]];
    padInner.userData.outPath = [[0, 0.12, 0]];
    greases.padOuter = padOuter.userData.grease;
    greases.padInner = padInner.userData.grease;

    // anti-rattle cross spring
    const spring = new THREE.Group();
    spring.add(M(box(-0.012, 0.012, 0.1798, 0.1812, -0.07, -0.002), mats.stainless));
    spring.add(M(box(-0.056, 0.056, 0.1798, 0.1812, -0.048, -0.024), mats.stainless));
    for (const sx of [-1, 1]) spring.add(M(box(sx * 0.056 - 0.004, sx * 0.056 + 0.004, 0.1765, 0.1812, -0.048, -0.024, 0.001), mats.stainless));
    recenter(spring, new THREE.Vector3(0, 0.1805, -0.036));
    reg('padSpring', spring, cal, 'Přítlačná pružina destiček');
    spring.userData.outPath = [[0, 0.08, 0]];

    // pad retaining pins (head on the outer side)
    for (const [i, sx] of [-1, 1].entries()) {
      const pin = new THREE.Group();
      pin.add(M(cylZ(0.0035, -0.158, 0, 12), mats.stainless));
      pin.add(M(cylZ(0.0058, 0, 0.004, 16), mats.stainless));
      reg(`retPin${i + 1}`, pin, cal, 'Zajišťovací čep destiček');
      pin.position.set(sx * 0.04, 0.1885, 0.046);
      pin.userData.len = 0.158;
    }

    // hangs mouth-down with the logo facing the mechanic
    hang = { pos: new THREE.Vector3(0.2, 0.255, 0.03), quat: basisQuat([0.22, 0.96, -0.12], [0.3, 0.1, 0.95]) };
    hookPose = { pos: new THREE.Vector3(0.1, 0.33, -0.06), euler: new THREE.Euler(0.5, 0.6, 0.5) };
    caliper.userData.pistonAxis = new THREE.Vector3(0, 1, 0);
  }

  // S-hook that carries the caliper while it is off the knuckle
  const hookCurve = new THREE.CatmullRomCurve3(
    [[0.012, 0.05, 0], [0, 0.064, 0], [-0.012, 0.05, 0], [0, 0.0, 0], [0.012, -0.05, 0], [0, -0.064, 0], [-0.012, -0.05, 0]].map((p) => new THREE.Vector3(...p)),
  );
  const hook = M(new THREE.TubeGeometry(hookCurve, 40, 0.0028, 8), mats.chrome);
  hook.userData.label = 'Hák na zavěšení třmenu';
  hook.position.copy(hookPose.pos);
  hook.rotation.copy(hookPose.euler);
  hook.visible = false;
  sus.hubFrame.add(hook);

  return {
    spec: S,
    parts,
    greases,
    caliper,
    hook,
    hang,
    wear,
    pistonMin: sport ? 0.003 : 0.002,
    pistonWorn: sport ? 0.003 + 0.008 : 0.002 + 0.016,
    setPistonExt,
    pasteMat: paste,
    siliconeMat: silicone,
  };
}
