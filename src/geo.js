import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;

export function M(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

// Cylinder along Z; radius r at z0, r2 at z1.
export function cylZ(r, z0, z1, seg = 32, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

export function cylY(r, y0, y1, seg = 32, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, y1 - y0, seg);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

export function cylX(r, x0, x1, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

export function box(x0, x1, y0, y1, z0, z1, rad = 0) {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const g =
    rad > 0
      ? new RoundedBoxGeometry(w, h, d, 3, Math.min(rad, w / 2, h / 2, d / 2) * 0.999)
      : new THREE.BoxGeometry(w, h, d);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export function at(geo, x = 0, y = 0, z = 0) {
  geo.translate(x, y, z);
  return geo;
}

// Extrudes a shape lying in XY between z0 and z1. The bevel stays inside the
// drawn contour, so the outline keeps its designed size.
export function extrudeXY(shape, z0, z1, { bevel = 0, segs = 2, curveSegments = 24, smooth = true } = {}) {
  const depth = z1 - z0 - 2 * bevel;
  let g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: segs,
    curveSegments,
    steps: 1,
  });
  g.translate(0, 0, z0 + bevel);
  if (smooth) {
    g = crease(g, 0.75);
    // keep the two flat end caps flat: smoothing them against the bevel shades
    // large faces with a visible gradient
    const caps = g.groups[0];
    const n = g.attributes.normal;
    for (let i = caps.start; i < caps.start + caps.count; i++) n.setXYZ(i, 0, 0, n.getZ(i) >= 0 ? 1 : -1);
  }
  return g;
}

// toCreasedNormals welds vertices on a 0.01-unit grid, far too coarse for parts
// modelled in metres, so the weld runs on a temporarily upscaled copy.
export function crease(g, angle = 0.75) {
  g.scale(1000, 1000, 1000);
  g = toCreasedNormals(g, angle);
  g.scale(0.001, 0.001, 0.001);
  return g;
}

// Extrudes a profile given as [z, y] points along X between x0 and x1.
export function extrudeZY(pts, x0, x1, opts) {
  const g = extrudeXY(filletShape(pts), 0, x1 - x0, opts);
  g.rotateY(-Math.PI / 2);
  g.translate(x1, 0, 0);
  return g;
}

export function polyShape(pts) {
  return new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
}

// Closed outline through [x, y, r] points; a point with r gets its corner rounded.
export function filletShape(pts) {
  const s = new THREE.Shape();
  const n = pts.length;
  const cut = (p, q, r) => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(r, len / 2) / len;
    return [p[0] + dx * k, p[1] + dy * k];
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (!p[2]) {
      if (i === 0) s.moveTo(p[0], p[1]);
      else s.lineTo(p[0], p[1]);
      continue;
    }
    const a = cut(p, pts[(i + n - 1) % n], p[2]);
    const b = cut(p, pts[(i + 1) % n], p[2]);
    if (i === 0) s.moveTo(a[0], a[1]);
    else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}

// Points along an arc centred on the origin (phi measured from +Y towards +X).
// The two end points can carry a fillet radius for filletShape.
export function arcPts(r, phi0, phi1, n, endFillet = 0) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const phi = phi0 + ((phi1 - phi0) * i) / n;
    const p = [r * Math.sin(phi), r * Math.cos(phi)];
    if (endFillet && (i === 0 || i === n)) p.push(endFillet);
    out.push(p);
  }
  return out;
}

// Annular sector centred on the +Y axis; phi is measured from +Y towards +X.
export function sectorShape(r1, r2, phi0, phi1) {
  const s = new THREE.Shape();
  const t0 = Math.PI / 2 - phi0;
  const t1 = Math.PI / 2 - phi1;
  s.absarc(0, 0, r2, t0, t1, true);
  s.absarc(0, 0, r1, t1, t0, false);
  s.closePath();
  return s;
}

export function ringShape(rIn, rOut) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, TAU, false);
  const h = new THREE.Path();
  h.absarc(0, 0, rIn, 0, TAU, true);
  s.holes.push(h);
  return s;
}

export function circleHole(x, y, r) {
  const h = new THREE.Path();
  h.absarc(x, y, r, 0, TAU, true);
  return h;
}

// Moves the group's origin to `c` while its children stay where they are.
export function recenter(group, c) {
  for (const ch of group.children) ch.position.sub(c);
  group.position.copy(c);
  return group;
}

export class Helix extends THREE.Curve {
  constructor(r, h, turns) {
    super();
    this.r = r;
    this.h = h;
    this.turns = turns;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * TAU;
    return target.set(this.r * Math.cos(a), this.h * t, this.r * Math.sin(a));
  }
}

// Stretches a unit-length (along Y) mesh between two points in its parent's space.
const _d = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
export function linkRod(mesh, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(_up, _d.normalize());
}

// Bounding box of `obj` (in its own frame) after applying orientation `quat`.
export function orientedBox(obj, quat) {
  obj.updateWorldMatrix(true, true);
  const inv = obj.matrixWorld.clone().invert();
  const rot = new THREE.Matrix4().makeRotationFromQuaternion(quat);
  const out = new THREE.Box3();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  obj.traverse((ch) => {
    if (!ch.isMesh || ch.userData.noBounds) return;
    if (!ch.geometry.boundingBox) ch.geometry.computeBoundingBox();
    const bb = ch.geometry.boundingBox;
    m.copy(rot).multiply(inv).multiply(ch.matrixWorld);
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
      out.expandByPoint(v.applyMatrix4(m));
    }
  });
  return out;
}
