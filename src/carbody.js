import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Smooth curve through [x, y] control points (sorted by x). A third element
// `true` marks a corner, where the slope is allowed to break.
export function curve(pts) {
  const n = pts.length;
  const sec = [];
  for (let i = 0; i < n - 1; i++) sec.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? sec[i - 1] : sec[0];
    const b = i < n - 1 ? sec[i] : sec[n - 2];
    if (pts[i][2] || i === 0 || i === n - 1) {
      left.push(a);
      right.push(b);
    } else {
      const m = a * b <= 0 ? 0 : (pts[i + 1][1] - pts[i - 1][1]) / (pts[i + 1][0] - pts[i - 1][0]);
      left.push(m);
      right.push(m);
    }
  }
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (x > pts[i + 1][0]) i++;
    const h = pts[i + 1][0] - pts[i][0];
    const t = (x - pts[i][0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * pts[i][1] + (t3 - 2 * t2 + t) * h * right[i] + (-2 * t3 + 3 * t2) * pts[i + 1][1] + (t3 - t2) * h * left[i + 1];
  };
}

// Plan-view taper that closes the body at nose (x0) and tail (x1).
export function endTaper(x, x0, x1, front, rear) {
  let k = 1;
  if (x < x0 + front.a) {
    const u = 1 - (x - x0) / front.a;
    k = Math.pow(Math.max(0, 1 - Math.pow(u, front.m)), 1 / front.m);
  }
  if (x > x1 - rear.a) {
    const u = 1 - (x1 - x) / rear.a;
    k *= Math.pow(Math.max(0, 1 - Math.pow(u, rear.m)), 1 / rear.m);
  }
  return k;
}

const ROWS = { A1: 9, A2: 6, B: 8, C: 13 };

/*
 * Lofts a car body from analytic profiles. For every station x the half section
 * runs from the bottom edge (sill or wheel-arch edge) up the side, across the
 * glasshouse and over the roof to the centre line.
 *
 * spec: { x0, x1, arches: [x...], AR, top(x), crown(x), base(x), belt(x),
 *         edgeW(x), cornerN(x), side(x, y), frontZone, rearZone, paint{...} }
 */
export function buildBody(spec, material) {
  const { x0, x1, AR } = spec;
  // ---- stations
  const xs = [];
  for (let x = x0; x <= x1 + 1e-9; x += 0.025) xs.push(x);
  const fine = [0, 0.0015, 0.005, 0.011, 0.02, 0.032, 0.046, 0.062, 0.08, 0.1, 0.125, 0.15, 0.18];
  for (const d of fine) xs.push(x0 + d, x1 - d);
  for (const cx of spec.arches) {
    for (let i = 0; i <= 44; i++) xs.push(cx + AR * Math.cos((i / 44) * Math.PI));
    xs.push(cx - AR - 2e-4, cx + AR + 2e-4);
  }
  xs.sort((a, b) => a - b);
  const cols = xs.filter((x, i) => x >= x0 - 1e-9 && x <= x1 + 1e-9 && (i === 0 || x - xs[i - 1] > 5e-5));
  cols[0] = x0;
  cols[cols.length - 1] = x1;

  const bottom = (x) => {
    let y = spec.base(x);
    for (const cx of spec.arches) {
      const d = Math.abs(x - cx);
      if (d <= AR) y = Math.max(y, Math.sqrt(AR * AR - d * d));
    }
    return y;
  };

  // ---- section points: [y, w] per row
  const nRows = 1 + ROWS.A1 + ROWS.A2 + ROWS.B + ROWS.C + 1;
  const jTop = 1 + ROWS.A1 + ROWS.A2 + ROWS.B; // first row of the roof/bonnet region
  const P = [];
  for (const x of cols) {
    const row = [];
    const yb = bottom(x);
    const yTop = Math.max(spec.top(x), yb + 0.05);
    const yEdge = Math.max(yTop - spec.crown(x), yb + 0.035);
    const yBelt = clamp(Math.min(spec.belt(x), yEdge - 0.03), yb + 0.02, yEdge - 0.005);
    const yCrease = clamp(yBelt - spec.creaseDrop, yb + 0.01, yBelt - 0.005);
    const lv = { yb, yBelt, yCrease };
    const wBelt = spec.side(x, yBelt, lv);
    const wEdge = Math.min(spec.edgeW(x), Math.max(0, wBelt - 0.012 * Math.min(1, wBelt / 0.3)));
    row.push([yb, Math.max(0, spec.side(x, yb, lv) - 0.035)]); // return flange
    for (let j = 0; j < ROWS.A1; j++) {
      const y = yb + ((yCrease - yb) * j) / ROWS.A1;
      row.push([y, spec.side(x, y, lv)]);
    }
    for (let j = 0; j < ROWS.A2; j++) {
      const y = yCrease + ((yBelt - yCrease) * j) / ROWS.A2;
      row.push([y, spec.side(x, y, lv)]);
    }
    for (let j = 0; j < ROWS.B; j++) {
      const t = j / ROWS.B;
      // slight outward bulge of the side glass
      row.push([yBelt + (yEdge - yBelt) * t, wBelt + (wEdge - wBelt) * t + 0.012 * Math.sin(t * Math.PI) * Math.min(1, wBelt)]);
    }
    const n = spec.cornerN(x);
    for (let j = 0; j <= ROWS.C; j++) {
      const th = (j / ROWS.C) * (Math.PI / 2);
      row.push([yEdge + (yTop - yEdge) * Math.pow(Math.sin(th), 2 / n), wEdge * Math.pow(Math.cos(th), 2 / n)]);
    }
    P.push(row);
  }

  const nc = cols.length;
  const zc = spec.zc;
  const pos = (i, j, sign, out) => out.set(cols[i], P[i][j][0], zc + sign * P[i][j][1]);
  // ---- normals from grid differences (left half), mirrored for the right half
  const N = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < nc; i++) {
    const rowN = [];
    for (let j = 0; j < nRows; j++) {
      pos(Math.min(nc - 1, i + 1), j, 1, a);
      pos(Math.max(0, i - 1), j, 1, b);
      pos(i, Math.min(nRows - 1, j + 1), 1, c);
      pos(i, Math.max(0, j - 1), 1, d);
      const n = new THREE.Vector3().crossVectors(a.sub(b), c.sub(d));
      if (n.lengthSq() < 1e-14) n.set(i < nc / 2 ? -1 : 1, 0, 0);
      rowN.push(n.normalize());
    }
    N.push(rowN);
  }
  // make sure the normals point away from the centre line
  let flip = 0;
  for (let i = 0; i < nc; i += 7) flip += N[i][5].z;
  if (flip < 0) for (const r of N) for (const n of r) n.negate();

  // ---- texture projections
  const L = x1 - x0;
  const H = spec.yMax - spec.yMin;
  const WW = spec.wMax;
  const proj = {
    side: (p) => [(p.x - x0) / L, (p.y - spec.yMin) / H],
    top: (p) => [(p.x - x0) / L, (p.z - zc + WW) / (2 * WW)],
    front: (p) => [(p.z - zc + WW) / (2 * WW), (p.y - spec.yMin) / H],
    rear: (p) => [(WW - (p.z - zc)) / (2 * WW), (p.y - spec.yMin) / H],
  };
  const zoneOf = (i, j) => {
    const xm = (cols[i] + cols[i + 1]) / 2;
    if (xm < x0 + spec.frontZone) return 'front';
    if (xm > x1 - spec.rearZone) return 'rear';
    return j >= jTop ? 'top' : 'side';
  };

  const group = new THREE.Group();
  const v = new THREE.Vector3();
  for (const zone of ['side', 'top', 'front', 'rear']) {
    const position = [];
    const normal = [];
    const uv = [];
    const index = [];
    for (const sign of [1, -1]) {
      const off = position.length / 3;
      for (let i = 0; i < nc; i++) {
        for (let j = 0; j < nRows; j++) {
          pos(i, j, sign, v);
          position.push(v.x, v.y, v.z);
          const n = N[i][j];
          normal.push(n.x, n.y, sign * n.z);
          const t = proj[zone](v);
          uv.push(t[0], t[1]);
        }
      }
      for (let i = 0; i < nc - 1; i++) {
        for (let j = 0; j < nRows - 1; j++) {
          if (zoneOf(i, j) !== zone) continue;
          const p00 = off + i * nRows + j;
          const p10 = p00 + nRows;
          const p01 = p00 + 1;
          const p11 = p10 + 1;
          if (sign > 0) index.push(p00, p10, p11, p00, p11, p01);
          else index.push(p00, p11, p10, p00, p01, p11);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    // pick the winding that agrees with the outward normals
    let agree = 0;
    const nRef = new THREE.Vector3();
    for (let k = 0; k < index.length; k += 3) {
      a.fromArray(position, index[k] * 3);
      b.fromArray(position, index[k + 1] * 3).sub(a);
      c.fromArray(position, index[k + 2] * 3).sub(a);
      agree += d.crossVectors(b, c).dot(nRef.fromArray(normal, index[k] * 3));
    }
    if (agree < 0) {
      for (let k = 0; k < index.length; k += 3) {
        const t = index[k + 1];
        index[k + 1] = index[k + 2];
        index[k + 2] = t;
      }
      geo.setIndex(index);
    }
    const mat = material.clone();
    mat.map = paintTexture(spec, zone);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

// Canvas whose drawing units are metres in the projection plane of `zone`.
function paintTexture(spec, zone) {
  const L = spec.x1 - spec.x0;
  const H = spec.yMax - spec.yMin;
  const W2 = spec.wMax * 2;
  const size = { side: [4096, Math.round((4096 * H) / L)], top: [2048, Math.round((2048 * W2) / L)], front: [1536, Math.round((1536 * H) / W2)], rear: [1024, Math.round((1024 * H) / W2)] }[zone];
  const cv = document.createElement('canvas');
  cv.width = size[0];
  cv.height = size[1];
  const g = cv.getContext('2d');
  g.fillStyle = spec.paint.base;
  g.fillRect(0, 0, cv.width, cv.height);
  const sx = cv.width / (zone === 'side' || zone === 'top' ? L : W2);
  const sy = cv.height / (zone === 'top' ? W2 : H);
  if (zone === 'side') g.setTransform(sx, 0, 0, -sy, -spec.x0 * sx, spec.yMax * sy);
  else if (zone === 'top') g.setTransform(sx, 0, 0, -sy, -spec.x0 * sx, spec.wMax * sy);
  else if (zone === 'front') g.setTransform(sx, 0, 0, -sy, spec.wMax * sx, spec.yMax * sy);
  else g.setTransform(-sx, 0, 0, -sy, spec.wMax * sx, spec.yMax * sy);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  spec.paint[zone](g);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---- small drawing helpers working in metres (y up) ----
export function poly(g, pts, fill, stroke, lw) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}
export function line(g, pts, stroke, lw) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.strokeStyle = stroke;
  g.lineWidth = lw;
  g.stroke();
}
export function sample(f, a, b, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    out.push([x, f(x)]);
  }
  return out;
}
// Text drawn upright even though the canvas y axis points up.
export function text(g, str, x, y, h, color, { font = 'Arial Black, Arial, sans-serif', weight = '900', italic = false, align = 'center', skew = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.transform(1, 0, skew, 1, 0, 0);
  g.scale(h / 100, -h / 100);
  g.font = `${italic ? 'italic ' : ''}${weight} 100px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(str, 0, 0);
  g.restore();
}
// Number plate carrying the brand logo (falls back to a wordmark without an image).
// `flipX` is for the rear texture, whose x axis runs right to left.
export function plate(g, img, cx, cy, w, h, flipX = false) {
  g.beginPath();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.12);
  g.fillStyle = '#f4f4f0';
  g.fill();
  g.strokeStyle = '#101010';
  g.lineWidth = h * 0.05;
  g.stroke();
  if (!img) {
    text(g, 'brembo', cx, cy, h * 0.62, '#c8101c', { italic: true });
    return;
  }
  const ratio = (img.naturalWidth || 4.3) / (img.naturalHeight || 1);
  const lw = Math.min(w * 0.86, h * 0.74 * ratio);
  g.save();
  g.translate(cx, cy);
  g.scale(flipX ? -1 : 1, -1);
  g.drawImage(img, -lw / 2, -lw / ratio / 2, lw, lw / ratio);
  g.restore();
}

export function rings(g, cx, cy, r, color, lw) {
  g.strokeStyle = color;
  g.lineWidth = lw;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(cx + (i - 1.5) * r * 1.45, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
}
