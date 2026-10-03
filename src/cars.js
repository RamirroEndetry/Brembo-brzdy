import * as THREE from 'three';
import { M, box, TAU } from './geo.js';
import { buildBody, curve, endTaper, smoothstep, poly, line, sample, text, rings, plate } from './carbody.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mirror = (pts) => pts.map((p) => [-p[0], p[1]]);
const GLASS = '#06080b';
const SEAM = 'rgba(0,0,0,0.6)';

// Coordinates: x runs front to rear with the front axle at 0, y is the height
// above the front wheel centre at ride height, w is the distance from the
// centre line of the car.

// ------------------------------------------------------------------ Audi A3 (8V) Sportback
function a3Spec(logo) {
  const x0 = -0.88;
  const x1 = 3.433;
  const WB = 2.637;
  const AR = 0.37;
  const top = curve([
    [-0.88, 0.33], [-0.855, 0.4], [-0.8, 0.44], [-0.6, 0.5], [-0.3, 0.55], [0, 0.585], [0.42, 0.655, true], [0.78, 0.9], [1.1, 1.06], [1.3, 1.095],
    [1.7, 1.11], [2.3, 1.09], [2.8, 1.04], [2.98, 1.0], [3.2, 0.86], [3.32, 0.76], [3.4, 0.66], [3.433, 0.56],
  ]);
  const base = curve([[-0.88, -0.02], [-0.86, -0.1], [-0.78, -0.135], [-0.5, -0.15], [0.4, -0.165], [2.2, -0.165], [3.0, -0.14], [3.3, -0.1], [3.41, -0.04], [3.433, 0.06]]);
  const crown = curve([[-0.88, 0.02], [-0.6, 0.045], [0.42, 0.05], [1.1, 0.04], [2.9, 0.04], [3.3, 0.03], [3.433, 0.02]]);
  const belt = curve([[0.3, 0.6], [0.62, 0.635], [1.6, 0.67], [2.6, 0.7], [3.1, 0.73], [3.3, 0.74]]);
  const edgeW = curve([[-0.88, 0.7], [-0.4, 0.75], [0.2, 0.76], [0.5, 0.74], [1.12, 0.6], [1.7, 0.59], [2.7, 0.575], [2.98, 0.57], [3.3, 0.66], [3.433, 0.7]]);
  const cornerN = curve([[-0.88, 3.2], [0.42, 3.4], [1.1, 2.6], [2.9, 2.6], [3.3, 3]]);
  const width = curve([[-0.88, 0.84], [-0.3, 0.868], [0, 0.874], [1.3, 0.888], [2.64, 0.878], [3.433, 0.85]]);
  const plan = (x) => width(x) * endTaper(x, x0, x1, { a: 0.36, m: 3.4 }, { a: 0.3, m: 3.2 });
  const yE = (x) => top(x) - crown(x);
  const crease = (x) => Math.min(belt(x), yE(x) - 0.03) - 0.09;

  const side = (x, y, lv) => {
    const W = plan(x);
    const k = Math.min(1, W / 0.5);
    let w = W;
    const t = clamp((y - base(x)) / 0.17, 0, 1);
    w -= 0.05 * (1 - t) * (1 - t) * k; // tuck under the sill
    if (y > lv.yCrease) {
      // the sharp shoulder line, then a lean towards the windows
      const u = (y - lv.yCrease) / Math.max(0.01, lv.yBelt - lv.yCrease);
      w -= (0.009 * smoothstep(0, 0.014, y - lv.yCrease) + 0.028 * u * u) * k;
    }
    for (const cx of [0, WB]) {
      const d = Math.hypot(x - cx, y);
      if (d >= AR) w += 0.007 * (1 - smoothstep(0, 0.045, d - AR)); // rolled arch lip
    }
    return Math.max(0, w);
  };

  const paint = {
    base: '#5b626a',
    side(g) {
      const b = (x) => belt(x) + 0.014;
      const roofLine = (x) => yE(x) - 0.042;
      const upper = (x) => Math.min(roofLine(x), yE(x - 0.085) - 0.03, b(x) + (2.99 - x) * 1.15);
      // bumpers' dark lower valance
      poly(g, [[-0.9, -0.3], [-0.42, -0.3], [-0.42, -0.085], [-0.9, -0.06]], '#15171a');
      poly(g, [[3.05, -0.3], [3.5, -0.3], [3.5, -0.03], [3.05, -0.075]], '#15171a');
      // side windows
      poly(g, [...sample(b, 0.66, 2.99, 30), ...sample(upper, 0.66, 2.99, 60).reverse()], GLASS, '#1c1f23', 0.016);
      const grad = g.createLinearGradient(0.7, 0.6, 2.6, 1.1);
      grad.addColorStop(0, 'rgba(120,140,160,0)');
      grad.addColorStop(0.5, 'rgba(120,140,160,0.16)');
      grad.addColorStop(1, 'rgba(120,140,160,0)');
      poly(g, [...sample(b, 0.7, 2.9, 30), ...sample((x) => upper(x) - 0.012, 0.7, 2.9, 60).reverse()], grad);
      for (const [xa, xb] of [[1.6, 1.665], [2.45, 2.5]]) poly(g, [[xa, b(xa) - 0.004], [xb, b(xb) - 0.004], [xb, roofLine(xb) + 0.01], [xa, roofLine(xa) + 0.01]], '#0e1013');
      poly(g, [[0.66, b(0.66) - 0.004], [0.8, b(0.8) - 0.004], [0.7, b(0.7) + 0.06]], '#0e1013'); // mirror base
      // panel gaps
      line(g, [[0.6, b(0.6) - 0.016], [0.545, 0.3], [0.52, -0.105]], SEAM, 0.006);
      line(g, [[1.632, b(1.632) - 0.016], [1.632, -0.105]], SEAM, 0.006);
      const arc = [];
      for (let i = 0; i <= 14; i++) {
        const a = 1.95 + (i / 14) * 1.05;
        arc.push([WB + (AR + 0.055) * Math.cos(a), (AR + 0.055) * Math.sin(a)]);
      }
      line(g, [[2.5, b(2.5) - 0.016], [2.5, 0.5], ...arc, [2.2, -0.105]], SEAM, 0.006);
      line(g, [[0.52, -0.105], [2.2, -0.105]], SEAM, 0.006);
      line(g, [[-0.455, 0.1], [-0.475, 0.25], [-0.5, 0.375]], SEAM, 0.006);
      line(g, sample((x) => yE(x) - 0.013, -0.72, 0.43, 30), SEAM, 0.006);
      line(g, [[3.05, 0.46], [3.07, 0.2], [3.0, 0.02]], SEAM, 0.006);
      // door handles on the shoulder line
      for (const hx of [1.4, 2.3]) {
        const hy = crease(hx) - 0.02;
        g.beginPath();
        g.roundRect(hx, hy - 0.016, 0.17, 0.032, 0.012);
        g.fillStyle = '#4a5057';
        g.fill();
        g.strokeStyle = SEAM;
        g.lineWidth = 0.004;
        g.stroke();
      }
      // headlight and tail light wrapping round the corners
      poly(g, [[-0.72, 0.447], [-0.5, 0.43], [-0.56, 0.388], [-0.72, 0.358]], '#cbd4dc', '#14161a', 0.008);
      poly(g, [[-0.72, 0.432], [-0.56, 0.42], [-0.6, 0.396], [-0.72, 0.376]], '#2a2f35');
      line(g, [[-0.72, 0.438], [-0.53, 0.426]], '#ffffff', 0.006);
      poly(g, [[3.31, 0.615], [3.04, 0.6], [3.1, 0.525], [3.31, 0.485]], '#7c0a11', '#14161a', 0.008);
      line(g, [[3.31, 0.57], [3.09, 0.565]], '#d8222c', 0.012);
    },
    top(g) {
      // windscreen, rear window, cowl
      poly(g, [[0.4, -0.73], [0.47, -0.73], [0.47, 0.73], [0.4, 0.73]], '#111316');
      poly(g, [[0.47, -0.69], [1.085, -0.55], [1.085, 0.55], [0.47, 0.69]], GLASS, '#101214', 0.03);
      poly(g, [[3.0, -0.53], [3.29, -0.6], [3.29, 0.6], [3.0, 0.53]], GLASS, '#101214', 0.03);
      const grad = g.createLinearGradient(0.5, -0.6, 1.05, 0.5);
      grad.addColorStop(0, 'rgba(130,150,170,0)');
      grad.addColorStop(0.5, 'rgba(130,150,170,0.18)');
      grad.addColorStop(1, 'rgba(130,150,170,0)');
      poly(g, [[0.5, -0.66], [1.06, -0.53], [1.06, 0.53], [0.5, 0.66]], grad);
      line(g, [[0.5, -0.45], [0.56, 0.05]], '#1d2024', 0.012);
      line(g, [[0.5, 0.1], [0.56, 0.6]], '#1d2024', 0.012);
      for (const s of [-1, 1]) {
        line(g, [[-0.74, s * 0.6], [-0.3, s * 0.7], [0.4, s * 0.715]], SEAM, 0.006); // bonnet shut line
        line(g, [[-0.76, s * 0.3], [0.4, s * 0.46]], 'rgba(0,0,0,0.16)', 0.02); // bonnet crease
        line(g, [[1.13, s * 0.575], [2.95, s * 0.555]], SEAM, 0.012); // roof channel
      }
      line(g, [[-0.755, -0.6], [-0.775, 0], [-0.755, 0.6]], SEAM, 0.006);
    },
    front(g) {
      poly(g, [[-0.95, -0.3], [0.95, -0.3], [0.95, -0.075], [-0.95, -0.075]], '#15171a');
      const lamp = [[0.37, 0.432], [0.8, 0.447], [0.875, 0.41], [0.82, 0.358], [0.43, 0.352]];
      const inner = [[0.42, 0.42], [0.78, 0.432], [0.8, 0.39], [0.46, 0.368]];
      for (const m of [false, true]) {
        poly(g, m ? mirror(lamp) : lamp, '#cbd4dc', '#14161a', 0.008);
        poly(g, m ? mirror(inner) : inner, '#2a2f35');
        line(g, m ? mirror([[0.4, 0.426], [0.82, 0.44]]) : [[0.4, 0.426], [0.82, 0.44]], '#ffffff', 0.007);
        const intake = [[0.44, 0.1], [0.8, 0.115], [0.78, 0.0], [0.47, -0.02]];
        poly(g, m ? mirror(intake) : intake, '#0c0d0f', '#14161a', 0.006);
      }
      // single-frame grille
      const grille = [[-0.3, 0.342], [0.3, 0.342], [0.348, 0.25], [0.275, 0.02], [-0.275, 0.02], [-0.348, 0.25]];
      poly(g, grille, '#0b0c0e');
      g.save();
      g.beginPath();
      grille.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.clip();
      for (let y = 0.04; y < 0.34; y += 0.028) line(g, [[-0.36, y], [0.36, y]], '#24272c', 0.007);
      g.restore();
      poly(g, grille, null, '#aab0b6', 0.013);
      plate(g, logo, 0, 0.122, 0.52, 0.11);
      rings(g, 0, 0.262, 0.033, '#d5dade', 0.009);
    },
    rear(g) {
      poly(g, [[-0.95, -0.3], [0.95, -0.3], [0.95, -0.03], [-0.95, -0.03]], '#15171a');
      for (const m of [false, true]) {
        const lamp = [[0.4, 0.61], [0.87, 0.615], [0.88, 0.49], [0.5, 0.515]];
        poly(g, m ? mirror(lamp) : lamp, '#7c0a11', '#14161a', 0.008);
        line(g, m ? mirror([[0.45, 0.57], [0.86, 0.57]]) : [[0.45, 0.57], [0.86, 0.57]], '#d8222c', 0.014);
      }
      plate(g, logo, 0, 0.355, 0.52, 0.11, true);
      rings(g, 0, 0.56, 0.03, '#d5dade', 0.008);
    },
  };

  return {
    name: 'Audi A3 (8V)', x0, x1, WB, AR, arches: [0, WB], top, crown, base, belt, edgeW, cornerN, side, creaseDrop: 0.09,
    frontZone: 0.16, rearZone: 0.125, yMin: -0.3, yMax: 1.2, wMax: 0.95, paint, yE,
  };
}

// ------------------------------------------------------------------ Audi Sport quattro S1 E2 (Group B)
function s1Spec(logo) {
  const x0 = -1.0;
  const x1 = 3.2;
  const WB = 2.224;
  const AR = 0.375;
  const top = curve([[-1.0, 0.4], [-0.985, 0.47, true], [-0.5, 0.52], [0, 0.55], [0.36, 0.585, true], [0.9, 0.985, true], [1.3, 1.03], [1.72, 1.02, true], [2.72, 0.72, true], [3.15, 0.7, true], [3.2, 0.62]]);
  const base = curve([[-1.0, -0.18], [-0.5, -0.2], [0.4, -0.15], [1.85, -0.15], [2.7, -0.12], [3.15, -0.08], [3.2, 0.0]]);
  const crown = curve([[-1, 0.012], [0.36, 0.02], [0.9, 0.03], [1.72, 0.03], [2.72, 0.02], [3.2, 0.012]]);
  const belt = curve([[0.3, 0.57], [0.5, 0.585], [2.0, 0.6], [2.72, 0.61]]);
  const edgeW = curve([[-1, 0.78], [0.3, 0.78], [0.9, 0.57], [1.72, 0.56], [2.72, 0.7], [3.2, 0.74]]);
  const cornerN = curve([[-1, 7], [0.36, 6], [0.9, 4], [1.72, 4], [2.72, 6], [3.2, 7]]);
  const width = curve([[-1, 0.82], [1.2, 0.835], [3.2, 0.82]]);
  const plan = (x) => width(x) * endTaper(x, x0, x1, { a: 0.2, m: 7 }, { a: 0.18, m: 7 });
  const yE = (x) => top(x) - crown(x);

  const side = (x, y, lv) => {
    const W = plan(x);
    const k = Math.min(1, W / 0.5);
    let w = W;
    const t = clamp((y - base(x)) / 0.12, 0, 1);
    w -= 0.02 * (1 - t) * (1 - t) * k;
    if (y > lv.yCrease) w -= (0.004 * smoothstep(0, 0.012, y - lv.yCrease) + 0.02 * ((y - lv.yCrease) / Math.max(0.01, lv.yBelt - lv.yCrease))) * k;
    // boxy Group B arch extensions, running into the front and rear bumpers
    const fx = Math.max(x < 0 ? 1 : 1 - smoothstep(0.5, 0.57, x), x > WB ? 1 : smoothstep(WB - 0.57, WB - 0.5, x));
    w += 0.09 * fx * (1 - smoothstep(0.4, 0.455, y)) * k;
    return Math.max(0, w);
  };

  const stripe = (g, xa, wdt, color) => poly(g, [[xa, -0.3], [xa + wdt, -0.3], [xa + wdt + 0.62, 0.62], [xa + 0.62, 0.62]], color);
  const paint = {
    base: '#eeeeea',
    side(g) {
      const b = (x) => belt(x) + 0.014;
      const upper = (x) => Math.min(yE(x) - 0.04, yE(x - 0.075) - 0.02, b(x) + (2.07 - x) * 1.6);
      // Audi Sport stripes: along the sill, then sweeping up over the rear arch
      for (const [dy, c] of [[0, '#c20e1e'], [0.045, '#8d9094'], [0.09, '#1a1b1d']]) poly(g, [[0.5, -0.11 + dy], [1.62 + dy, -0.11 + dy], [1.62 + dy + 0.03, -0.075 + dy], [0.5, -0.075 + dy]], c);
      stripe(g, 1.6, 0.075, '#c20e1e');
      stripe(g, 1.7, 0.075, '#8d9094');
      stripe(g, 1.8, 0.075, '#1a1b1d');
      rings(g, 1.0, 0.3, 0.05, '#1a1b1d', 0.013);
      text(g, 'quattro', 1.0, 0.13, 0.11, '#1a1b1d', { italic: true, font: 'Arial, Helvetica, sans-serif', weight: '700' });
      text(g, 'Audi Sport', -0.02, 0.475, 0.05, '#c20e1e', { italic: true });
      // windows
      poly(g, [...sample(b, 0.52, 2.07, 30), ...sample(upper, 0.52, 2.07, 60).reverse()], GLASS, '#1c1f23', 0.02);
      poly(g, [[1.44, b(1.44) - 0.004], [1.5, b(1.5) - 0.004], [1.5, yE(1.5) - 0.03], [1.44, yE(1.44) - 0.03]], '#0e1013');
      const grad = g.createLinearGradient(0.6, 0.6, 1.9, 1.0);
      grad.addColorStop(0, 'rgba(120,140,160,0)');
      grad.addColorStop(0.5, 'rgba(120,140,160,0.16)');
      grad.addColorStop(1, 'rgba(120,140,160,0)');
      poly(g, [...sample(b, 0.58, 1.98, 30), ...sample((x) => upper(x) - 0.014, 0.58, 1.98, 60).reverse()], grad);
      // panel gaps
      line(g, [[0.5, b(0.5) - 0.016], [0.5, -0.12]], SEAM, 0.007);
      line(g, [[1.5, b(1.5) - 0.016], [1.5, -0.12]], SEAM, 0.007);
      line(g, sample((x) => yE(x) - 0.012, -0.95, 0.36, 20), SEAM, 0.007);
      g.beginPath();
      g.roundRect(1.3, 0.47, 0.14, 0.03, 0.006);
      g.fillStyle = '#1a1b1d';
      g.fill();
    },
    top(g) {
      poly(g, [[0.36, -0.74], [0.42, -0.74], [0.42, 0.74], [0.36, 0.74]], '#111316');
      poly(g, [[0.42, -0.7], [0.875, -0.53], [0.875, 0.53], [0.42, 0.7]], GLASS, '#101214', 0.03);
      poly(g, [[0.74, -0.57], [0.875, -0.53], [0.875, 0.53], [0.74, 0.57]], '#c20e1e');
      text(g, 'Audi Sport', 0.807, 0, 0.085, '#ffffff', { italic: true });
      poly(g, [[1.76, -0.52], [2.69, -0.66], [2.69, 0.66], [1.76, 0.52]], GLASS, '#101214', 0.03);
      for (const s of [-1, 1]) {
        line(g, [[-0.95, s * 0.71], [0.34, s * 0.74]], SEAM, 0.007);
        // bonnet louvres
        for (let x = -0.5; x < -0.14; x += 0.05) line(g, [[x, s * 0.2], [x, s * 0.48]], '#15171a', 0.022);
      }
      poly(g, [[-0.2, -0.16], [0.1, -0.16], [0.1, 0.16], [-0.2, 0.16]], '#15171a');
      poly(g, [[1.05, -0.12], [1.25, -0.12], [1.25, 0.12], [1.05, 0.12]], '#15171a'); // roof vent
      stripeTop(g);
    },
    front(g) {
      poly(g, [[-0.8, 0.165], [0.8, 0.165], [0.8, 0.355], [-0.8, 0.355]], '#0b0c0e');
      for (let y = 0.19; y < 0.35; y += 0.03) line(g, [[-0.3, y], [0.3, y]], '#24272c', 0.008);
      for (const s of [-1, 1]) {
        for (const [za, zb] of [[0.33, 0.55], [0.57, 0.79]]) poly(g, [[s * za, 0.19], [s * zb, 0.19], [s * zb, 0.335], [s * za, 0.335]], '#e6edf2', '#3a3f45', 0.012);
        poly(g, [[s * 0.82, 0.19], [s * 0.93, 0.19], [s * 0.93, 0.335], [s * 0.82, 0.335]], '#e88a1a', '#14161a', 0.008);
        // auxiliary rally lamps
        g.beginPath();
        g.arc(s * 0.2, 0.045, 0.082, 0, TAU);
        g.fillStyle = '#f3f0d2';
        g.fill();
        g.strokeStyle = '#17181a';
        g.lineWidth = 0.02;
        g.stroke();
        poly(g, [[s * 0.42, -0.14], [s * 0.82, -0.14], [s * 0.82, 0.02], [s * 0.42, 0.02]], '#0c0d0f');
      }
      rings(g, 0, 0.262, 0.036, '#d5dade', 0.01);
      poly(g, [[-0.95, 0.105], [0.95, 0.105], [0.95, 0.135], [-0.95, 0.135]], '#c20e1e');
      plate(g, logo, 0, -0.09, 0.5, 0.105);
    },
    rear(g) {
      poly(g, [[-0.84, 0.4], [0.84, 0.4], [0.84, 0.54], [-0.84, 0.54]], '#15171a');
      for (const s of [-1, 1]) poly(g, [[s * 0.42, 0.415], [s * 0.82, 0.415], [s * 0.82, 0.525], [s * 0.42, 0.525]], '#8a0b12');
      rings(g, 0, 0.47, 0.03, '#d5dade', 0.008);
      plate(g, logo, 0, 0.3, 0.52, 0.11, true);
    },
  };
  function stripeTop(g) {
    for (const [z, c] of [[-0.06, '#c20e1e'], [0, '#8d9094'], [0.06, '#1a1b1d']]) poly(g, [[1.3, z - 0.025], [1.7, z - 0.025], [1.7, z + 0.025], [1.3, z + 0.025]], c);
  }

  return {
    name: 'Audi Sport quattro S1 E2', x0, x1, WB, AR, arches: [0, WB], top, crown, base, belt, edgeW, cornerN, side, creaseDrop: 0.1,
    frontZone: 0.12, rearZone: 0.1, yMin: -0.3, yMax: 1.15, wMax: 1.0, paint, yE,
  };
}

const SPECS = { standard: a3Spec, sport: s1Spec };

// Builds the complete car in car coordinates (origin = front arch centre).
// `fenderZ` is where the outer face of the front wing ends up on the world z axis.
export function buildCar(variant, mats, buildWheel, droop, fenderZ = 0.088) {
  const spec = SPECS[variant](mats.brand.img);
  const sport = variant === 'sport';
  const lv0 = { yb: 0, yBelt: 0.5, yCrease: 0.45 };
  spec.zc = fenderZ - spec.side(0, spec.AR * 0.8, lv0);
  const { zc, WB, AR, x0, x1 } = spec;
  const car = new THREE.Group();
  car.userData.label = spec.name;
  car.userData.spec = spec;

  const paintMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: sport ? 0.1 : 0.55, roughness: sport ? 0.42 : 0.36, clearcoat: 1, clearcoatRoughness: 0.06 });
  car.add(buildBody(spec, paintMat));
  const solid = new THREE.MeshPhysicalMaterial({ color: spec.paint.base, metalness: paintMat.metalness, roughness: paintMat.roughness, clearcoat: 1, clearcoatRoughness: 0.06 });

  // wheel wells: liner, flange behind the arch lip, inner wall
  for (const cx of [0, WB]) {
    const r = AR + 0.05;
    const liner = new THREE.CylinderGeometry(r, r, 0.68, 56, 1, true, Math.PI / 2 - 0.45, Math.PI + 0.9);
    liner.rotateX(Math.PI / 2);
    liner.translate(cx, 0, fenderZ - 0.05 - 0.34);
    const lm = M(liner, mats.plastic);
    lm.userData.label = 'Podběh';
    car.add(lm);
    const flange = M(new THREE.RingGeometry(AR - 0.004, r, 56, 1, -0.45, Math.PI + 0.9), mats.plastic);
    flange.position.set(cx, 0, fenderZ - 0.05);
    car.add(flange);
    const wall = M(new THREE.CircleGeometry(r + 0.02, 40), mats.plastic);
    wall.position.set(cx, 0, fenderZ - 0.7);
    car.add(wall);
  }
  // underbody panels (the wheel wells stay open from below)
  const yF = spec.base(1.0) + 0.05;
  const wIn = spec.side(1.0, 0.2, lv0) - 0.32;
  const floor = (xa, xb, wa, wb) => car.add(M(box(xa, xb, yF, yF + 0.02, zc + wa, zc + wb), mats.plastic));
  floor(x0 + 0.3, x1 - 0.3, -wIn, wIn);
  for (const s of [-1, 1]) {
    floor(AR + 0.07, WB - AR - 0.07, Math.min(s * wIn, s * (wIn + 0.28)), Math.max(s * wIn, s * (wIn + 0.28)));
  }

  // door mirrors
  for (const s of [-1, 1]) {
    const mx = sport ? 0.6 : 0.74;
    const my = spec.belt(mx) + (sport ? 0.07 : 0.075);
    const mw = spec.side(mx, spec.belt(mx), { yb: -0.15, yBelt: spec.belt(mx), yCrease: spec.belt(mx) - 0.09 });
    let head;
    if (sport) head = M(box(-0.05, 0.05, -0.04, 0.04, -0.07, 0.07, 0.012), solid);
    else {
      const geo = new THREE.SphereGeometry(1, 24, 16);
      geo.scale(0.06, 0.042, 0.085);
      head = M(geo, solid);
    }
    head.position.set(mx, my, zc + s * (mw + 0.07));
    car.add(head);
    car.add(M(box(mx - 0.02, mx + 0.03, my - 0.045, my - 0.02, Math.min(zc + s * (mw - 0.03), zc + s * (mw + 0.05)), Math.max(zc + s * (mw - 0.03), zc + s * (mw + 0.05)), 0.008), mats.blackGloss));
  }

  if (sport) {
    // Group B aero: front splitter with corner winglets, big rear wing, roof scoop
    const wOut = spec.side(0, 0.2, lv0) + 0.004;
    car.add(M(box(x0 - 0.04, -0.55, -0.205, -0.19, zc - wOut, zc + wOut, 0.004), solid));
    for (const s of [-1, 1]) {
      car.add(M(box(x0 - 0.03, -0.7, -0.2, 0.1, zc + s * wOut - 0.006, zc + s * wOut + 0.006, 0.004), solid));
      car.add(M(box(2.72, 3.3, 0.66, 1.03, zc + s * 0.8 - 0.01, zc + s * 0.8 + 0.01, 0.006), solid));
    }
    const wing = M(box(-0.2, 0.2, -0.014, 0.014, -0.8, 0.8, 0.012), solid);
    wing.position.set(3.08, 0.985, zc);
    wing.rotation.z = -0.16;
    car.add(wing);
    const wing2 = M(box(-0.16, 0.16, -0.012, 0.012, -0.8, 0.8, 0.01), solid);
    wing2.position.set(3.02, 0.8, zc);
    wing2.rotation.z = -0.1;
    car.add(wing2);
    car.add(M(box(1.02, 1.3, 1.0, 1.065, zc - 0.13, zc + 0.13, 0.02), solid));
  } else {
    // shark-fin aerial
    car.add(M(box(2.72, 2.9, 1.035, 1.085, zc - 0.02, zc + 0.02, 0.018), solid));
  }

  // rear wheel hanging in its arch
  const rimMat = sport ? mats.rimWhite : mats.rimSilver;
  const rear = buildWheel(mats, rimMat);
  rear.userData.label = 'Zadní kolo';
  rear.position.set(WB, -droop, fenderZ - 0.143);
  car.add(rear);
  car.userData.rimMat = rimMat;
  return car;
}
