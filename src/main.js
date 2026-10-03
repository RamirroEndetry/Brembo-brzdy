import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './style.css';

import * as THREE from 'three';
import { loadBrand, createMaterials } from './materials.js';
import { createWorld, HUB } from './world.js';
import { createTools } from './tools3d.js';
import { createRig } from './rig.js';
import { tween, tickTweens, wait, cancelAllTweens, Ease } from './tween.js';
import { audio } from './audio.js';
import { ICONS } from './icons.js';
import { TOOLS, VARIANTS, MODES, getProcedure, wrongToolMessage, LESSONS, LUBE_PLAN } from './procedures.js';

const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const canvas = $('scene');

const state = {
  phase: 'loading', // loading | menu | game | finish
  variant: 'standard',
  mode: 'demontaz',
  stepIndex: 0,
  tool: null,
  busy: false,
  remaining: new Set(),
  score: 0,
  mistakes: 0,
  stepMistakes: 0,
  hints: true,
  startTime: 0,
  session: 0, // bumped whenever a run is abandoned, so stale async flows stop
};

let world;
let mats;
let tools;
let rig;
let proc = [];

// ------------------------------------------------------------------ rig
function setRig(mode) {
  if (rig) rig.destroy();
  world.setCar(state.variant);
  rig = createRig({ world, mats, variant: state.variant, mode });
}

function steerTo(angle, dur = 0.9) {
  const from = rig.sus.steerAngle;
  if (Math.abs(from - angle) < 1e-4) return Promise.resolve();
  const r = rig;
  return tween(dur, (k) => r.sus.setSteer(from + (angle - from) * k), Ease.inOut);
}

// ------------------------------------------------------------------ step actions
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sumPath = (path) => path.reduce((acc, s) => acc.add(v3(s)), new THREE.Vector3());

const ACT = {
  async unbolt(step, name) {
    const p = rig.parts[name];
    const len = p.userData.len * 0.9;
    let last = 0;
    await tools.use(state.tool, {
      obj: p,
      motion: state.tool === 'screwdriver' ? 'spin' : 'ratchet',
      dur: 1.25,
      progress: (k) => {
        p.rotateZ((k - last) * TAU * 2.5);
        p.translateZ((k - last) * len);
        last = k;
      },
    });
    audio.whoosh();
    await rig.flyToTray(p);
  },

  async bolt(step, name) {
    const p = rig.parts[name];
    const len = p.userData.len * 0.9;
    audio.whoosh();
    await rig.flyHome(p, new THREE.Vector3(0, 0, len).applyQuaternion(p.userData.home.quat));
    let last = 0;
    const torque = state.tool === 'torque';
    await tools.use(state.tool, {
      obj: p,
      motion: state.tool === 'screwdriver' ? 'spin' : torque ? 'torque' : 'ratchet',
      dur: torque ? 1.5 : 1.2,
      progress: (k) => {
        p.rotateZ(-(k - last) * TAU * 2.5);
        p.translateZ(-(k - last) * len);
        last = k;
      },
    });
    rig.snapHome(p);
    if (step.torque) floatLabel(p, `${step.torque} ✓`);
  },

  async remove(step, name) {
    const p = rig.parts[name];
    for (const seg of p.userData.outPath) await rig.moveLocal(p, v3(seg), 0.42);
    audio.whoosh();
    await rig.flyToTray(p);
    audio.clunk();
  },

  async install(step, name) {
    const p = rig.parts[name];
    const path = p.userData.outPath;
    audio.whoosh();
    await rig.flyHome(p, sumPath(path));
    for (const seg of [...path].reverse()) await rig.moveLocal(p, v3(seg).negate(), 0.42);
    rig.snapHome(p);
    audio.clunk();
  },

  async hang() {
    const c = rig.caliper;
    for (const seg of c.userData.outPath) await rig.moveLocal(c, v3(seg), 0.5);
    const hook = rig.hook;
    hook.visible = true;
    tween(0.35, (k) => hook.scale.setScalar(k), Ease.backOut);
    audio.whoosh();
    await rig.hangCaliper();
    audio.clunk();
  },

  async mount(step, name) {
    const hook = rig.hook;
    tween(0.3, (k) => hook.scale.setScalar(1 - k), Ease.in).then(() => (hook.visible = false));
    await ACT.install(step, name);
  },

  async brush(step, name) {
    const p = rig.parts[name];
    const at = step.at[name];
    await tools.use('brush', {
      obj: p,
      point: v3(at.point),
      localAxis: v3(at.axis).normalize(),
      motion: 'scrub',
      radius: at.radius,
      dur: 2.0,
      progress: (k) => p.userData.clean(k),
    });
  },

  async spray(step, name) {
    const p = rig.parts[name];
    const at = step.at[name];
    await tools.use('cleaner', {
      obj: p,
      point: v3(at.point),
      localAxis: v3(at.axis).normalize(),
      motion: 'spray',
      standoff: 0.2,
      radius: at.radius,
      dur: 1.7,
      progress: (k) => p.userData.degrease && p.userData.degrease(k),
    });
  },

  async grease(step, name) {
    const p = rig.parts[name];
    const at = step.at[name];
    await tools.use(state.tool, {
      obj: p,
      point: v3(at.point),
      localAxis: v3(at.axis).normalize(),
      motion: 'dab',
      radius: at.radius,
      dur: 1.3,
      progress: (k) => rig.setGrease(step.grease[name], k),
    });
  },

  async greasePin(step, name) {
    const pin = rig.parts[name];
    await rig.moveLocal(pin, new THREE.Vector3(0, 0, -0.05), 0.45);
    await tools.use('silicone', {
      obj: pin,
      point: new THREE.Vector3(0, 0.006, 0.03),
      localAxis: new THREE.Vector3(0, 1, -0.5).normalize(),
      motion: 'dab',
      radius: 0.01,
      dur: 1.1,
      progress: (k) => rig.setGrease([name], k),
    });
    await rig.moveLocal(pin, new THREE.Vector3(0, 0, 0.05), 0.45);
    audio.clunk();
  },

  async press() {
    const r = rig;
    await tools.use('pistonTool', {
      obj: r.caliper.userData.pistonAnchor,
      localAxis: r.caliper.userData.pistonAxis,
      motion: 'press',
      dur: 1.9,
      progress: (k) => r.setPiston(r.pistonWorn + (r.pistonMin - r.pistonWorn) * k),
    });
  },

  async punchOut(step, name) {
    const p = rig.parts[name];
    const len = p.userData.len;
    await tools.use('hammer', {
      obj: p,
      point: new THREE.Vector3(0, 0, -len),
      localAxis: new THREE.Vector3(0, 0, -1),
      motion: 'strike',
      strikes: 2,
      onStrike: () => p.translateZ(0.012),
    });
    let last = 0;
    await tween(0.5, (k) => {
      p.translateZ((k - last) * (len - 0.02));
      last = k;
    }, Ease.inOut);
    audio.whoosh();
    await rig.flyToTray(p);
  },

  async punchIn(step, name) {
    const p = rig.parts[name];
    const len = p.userData.len;
    audio.whoosh();
    await rig.flyHome(p, new THREE.Vector3(0, 0, len).applyQuaternion(p.userData.home.quat));
    let last = 0;
    await tween(0.55, (k) => {
      p.translateZ(-(k - last) * (len - 0.02));
      last = k;
    }, Ease.inOut);
    await tools.use('hammer', {
      obj: p,
      point: new THREE.Vector3(0, 0, 0.004),
      motion: 'strike',
      strikes: 2,
      onStrike: () => p.translateZ(-0.01),
    });
    rig.snapHome(p);
  },
};

// ------------------------------------------------------------------ game flow
function startGame() {
  audio.unlock();
  state.session++;
  cancelAllTweens();
  tools.hide();
  setRig(state.mode);
  proc = getProcedure(state.variant, state.mode);
  Object.assign(state, { phase: 'game', stepIndex: 0, tool: null, busy: false, score: 0, mistakes: 0, startTime: performance.now() });
  $('menu').classList.add('hidden');
  $('finish').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('jobTitle').textContent = `${MODES[state.mode].name} · ${VARIANTS[state.variant].short}`;
  $('jobSub').textContent = state.variant === 'sport' ? 'Brembo 4pístkový monoblok' : 'Plovoucí třmen';
  renderToolbar();
  updateStats();
  setInsets(true);
  world.controls.maxDistance = 2.4;
  enterStep(0);
}

async function enterStep(i) {
  const session = state.session;
  const step = proc[i];
  state.stepIndex = i;
  state.remaining = new Set(step.targets);
  state.stepMistakes = 0;
  state.busy = true;
  clearMarkers();
  renderPanel();
  renderToolbar();
  world.controls.enabled = false;
  await Promise.all([world.viewTo(step.pickView || step.view, 1.15), steerTo(step.view.steer || 0)]);
  if (session !== state.session) return;
  world.controls.enabled = true;
  state.busy = false;
  buildMarkers();
}

async function onTarget(name) {
  if (state.phase !== 'game' || state.busy || !state.remaining.has(name)) return;
  const step = proc[state.stepIndex];
  if (!state.tool) {
    toast('Nejdřív si dole vyberte nářadí.', 'bad');
    audio.error();
    $('toolbar').classList.add('shake');
    setTimeout(() => $('toolbar').classList.remove('shake'), 400);
    return;
  }
  if (![].concat(step.tool).includes(state.tool)) {
    mistake(wrongToolMessage(step.tool, state.tool));
    return;
  }
  const session = state.session;
  state.busy = true;
  hideToast();
  removeMarker(name);
  // parts picked off the cart: the camera follows the part to the hub and
  // comes back for the next one
  const follow = step.pickView ? world.viewTo(step.view, 0.9) : null;
  if (follow) world.controls.enabled = false;
  await Promise.all([ACT[step.act](step, name), follow]);
  if (session !== state.session) return;
  state.remaining.delete(name);
  if (follow) {
    if (state.remaining.size) await world.viewTo(step.pickView, 0.8);
    if (session !== state.session) return;
    world.controls.enabled = true;
  }
  state.busy = false;
  if (state.remaining.size === 0) completeStep();
}

function mistake(message) {
  state.mistakes++;
  state.stepMistakes++;
  updateStats();
  toast(message, 'bad', 5200);
  audio.error();
  const btn = document.querySelector('.tool.selected');
  if (btn) {
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 400);
  }
}

const PRAISE = ['Správně.', 'Přesně tak.', 'Hotovo, jde se dál.', 'Čistá práce.', 'Takhle to má být.'];

async function completeStep() {
  const session = state.session;
  state.busy = true;
  state.score += Math.max(25, 100 - 25 * state.stepMistakes);
  updateStats(state.stepIndex + 1);
  audio.ok();
  toast(PRAISE[state.stepIndex % PRAISE.length], 'ok', 1500);
  markStepDone(state.stepIndex);
  await wait(0.75);
  if (session !== state.session) return;
  if (state.stepIndex + 1 < proc.length) enterStep(state.stepIndex + 1);
  else finish();
}

async function finish() {
  const session = state.session;
  state.phase = 'finish';
  clearMarkers();
  world.controls.enabled = false;
  await Promise.all([world.viewTo({ az: 0.42, el: 0.2, dist: 1.5, look: [0.2, 0, 0] }, 1.4), steerTo(0)]);
  if (session !== state.session) return;
  world.controls.enabled = true;
  audio.fanfare();
  const stars = state.mistakes === 0 ? 3 : state.mistakes <= 3 ? 2 : 1;
  $('stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
  const dem = state.mode === 'demontaz';
  $('finishTitle').textContent = dem ? 'Brzda je rozebraná' : 'Brzda je složená';
  $('finishSub').textContent = dem
    ? 'Všechny díly leží na vozíku a náboj je připravený na čištění. Teď přijde ta důležitější půlka práce.'
    : 'Sestava je zpátky na voze, namazaná a dotažená. Zbývá nasadit kolo a brzdy zajet.';
  const secs = Math.round((performance.now() - state.startTime) / 1000);
  $('fScore').textContent = state.score;
  $('fMistakes').textContent = state.mistakes;
  $('fTime').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  $('lessons').innerHTML = LESSONS[state.mode].map((l) => `<li>${l}</li>`).join('');
  $('nextBtn').innerHTML = dem ? 'Pokračovat montáží <span>→</span>' : `Zkusit ${state.variant === 'sport' ? 'standardní' : 'sportovní'} sestavu <span>→</span>`;
  $('finish').classList.remove('hidden');
}

function toMenu() {
  state.session++;
  cancelAllTweens();
  tools.hide();
  state.phase = 'menu';
  state.busy = false;
  clearMarkers();
  hideToast();
  $('hud').classList.add('hidden');
  $('finish').classList.add('hidden');
  $('lube').classList.add('hidden');
  $('menu').classList.remove('hidden');
  world.controls.enabled = false;
  setRig('preview');
  setInsets(false);
}

// ------------------------------------------------------------------ UI
function setInsets(game) {
  const w = window.innerWidth;
  if (game) {
    const panel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) || 372;
    world.setInsets({ left: panel + 28, right: 0, top: 60, bottom: 108 });
  } else {
    world.setInsets({ left: w > 760 ? Math.min(640, w * 0.46) : 0, right: 0, top: 0, bottom: 0 });
  }
}

function renderMenu() {
  const choice = (key, id, item, extra = '') =>
    `<button class="choice ${state[key] === id ? 'active' : ''}" data-key="${key}" data-id="${id}"><b>${item.name}</b><span>${item.desc}</span>${extra}</button>`;
  $('variantChoices').innerHTML = Object.entries(VARIANTS)
    .map(([id, v]) => choice('variant', id, v, `<div class="chips">${v.chips.map((c) => `<i>${c}</i>`).join('')}</div>`))
    .join('');
  $('modeChoices').innerHTML = Object.entries(MODES)
    .map(([id, m]) => choice('mode', id, m, `<div class="chips"><i>${getProcedure(state.variant, id).length} kroků</i></div>`))
    .join('');
}

function renderToolbar() {
  const step = proc[state.stepIndex];
  const allowed = step && state.phase === 'game' ? [].concat(step.tool) : [];
  $('toolbar').innerHTML = TOOLS.map(
    (t) =>
      `<button class="tool ${state.tool === t.id ? 'selected' : ''} ${state.hints && allowed.includes(t.id) ? 'hint' : ''}" data-tool="${t.id}" title="${t.desc}">${ICONS[t.id]}<span>${t.name}</span></button>`,
  ).join('');
}

function renderPanel() {
  const step = proc[state.stepIndex];
  $('stepCount').textContent = `Krok ${state.stepIndex + 1} / ${proc.length}`;
  $('stepTitle').textContent = step.title;
  $('stepText').textContent = step.text;
  const toolNames = [].concat(step.tool).map((id) => TOOLS.find((t) => t.id === id).name);
  $('stepNeed').innerHTML = state.hints
    ? `<i class="dot"></i><span>Nářadí: <b>${toolNames.join(' nebo ')}</b>, potom klikněte na označený díl.</span>`
    : '<i class="dot"></i><span>Vyberte správné nářadí a klikněte na označený díl.</span>';
  const note = (id, value) => {
    const el = $(id);
    el.classList.toggle('hidden', !value);
    if (value) el.querySelector('p, b').textContent = value;
  };
  note('stepTorque', step.torque);
  note('stepWhy', step.why);
  note('stepWarn', step.warn);
  note('stepTip', step.tip);
  $('stepList').innerHTML = proc
    .map((s, i) => `<li class="${i < state.stepIndex ? 'done' : i === state.stepIndex ? 'current' : ''}">${s.title}</li>`)
    .join('');
  document.querySelector('.panel').scrollTop = 0;
}

function markStepDone(i) {
  const li = $('stepList').children[i];
  if (li) li.className = 'done';
}

function updateStats(doneSteps = state.stepIndex) {
  $('score').textContent = state.score;
  $('mistakes').textContent = state.mistakes;
  $('progressBar').style.width = `${(doneSteps / Math.max(1, proc.length)) * 100}%`;
}

let toastTimer = 0;
function toast(message, kind = '', ms = 3200) {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
}
function hideToast() {
  $('toast').classList.add('hidden');
}

// ---- markers over the parts to click ----
const markers = new Map();
function buildMarkers() {
  clearMarkers();
  for (const name of state.remaining) {
    const el = document.createElement('div');
    el.className = 'marker';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onTarget(name);
    });
    $('markers').appendChild(el);
    markers.set(name, el);
  }
}
function removeMarker(name) {
  const el = markers.get(name);
  if (el) el.remove();
  markers.delete(name);
}
function clearMarkers() {
  for (const el of markers.values()) el.remove();
  markers.clear();
}
const proj = new THREE.Vector3();
function screenPos(obj) {
  obj.getWorldPosition(proj).project(world.camera);
  return { x: (proj.x * 0.5 + 0.5) * window.innerWidth, y: (-proj.y * 0.5 + 0.5) * window.innerHeight, visible: proj.z < 1 };
}
function updateMarkers() {
  for (const [name, el] of markers) {
    const s = screenPos(rig.parts[name]);
    el.style.display = s.visible ? '' : 'none';
    el.style.transform = `translate(${s.x}px, ${s.y}px)`;
  }
}
function floatLabel(obj, text) {
  const s = screenPos(obj);
  const el = document.createElement('div');
  el.className = 'float-label';
  el.textContent = text;
  el.style.left = `${s.x}px`;
  el.style.top = `${s.y - 18}px`;
  $('markers').appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// ---- picking + hover labels ----
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const setRay = (e) => {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, world.camera);
};
const shown = (o) => {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
};
function labelAt(e) {
  setRay(e);
  for (const hit of raycaster.intersectObjects(world.scene.children, true)) {
    if (!shown(hit.object)) continue;
    for (let o = hit.object; o; o = o.parent) if (o.userData.label) return o.userData.label;
    return null;
  }
  return null;
}
function pick(e) {
  if (state.phase !== 'game' || state.busy) return;
  setRay(e);
  let best = null;
  for (const name of state.remaining) {
    // targets are picked even when hidden behind other parts
    const hits = raycaster.intersectObject(rig.parts[name], true);
    if (hits.length && (!best || hits[0].distance < best.d)) best = { name, d: hits[0].distance };
  }
  if (!best) {
    // small parts (pins, bolts) are hard to hit exactly, so a near miss counts too
    for (const name of state.remaining) {
      const s = screenPos(rig.parts[name]);
      const d = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      if (s.visible && d < 36 && (!best || d < best.d)) best = { name, d };
    }
  }
  if (best) onTarget(best.name);
}

function bindEvents() {
  let down = null;
  let hoverEvent = null;
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) pick(e);
    down = null;
  });
  canvas.addEventListener('pointermove', (e) => (hoverEvent = e));
  canvas.addEventListener('pointerleave', () => {
    hoverEvent = null;
    $('tooltip').classList.add('hidden');
  });
  // hover lookups run at most once per frame
  bindEvents.hover = () => {
    if (!hoverEvent || state.phase === 'menu' || down) return;
    const e = hoverEvent;
    hoverEvent = null;
    const label = labelAt(e);
    const tip = $('tooltip');
    tip.classList.toggle('hidden', !label);
    if (label) {
      tip.textContent = label;
      tip.style.left = `${e.clientX}px`;
      tip.style.top = `${e.clientY}px`;
    }
  };

  $('menu').addEventListener('click', (e) => {
    const btn = e.target.closest('.choice');
    if (!btn) return;
    audio.unlock();
    audio.pick();
    const { key, id } = btn.dataset;
    if (state[key] === id) return;
    state[key] = id;
    renderMenu();
    if (key === 'variant') setRig('preview');
  });
  $('startBtn').addEventListener('click', startGame);
  $('toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tool');
    if (!btn) return;
    state.tool = state.tool === btn.dataset.tool ? null : btn.dataset.tool;
    audio.pick();
    renderToolbar();
  });
  $('menuBtn').addEventListener('click', toMenu);
  $('backBtn').addEventListener('click', toMenu);
  $('againBtn').addEventListener('click', startGame);
  $('nextBtn').addEventListener('click', () => {
    if (state.mode === 'demontaz') state.mode = 'montaz';
    else {
      state.variant = state.variant === 'sport' ? 'standard' : 'sport';
      state.mode = 'demontaz';
    }
    renderMenu();
    startGame();
  });
  $('hintBtn').addEventListener('click', () => {
    state.hints = !state.hints;
    $('hintBtn').classList.toggle('on', state.hints);
    renderToolbar();
    if (state.phase === 'game') renderPanel();
  });
  $('soundBtn').addEventListener('click', () => {
    const on = !$('soundBtn').classList.contains('on');
    $('soundBtn').classList.toggle('on', on);
    audio.setEnabled(on);
  });
  $('lubeBtn').addEventListener('click', () => $('lube').classList.remove('hidden'));
  $('lubeClose').addEventListener('click', () => $('lube').classList.add('hidden'));
  window.addEventListener('resize', () => setInsets(state.phase !== 'menu'));
  window.addEventListener('keydown', (e) => {
    if (state.phase !== 'game') return;
    const i = '1234567890-='.indexOf(e.key);
    if (i >= 0 && TOOLS[i]) {
      state.tool = TOOLS[i].id;
      renderToolbar();
    }
  });
}

// ------------------------------------------------------------------ boot
const MENU_VIEW = { az: -0.78, el: 0.1, dist: 4.3, look: new THREE.Vector3(0.75, 0.22, -0.6) };
const menuPos = new THREE.Vector3();
const menuTarget = new THREE.Vector3();
function menuCamera(time, dt) {
  const az = MENU_VIEW.az + Math.sin(time * 0.16) * 0.09;
  menuTarget.copy(HUB).add(MENU_VIEW.look);
  menuPos.setFromSphericalCoords(MENU_VIEW.dist, Math.PI / 2 - MENU_VIEW.el, az).add(menuTarget);
  const k = 1 - Math.exp(-dt * 2.2);
  world.camera.position.lerp(menuPos, k);
  world.controls.target.lerp(menuTarget, k);
  world.camera.lookAt(world.controls.target);
}

async function boot() {
  const brand = await loadBrand();
  document.querySelectorAll('[data-brand]').forEach((el) => {
    if (brand.url) {
      el.innerHTML = `<img src="${brand.url}" alt="Brembo">`;
      el.classList.add('has-img');
    } else el.textContent = 'brembo';
  });
  $('lubeList').innerHTML = LUBE_PLAN.map((l) => `<li class="${l.ok ? '' : 'no'}"><i>${l.ok ? '✓' : '✕'}</i><b>${l.where}</b><span>${l.what}</span></li>`).join('');

  mats = createMaterials(brand);
  world = createWorld(canvas, mats);
  tools = createTools(world.scene, mats);
  setRig('preview');
  renderMenu();
  renderToolbar();
  bindEvents();
  state.phase = 'menu';
  $('menu').classList.remove('hidden');
  setInsets(false);
  menuCamera(0, 10);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tickTweens(dt);
    if (state.phase === 'menu') menuCamera(now / 1000, dt);
    rig.update();
    bindEvents.hover();
    updateMarkers();
    world.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  $('loading').classList.add('fade');
  setTimeout(() => $('loading').remove(), 600);

  // exposed for debugging in the browser console
  window.__app = {
    state,
    world,
    get rig() { return rig; },
    get proc() { return proc; },
    startGame,
    onTarget,
    // steps the simulation without waiting for animation frames (hidden tabs throttle them)
    async advance(seconds) {
      for (let t = 0; t < seconds; t += 0.04) {
        tickTweens(0.04);
        rig.update();
        for (let i = 0; i < 8; i++) await null; // let awaiting step flows continue
      }
      updateMarkers();
      world.render();
    },
  };
}

boot();
