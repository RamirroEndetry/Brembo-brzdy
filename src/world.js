import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { M, box, cylY, cylZ, cylX, at, extrudeXY, polyShape, TAU } from './geo.js';
import { tween, Ease } from './tween.js';
import { buildCar } from './cars.js';

// World position of the front-left hub centre (car raised on the lift).
export const HUB = new THREE.Vector3(0, 1.0, 0);
const DROOP = 0.08; // the suspension hangs down, so the arch sits above the hub

const tag = (obj, label) => {
  obj.userData.label = label;
  return obj;
};

export function buildWheel(mats, rim = mats.rim) {
  const g = new THREE.Group();
  const hw = 0.1125;
  const lathe = (pts, mat, seg = 64) => {
    const geo = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
    geo.rotateX(Math.PI / 2);
    return M(geo, mat);
  };
  const tirePts = [
    [0.238, -hw + 0.012], [0.262, -hw - 0.001], [0.295, -hw + 0.002], [0.32, -hw + 0.022], [0.331, -hw + 0.05], [0.334, 0],
    [0.331, hw - 0.05], [0.32, hw - 0.022], [0.295, hw - 0.002], [0.262, hw + 0.001], [0.238, hw - 0.012],
  ];
  const tireMat = mats.tire.clone();
  tireMat.side = THREE.DoubleSide;
  g.add(lathe(tirePts, tireMat, 96));
  const rimMat = rim.clone();
  rimMat.side = THREE.DoubleSide;
  g.add(lathe([[0.24, -hw + 0.01], [0.226, -hw + 0.03], [0.214, -0.04], [0.214, 0.03], [0.228, hw - 0.03], [0.24, hw - 0.01]], rimMat));
  g.add(M(at(new THREE.TorusGeometry(0.238, 0.006, 10, 72), 0, 0, hw - 0.012), mats.rimLip));
  for (let k = 0; k < 5; k++) {
    for (const s of [-1, 1]) {
      const sp = M(extrudeXY(polyShape([[-0.013, 0.05], [0.013, 0.05], [0.008, 0.232], [-0.008, 0.232]]), hw - 0.07, hw - 0.045, { bevel: 0.004 }), rim);
      sp.rotation.z = (k * TAU) / 5 + s * 0.2;
      g.add(sp);
    }
  }
  g.add(M(cylZ(0.07, hw - 0.085, hw - 0.04, 40), rim));
  g.add(M(cylZ(0.03, hw - 0.04, hw - 0.034, 32), mats.blackGloss));
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + (k * TAU) / 5;
    const h = M(new THREE.CircleGeometry(0.009, 16), mats.hole);
    h.position.set(0.056 * Math.cos(a), 0.056 * Math.sin(a), hw - 0.0397);
    h.castShadow = false;
    g.add(h);
  }
  return g;
}

// Scissor lift under the sills, between the two axles (xa..xb).
function buildLift(mats, xa, xb) {
  const g = tag(new THREE.Group(), 'Nůžkový zvedák');
  const top = HUB.y + DROOP - 0.165 - 0.035;
  const mid = (xa + xb) / 2;
  for (const zc of [-0.2, -1.47]) {
    g.add(M(box(xa, xb, top - 0.07, top, zc - 0.21, zc + 0.21, 0.01), mats.liftBody));
    g.add(M(box(xa, xb, top - 0.02, top - 0.012, zc - 0.215, zc + 0.215), mats.liftAccent));
    g.add(M(box(xa - 0.05, xb + 0.05, 0, 0.07, zc - 0.24, zc + 0.24, 0.01), mats.liftBody));
    for (const x of [xa + 0.2, xb - 0.2]) g.add(M(box(x - 0.09, x + 0.09, top, top + 0.035, zc - 0.07, zc + 0.07, 0.008), mats.rubber));
    const span = xb - xa - 0.2;
    const rise = top - 0.07 - 0.07;
    const len = Math.hypot(span, rise);
    const ang = Math.atan2(rise, span);
    for (const [sgn, dz] of [[1, 0.13], [-1, -0.13]]) {
      const beam = M(new THREE.BoxGeometry(len, 0.075, 0.05), mats.liftBody);
      beam.position.set(mid, 0.07 + rise / 2, zc + dz);
      beam.rotation.z = sgn * ang;
      g.add(beam);
    }
    g.add(M(at(cylZ(0.022, zc - 0.17, zc + 0.17, 16), mid, 0.07 + rise / 2, 0), mats.steel));
  }
  return g;
}

function buildCart(mats) {
  const g = tag(new THREE.Group(), 'Dílenský vozík');
  const W = 0.96;
  const D = 0.5;
  const H = 0.86;
  g.add(M(box(-W / 2, W / 2, H - 0.045, H - 0.012, -D / 2, D / 2, 0.008), mats.cartRed));
  g.add(M(box(-W / 2 + 0.012, W / 2 - 0.012, H - 0.012, H, -D / 2 + 0.012, D / 2 - 0.012), mats.cartMat));
  g.add(M(box(-W / 2, W / 2, H - 0.36, H - 0.045, -D / 2 + 0.01, D / 2 - 0.01), mats.drawers));
  g.add(M(box(-W / 2, W / 2, 0.16, 0.19, -D / 2, D / 2, 0.006), mats.cartRed));
  for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) {
    for (const z of [-D / 2 + 0.02, D / 2 - 0.02]) {
      g.add(M(box(x - 0.016, x + 0.016, 0.1, H - 0.045, z - 0.016, z + 0.016), mats.blackSteel));
      g.add(M(at(cylZ(0.05, -0.014, 0.014, 20), x, 0.05, z), mats.rubber));
    }
  }
  // spare-part boxes on the lower shelf
  const partBox = (w, h, d) => {
    const b = M(new THREE.BoxGeometry(w, h, d), mats.boxRed);
    const lw = Math.min(w * 0.6, h * 2.6);
    const logo = M(new THREE.PlaneGeometry(lw, lw * 0.293), mats.logoWhite);
    logo.position.z = d / 2 + 0.0006;
    logo.castShadow = false;
    b.add(logo);
    return b;
  };
  const b1 = partBox(0.4, 0.09, 0.38);
  b1.position.set(-0.2, 0.235, 0);
  const b2 = partBox(0.3, 0.11, 0.2);
  b2.position.set(0.24, 0.245, 0.1);
  b2.rotation.y = -0.15;
  g.add(b1, b2);
  // small magnetic dish for bolts
  g.add(M(cylY(0.07, H, H + 0.006, 32), mats.blackGloss));
  g.children[g.children.length - 1].position.set(0.37, 0, 0.06);
  const top = new THREE.Object3D();
  top.position.y = H;
  g.add(top);
  g.userData.top = top;
  return g;
}

function buildGarage(mats) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 5), mats.wall);
  back.position.set(1, 2.5, -5.6);
  back.receiveShadow = true;
  g.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(22, 5), mats.wall);
  left.position.set(-7.5, 2.5, 0);
  left.rotation.y = Math.PI / 2;
  g.add(left);
  // red light strip + panel seams on the back wall
  g.add(M(box(-14, 16, 1.02, 1.06, -5.59, -5.57), mats.wallAccent));
  for (let x = -13; x < 16; x += 2) g.add(M(box(x - 0.01, x + 0.01, 0, 5, -5.595, -5.585), mats.blackGloss));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8125), mats.sign);
  sign.position.set(-3.1, 2.55, -5.56);
  g.add(sign);
  // tool chest under the sign
  const chest = tag(new THREE.Group(), 'Dílenská skříň s nářadím');
  chest.add(M(box(-1.0, 1.0, 0.1, 1.0, -0.3, 0.3), mats.drawers));
  chest.add(M(box(-1.02, 1.02, 1.0, 1.04, -0.32, 0.32, 0.01), mats.cartMat));
  chest.add(M(box(-1.0, 1.0, 0, 0.1, -0.28, 0.28), mats.blackSteel));
  chest.position.set(-3.1, 0, -5.2);
  g.add(chest);
  // ceiling light bars
  for (const [x, z] of [[-1.5, 1.6], [2.6, 1.6], [-1.5, -3.2], [2.6, -3.2]]) g.add(M(box(x - 1.3, x + 1.3, 3.9, 3.94, z - 0.09, z + 0.09), mats.lamp));
  g.traverse((o) => {
    if (o.isMesh && o.material === mats.lamp) o.castShadow = false;
  });
  return g;
}

export function createWorld(canvas, mats) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  scene.fog = new THREE.Fog(0x0b0d10, 9, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
  camera.position.set(-2.2, 1.6, 3.4);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HUB);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 0.42;
  controls.maxDistance = 2.4;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.8;
  controls.minAzimuthAngle = -1.35;
  controls.maxAzimuthAngle = 1.45;
  controls.rotateSpeed = 0.6;
  controls.enabled = false;

  // lights
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x15110d, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(-2.4, 4.6, 4.2);
  key.target.position.copy(HUB);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -3.2;
  sc.right = 4.4;
  sc.top = 3;
  sc.bottom = -3;
  sc.near = 0.5;
  sc.far = 14;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.012;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.5);
  fill.position.set(3.5, 2.0, 3.0);
  scene.add(fill);
  // inspection lamp inside the wheel arch
  const work = new THREE.SpotLight(0xfff3e2, 7.5, 4.5, 0.55, 0.75, 1.6);
  work.position.set(HUB.x - 0.5, HUB.y + 0.55, HUB.z + 1.05);
  work.target.position.set(HUB.x + 0.05, HUB.y + 0.04, HUB.z - 0.1);
  work.castShadow = true;
  work.shadow.mapSize.set(2048, 2048);
  work.shadow.camera.near = 0.3;
  work.shadow.camera.far = 3.5;
  work.shadow.bias = -0.0002;
  work.shadow.normalBias = 0.004;
  scene.add(work, work.target);
  const archGlow = new THREE.PointLight(0xfff1dc, 0.3, 1.6, 1.8);
  archGlow.position.set(HUB.x + 0.02, HUB.y + DROOP + 0.33, HUB.z + 0.06);
  scene.add(archGlow);
  const lampBar = M(box(-0.09, 0.09, -0.012, 0.012, -0.012, 0.012, 0.01), mats.lamp);
  lampBar.castShadow = false;
  lampBar.position.set(HUB.x + 0.02, HUB.y + DROOP + 0.365, HUB.z + 0.06);
  scene.add(lampBar);
  // headlamp that travels with the camera, like a mechanic's head torch
  const head = new THREE.PointLight(0xffffff, 0.5, 4, 1.6);
  camera.add(head);
  scene.add(camera);
  const accent = new THREE.PointLight(0xff2a1a, 0.5, 7, 2);
  accent.position.set(-3.0, 1.2, -4.6);
  scene.add(accent);

  scene.add(buildGarage(mats));
  const cart = buildCart(mats);
  cart.position.set(0.98, 0, 0.52);
  cart.rotation.y = -0.08;
  scene.add(cart);
  // one car + lift + loose front wheel per brake set; only the active one is shown
  const carSets = {};
  function setCar(variant) {
    if (!carSets[variant]) {
      const set = new THREE.Group();
      const car = buildCar(variant, mats, buildWheel, DROOP);
      car.position.set(0, HUB.y + DROOP, 0);
      set.add(car);
      set.add(buildLift(mats, 0.72, car.userData.spec.WB - 0.42));
      const wheel = tag(buildWheel(mats, car.userData.rimMat), 'Sundané přední kolo');
      wheel.rotation.x = -Math.PI / 2;
      wheel.position.set(-0.85, 0.1125, 1.05);
      set.add(wheel);
      scene.add(set);
      carSets[variant] = set;
    }
    for (const [k, set] of Object.entries(carSets)) set.visible = k === variant;
  }
  setCar('standard');
  scene.updateMatrixWorld(true);

  let insets = { left: 0, right: 0, top: 0, bottom: 0 };
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, -(insets.left - insets.right) / 2, (insets.bottom - insets.top) / 2, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  const sph = new THREE.Spherical();
  const off = new THREE.Vector3();
  let viewToken = 0;
  function viewTo({ az, el, dist, look }, dur = 1.2) {
    const token = ++viewToken;
    const t0 = controls.target.clone();
    const t1 = HUB.clone();
    if (look) t1.add(new THREE.Vector3(...look));
    off.copy(camera.position).sub(t0);
    sph.setFromVector3(off);
    const r0 = sph.radius;
    const th0 = sph.theta;
    const ph0 = sph.phi;
    const ph1 = Math.PI / 2 - el;
    return tween(
      dur,
      (k) => {
        if (token !== viewToken) return;
        controls.target.lerpVectors(t0, t1, k);
        sph.set(r0 + (dist - r0) * k, ph0 + (ph1 - ph0) * k, th0 + (az - th0) * k);
        camera.position.setFromSpherical(sph).add(controls.target);
        camera.lookAt(controls.target);
      },
      Ease.inOut,
    );
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    cartTop: cart.userData.top,
    setCar,
    resize,
    viewTo,
    setInsets(v) {
      insets = { ...insets, ...v };
      resize();
    },
    render() {
      if (controls.enabled) controls.update();
      renderer.render(scene, camera);
    },
  };
}
