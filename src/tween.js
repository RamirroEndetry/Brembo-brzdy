// Minimal promise-based tween runner driven by the render loop.
const tweens = new Set();

export const Ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

// update(easedK, rawK) is called every frame; resolves when finished.
export function tween(duration, update, ease = Ease.inOut) {
  return new Promise((resolve) => {
    if (duration <= 0) {
      update(1, 1);
      resolve();
      return;
    }
    tweens.add({ t: 0, duration, update, ease, resolve });
  });
}

export function tickTweens(dt) {
  for (const tw of [...tweens]) {
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.duration);
    tw.update(tw.ease(k), k);
    if (k >= 1) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}

export const wait = (seconds) => tween(seconds, () => {}, Ease.linear);

// Drops every running tween without resolving it, so abandoned step flows never continue.
export function cancelAllTweens() {
  tweens.clear();
}
