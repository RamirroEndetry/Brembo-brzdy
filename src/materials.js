import * as THREE from 'three';

const TAU = Math.PI * 2;

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function tex(cv, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 8;
  return t;
}

// ---- brand ---------------------------------------------------------------
// The client's official logo can be dropped into public/brand/ (SVG or PNG with
// a transparent background). Without it a plain wordmark is rendered instead.
export async function loadBrand() {
  for (const file of ['brand/brembo-logo.svg', 'brand/brembo-logo.png']) {
    try {
      const r = await fetch(file);
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) continue;
      const url = URL.createObjectURL(await r.blob());
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      return { img, url };
    } catch {
      /* fall through to the text wordmark */
    }
  }
  return { img: null, url: null };
}

export function logoCanvas(brand, { fg = '#ffffff', bg = null, w = 1024, h = 300, pad = 0.02 } = {}) {
  return canvas(w, h, (c) => {
    if (bg) {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
    }
    if (brand.img) {
      const iw = brand.img.naturalWidth || 640;
      const ih = brand.img.naturalHeight || 200;
      const s = Math.min((w * (1 - 2 * pad)) / iw, (h * (1 - 2 * pad)) / ih);
      const tinted = canvas(w, h, (t) => {
        t.drawImage(brand.img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
        if (fg) {
          t.globalCompositeOperation = 'source-in';
          t.fillStyle = fg;
          t.fillRect(0, 0, w, h);
        }
      });
      c.drawImage(tinted, 0, 0);
      return;
    }
    c.fillStyle = fg || '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let size = h * 0.8;
    const font = (px) => `italic 900 ${px}px "Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, sans-serif`;
    c.font = font(size);
    const max = w * (1 - 2 * pad);
    const tw = c.measureText('brembo').width;
    if (tw > max) c.font = font((size *= max / tw));
    c.fillText('brembo', w / 2, h * 0.5);
  });
}

export function logoTexture(brand, opts) {
  return tex(logoCanvas(brand, opts));
}

// ---- procedural textures -------------------------------------------------
function noiseCanvas(size, seed, lo, hi, cell = 1) {
  const r = rng(seed);
  const n = Math.ceil(size / cell);
  const small = canvas(n, n, (c) => {
    const img = c.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = lo + (hi - lo) * r();
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  if (cell === 1) return small;
  return canvas(size, size, (c) => {
    c.imageSmoothingEnabled = true;
    c.drawImage(small, 0, 0, size, size);
  });
}

// Concentric machining marks for the disc friction faces.
function radialCanvas(size, seed, base, spread) {
  const r = rng(seed);
  return canvas(size, size, (c) => {
    c.fillStyle = `rgb(${base},${base},${base})`;
    c.fillRect(0, 0, size, size);
    const cx = size / 2;
    for (let rad = 2; rad < cx; rad += 1.6) {
      const v = Math.max(0, Math.min(255, base + (r() - 0.5) * spread));
      c.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      c.lineWidth = 1 + r() * 2.5;
      c.beginPath();
      c.arc(cx, cx, rad, 0, TAU);
      c.stroke();
    }
  });
}

function rustCanvas(size, seed) {
  const r = rng(seed);
  return canvas(size, size, (c) => {
    c.fillStyle = '#3d2618';
    c.fillRect(0, 0, size, size);
    const cols = ['#5a3219', '#6a3c1e', '#2c1a11', '#75441f', '#4a2b18', '#1f1410'];
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = cols[(r() * cols.length) | 0];
      c.globalAlpha = 0.25 + r() * 0.5;
      const s = 1 + r() * 5;
      c.beginPath();
      c.arc(r() * size, r() * size, s, 0, TAU);
      c.fill();
    }
  });
}

function floorCanvas(size) {
  const r = rng(77);
  return canvas(size, size, (c) => {
    c.fillStyle = '#24272c';
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      const v = 30 + r() * 26;
      c.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.25 + r() * 0.35})`;
      const s = 1 + r() * 3;
      c.fillRect(r() * size, r() * size, s, s);
    }
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.lineWidth = 3;
    c.strokeRect(0, 0, size, size);
  });
}

function tireCanvas() {
  // v runs across the tyre profile (sidewall - tread - sidewall), u around.
  return canvas(256, 512, (c, w, h) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#000';
    for (const v of [0.4, 0.47, 0.53, 0.6]) c.fillRect(0, v * h - 4, w, 8);
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w;
      c.save();
      c.translate(x, 0.34 * h);
      c.rotate(0.5);
      c.fillRect(0, 0, 5, 30);
      c.restore();
      c.save();
      c.translate(x + 10, 0.62 * h);
      c.rotate(-0.5);
      c.fillRect(0, 0, 5, 30);
      c.restore();
    }
  });
}

function drawerCanvas() {
  return canvas(512, 512, (c, w, h) => {
    c.fillStyle = '#b3121a';
    c.fillRect(0, 0, w, h);
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const y = (i / rows) * h;
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(0, y, w, 5);
      c.fillStyle = '#d9dce0';
      c.fillRect(40, y + 22, w - 80, 12);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(40, y + 34, w - 80, 4);
    }
  });
}

export function createMaterials(brand) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);

  const fineNoise = tex(noiseCanvas(256, 11, 90, 165), { srgb: false, repeat: [3, 3] });
  const coarseNoise = tex(noiseCanvas(256, 23, 70, 190, 4), { srgb: false, repeat: [2, 2] });
  const radial = tex(radialCanvas(1024, 5, 170, 70), { srgb: false });
  // Extruded caps carry raw x/y as UVs; map +-0.2 m onto the texture.
  radial.repeat.set(2.5, 2.5);
  radial.offset.set(0.5, 0.5);
  const radialWorn = tex(radialCanvas(1024, 9, 150, 150), { srgb: false });
  radialWorn.repeat.copy(radial.repeat);
  radialWorn.offset.copy(radial.offset);
  const rust = tex(rustCanvas(256, 3), { repeat: [14, 14] });
  const floor = tex(floorCanvas(512), { repeat: [14, 14] });
  const tire = tex(tireCanvas(), { srgb: false, repeat: [28, 1] });

  const logoWhite = logoTexture(brand, { fg: '#ffffff' });
  const logoDark = logoTexture(brand, { fg: '#15171a' });
  const logoSign = logoTexture(brand, { fg: '#ffffff', bg: '#d2091a', w: 1024, h: 320, pad: 0.14 });

  const decal = (map, extra = {}) =>
    std({
      map,
      transparent: true,
      depthWrite: false,
      roughness: 0.45,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      ...extra,
    });

  return {
    brand,
    textures: { radial, rust, logoWhite, logoDark, logoSign },

    // suspension / chassis
    castIron: std({ color: 0x4a4d52, metalness: 0.75, roughness: 0.62, bumpMap: fineNoise, bumpScale: 0.6 }),
    castDark: std({ color: 0x2b2d31, metalness: 0.6, roughness: 0.7, bumpMap: fineNoise, bumpScale: 0.6 }),
    blackSteel: std({ color: 0x17191c, metalness: 0.55, roughness: 0.5 }),
    blackGloss: std({ color: 0x101113, metalness: 0.4, roughness: 0.25 }),
    steel: std({ color: 0xc4c8cd, metalness: 1, roughness: 0.3 }),
    chrome: std({ color: 0xf2f4f6, metalness: 1, roughness: 0.08 }),
    zinc: std({ color: 0xcfc9ae, metalness: 1, roughness: 0.38 }),
    stainless: std({ color: 0xdfe3e6, metalness: 1, roughness: 0.22 }),
    rubber: std({ color: 0x0d0d0e, metalness: 0, roughness: 0.85 }),
    plastic: std({ color: 0x1a1b1e, metalness: 0, roughness: 0.92, side: THREE.DoubleSide }),
    hole: std({ color: 0x050505, metalness: 0, roughness: 1 }),
    spring: std({ color: 0x16181b, metalness: 0.5, roughness: 0.32 }),
    springSport: std({ color: 0xc8a11a, metalness: 0.5, roughness: 0.35 }),
    rust: std({ map: rust, color: 0x9a8f88, metalness: 0.3, roughness: 0.92, bumpMap: fineNoise, bumpScale: 1.2 }),

    // brake parts
    discFace: std({ color: 0xd4d8dc, metalness: 1, roughness: 0.42, roughnessMap: radial, bumpMap: radial, bumpScale: 0.12 }),
    discFaceWorn: std({ color: 0x8d8983, metalness: 0.95, roughness: 0.66, roughnessMap: radialWorn, bumpMap: radialWorn, bumpScale: 0.35 }),
    discEdge: std({ color: 0x55585d, metalness: 0.8, roughness: 0.6, bumpMap: fineNoise, bumpScale: 0.5 }),
    discHat: std({ color: 0x8c9096, metalness: 0.85, roughness: 0.45 }),
    discBell: std({ color: 0x1b1c20, metalness: 0.9, roughness: 0.36, side: THREE.DoubleSide }),
    bobbin: std({ color: 0xd8b25a, metalness: 1, roughness: 0.3 }),
    caliperStd: std({ color: 0x9a9da1, metalness: 0.85, roughness: 0.5, bumpMap: fineNoise, bumpScale: 0.5 }),
    caliperRed: phys({ color: 0xa80109, metalness: 0.3, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 }),
    bracket: std({ color: 0x5b5f65, metalness: 0.8, roughness: 0.58, bumpMap: fineNoise, bumpScale: 0.6 }),
    padBack: std({ color: 0x1c1e21, metalness: 0.6, roughness: 0.5 }),
    padFriction: std({ color: 0x33302c, metalness: 0.15, roughness: 0.95, bumpMap: fineNoise, bumpScale: 1.0 }),
    shim: std({ color: 0x0f1012, metalness: 0.7, roughness: 0.35 }),
    hose: std({ color: 0x0b0b0c, metalness: 0.1, roughness: 0.6 }),
    greasePaste: std({ color: 0x8e402a, metalness: 0.15, roughness: 0.4, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 }),
    greaseSilicone: std({ color: 0x9fd8f4, metalness: 0, roughness: 0.12, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 }),
    logoWhite: decal(logoWhite),
    logoDark: decal(logoDark, { opacity: 0.85 }),

    // car + workshop
    paint: phys({ color: 0x3f454d, metalness: 0.7, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05 }),
    glass: phys({ color: 0x07090c, metalness: 0.2, roughness: 0.05, clearcoat: 1 }),
    lamp: std({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 2.2, roughness: 0.3 }),
    headlight: phys({ color: 0xdfe6ee, metalness: 0.9, roughness: 0.08, clearcoat: 1 }),
    tire: std({ color: 0x121213, metalness: 0, roughness: 0.82, bumpMap: tire, bumpScale: 2.5 }),
    rim: std({ color: 0x2d3035, metalness: 0.95, roughness: 0.28 }),
    rimSilver: std({ color: 0xb9bdc2, metalness: 0.95, roughness: 0.3 }),
    rimWhite: std({ color: 0xf0f0ec, metalness: 0.1, roughness: 0.45 }),
    rimLip: std({ color: 0xc9ccd0, metalness: 1, roughness: 0.18 }),
    floor: std({ map: floor, color: 0xffffff, metalness: 0.1, roughness: 0.42 }),
    wall: std({ color: 0x1d2025, metalness: 0.1, roughness: 0.85 }),
    wallAccent: std({ color: 0xc70a17, metalness: 0.2, roughness: 0.5, emissive: 0xc70a17, emissiveIntensity: 0.35 }),
    liftBody: std({ color: 0x23272d, metalness: 0.6, roughness: 0.45 }),
    liftAccent: std({ color: 0xc70a17, metalness: 0.4, roughness: 0.45 }),
    cartRed: std({ color: 0xb50d16, metalness: 0.45, roughness: 0.4 }),
    cartMat: std({ color: 0x18191b, metalness: 0, roughness: 0.9, bumpMap: coarseNoise, bumpScale: 0.4 }),
    drawers: std({ map: tex(drawerCanvas()), metalness: 0.45, roughness: 0.42 }),
    boxRed: std({ color: 0xc8101c, metalness: 0, roughness: 0.7 }),
    sign: std({ map: logoSign, emissive: 0xffffff, emissiveMap: logoSign, emissiveIntensity: 0.9, roughness: 0.4 }),
    signBox: std({ map: logoSign, roughness: 0.65 }),

    // tools
    toolChrome: std({ color: 0xe6e9ec, metalness: 1, roughness: 0.16 }),
    toolDark: std({ color: 0x1a1b1e, metalness: 0.7, roughness: 0.4 }),
    toolGrip: std({ color: 0xc70a17, metalness: 0, roughness: 0.6 }),
    toolGripDark: std({ color: 0x111214, metalness: 0, roughness: 0.75 }),
    toolWood: std({ color: 0x9a6a3a, metalness: 0, roughness: 0.6 }),
    toolBrass: std({ color: 0xb8964a, metalness: 1, roughness: 0.35 }),
    toolWhite: std({ color: 0xeef0f2, metalness: 0, roughness: 0.45 }),
    toolBlue: std({ color: 0x1766b5, metalness: 0, roughness: 0.45 }),
  };
}
