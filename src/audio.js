// Tiny synthesised sound set (no audio files needed).
let ctx = null;
let enabled = true;
let noiseBuf = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', gain = 0.12, delay = 0, slide = 0 } = {}) {
  const c = ac();
  if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { freq = 2000, q = 1, gain = 0.15, delay = 0, type = 'bandpass' } = {}) {
  const c = ac();
  if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

export const audio = {
  setEnabled(v) {
    enabled = v;
  },
  unlock() {
    ac();
  },
  pick() {
    tone(660, 0.06, { type: 'triangle', gain: 0.06 });
  },
  ratchet(clicks = 7) {
    for (let i = 0; i < clicks; i++) noise(0.022, { freq: 3400, q: 3, gain: 0.16, delay: i * 0.045 });
  },
  torqueClick() {
    noise(0.03, { freq: 2600, q: 5, gain: 0.3 });
    tone(1800, 0.05, { type: 'square', gain: 0.05 });
    noise(0.03, { freq: 2200, q: 5, gain: 0.22, delay: 0.09 });
  },
  hammer() {
    noise(0.05, { freq: 900, q: 1.2, gain: 0.35 });
    tone(2300, 0.22, { type: 'triangle', gain: 0.07 });
    tone(140, 0.09, { type: 'sine', gain: 0.25 });
  },
  spray(dur = 1) {
    noise(dur, { freq: 5200, q: 0.6, gain: 0.07, type: 'highpass' });
  },
  scrub(dur = 1.5) {
    for (let t = 0; t < dur; t += 0.17) noise(0.13, { freq: 1500 + Math.random() * 900, q: 0.8, gain: 0.07, delay: t });
  },
  squish() {
    noise(0.25, { freq: 500, q: 1.5, gain: 0.08 });
  },
  clunk() {
    noise(0.07, { freq: 420, q: 1, gain: 0.28 });
    tone(110, 0.1, { gain: 0.2 });
  },
  whoosh() {
    noise(0.28, { freq: 800, q: 0.7, gain: 0.04 });
  },
  ok() {
    tone(660, 0.12, { type: 'triangle', gain: 0.1 });
    tone(990, 0.2, { type: 'triangle', gain: 0.1, delay: 0.1 });
  },
  error() {
    tone(180, 0.22, { type: 'sawtooth', gain: 0.07, slide: -60 });
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.1, delay: i * 0.12 }));
  },
};
