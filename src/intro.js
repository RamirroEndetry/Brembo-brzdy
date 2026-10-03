// Attract loop for the start screen: three camera shots over the assembled
// sport brake, with an exploded view in the middle one. Rendered live, so it
// stays sharp at any size and needs no video file.
import * as THREE from 'three';
import { HUB } from './world.js';
import { Ease } from './tween.js';

// Exploded-view offsets in each part's home frame (caliper frame: +Y points
// radially outwards, +Z outboard).
const EXPLODE = {
  caliper: [0, 0.17, 0],
  caliperBolt1: [0, 0.3, 0],
  caliperBolt2: [0, 0.3, 0],
  padOuter: [0, 0.3, 0.035],
  padInner: [0, 0.3, -0.035],
  padSpring: [0, 0.4, 0],
  retPin1: [0, 0.17, 0.12],
  retPin2: [0, 0.17, 0.12],
  disc: [0, 0, 0.16],
  discScrew: [0, 0, 0.27],
};
// the disc can only leave once the caliper has cleared it
const LATE = new Set(['disc', 'discScrew']);

const SHOTS = [
  {
    dur: 6,
    caption: 'Čtyřpístkový monoblok Brembo',
    from: { az: 0.75, el: 0.1, dist: 0.8, look: [0.09, 0.0, 0.03] },
    to: { az: 0.2, el: 0.16, dist: 0.64, look: [0.1, 0.01, 0.03] },
  },
  {
    dur: 8,
    caption: 'Každý díl. Každý šroub. Každý moment.',
    from: { az: -0.25, el: 0.2, dist: 1.3, look: [0.17, 0.02, 0.08] },
    to: { az: 0.5, el: 0.3, dist: 1.2, look: [0.17, 0.02, 0.08] },
    explode: true,
  },
  {
    dur: 6,
    caption: 'Rozeberte ji a složte jako mechanik',
    from: { az: -1.05, el: 0.06, dist: 4.8, look: [0.75, 0.22, -0.6] },
    to: { az: -0.7, el: 0.1, dist: 4.2, look: [0.75, 0.22, -0.6] },
  },
];
const CUT = 0.45; // fade to black around each cut, seconds

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mix = (a, b, k) => a + (b - a) * k;

export function createIntro({ world, getRig, fadeEl, captionEl }) {
  let index = 0;
  let t = 0;
  let leaving = null; // { t, onBlack } while fading out to the menu
  let cuts = true; // fade to black at shot changes (off while a video covers the scene)
  let hold = true; // stay black until it is known whether the video plays
  const pos = new THREE.Vector3();
  const off = new THREE.Vector3();

  function explode(k) {
    const rig = getRig();
    const early = Ease.inOut(clamp01(k * 1.6));
    const late = Ease.inOut(clamp01((k - 0.35) / 0.65));
    for (const [name, o] of Object.entries(EXPLODE)) {
      const p = rig.parts[name];
      if (!p || !p.userData.home) continue;
      p.position.copy(p.userData.home.pos).addScaledVector(off.fromArray(o), LATE.has(name) ? late : early);
    }
  }

  function setShot(i) {
    index = i % SHOTS.length;
    t = 0;
    captionEl.textContent = SHOTS[index].caption;
    captionEl.classList.remove('show');
    void captionEl.offsetWidth; // restart the caption animation
    captionEl.classList.add('show');
  }

  return {
    start() {
      leaving = null;
      hold = true;
      fadeEl.style.opacity = 1;
      setShot(0);
    },
    // Lifts the black hold: over a playing video (no cuts) or onto the 3D loop.
    release(video) {
      if (!hold) return;
      hold = false;
      cuts = !video;
      t = 0;
      if (video) fadeEl.style.opacity = 0;
    },
    // Fades to black, calls onBlack (swap the scene there) and stops.
    leave(onBlack) {
      if (!leaving) leaving = { t: 0, onBlack };
    },
    frame(dt) {
      const shot = SHOTS[index];
      t += dt;
      if (t >= shot.dur && !leaving) {
        setShot(index + 1);
        return this.frame(0);
      }
      const k = clamp01(t / shot.dur);
      const { from, to } = shot;
      world.controls.target.set(mix(from.look[0], to.look[0], k), mix(from.look[1], to.look[1], k), mix(from.look[2], to.look[2], k)).add(HUB);
      pos.setFromSphericalCoords(mix(from.dist, to.dist, k), Math.PI / 2 - mix(from.el, to.el, k), mix(from.az, to.az, k));
      world.camera.position.copy(pos).add(world.controls.target);
      world.camera.lookAt(world.controls.target);

      // opens after the cut, holds, closes again before the next one
      explode(shot.explode ? Math.min(clamp01((t - 0.9) / 2.4), clamp01((shot.dur - 0.7 - t) / 1.6)) : 0);

      let fade = hold ? 1 : cuts ? Math.max(1 - t / CUT, (t - (shot.dur - CUT)) / CUT, 0) : 0;
      if (leaving) {
        leaving.t += dt;
        fade = Math.max(fade, leaving.t / 0.3);
        if (leaving.t >= 0.3) {
          explode(0);
          const done = leaving.onBlack;
          leaving = null;
          done();
          return;
        }
      }
      fadeEl.style.opacity = clamp01(fade);
    },
  };
}
