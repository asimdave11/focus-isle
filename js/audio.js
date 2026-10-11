// Ambient sounds generated with WebAudio — no audio files needed.
let ctx, master, nodes = [], chirpTimer = null;

export const SOUNDS = [
  { id: 'none', name: 'Off' },
  { id: 'rain', name: 'Rain' },
  { id: 'waves', name: 'Waves' },
  { id: 'brown', name: 'Brown noise' },
  { id: 'birds', name: 'Birds' },
];

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(type) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  return buf;
}

function loopNoise(type) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(type);
  src.loop = true;
  src.start();
  nodes.push(src);
  return src;
}

export function setVolume(v) {
  ensure();
  master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
}

export function play(id, volume = 0.5) {
  stop();
  if (id === 'none') return;
  ensure();
  setVolume(volume);
  if (id === 'rain') {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.5;
    loopNoise('white').connect(f).connect(g).connect(master);
    nodes.push(f, g);
  } else if (id === 'brown') {
    const g = ctx.createGain(); g.gain.value = 0.8;
    loopNoise('brown').connect(g).connect(master);
    nodes.push(g);
  } else if (id === 'waves') {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 600;
    const g = ctx.createGain(); g.gain.value = 0.4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const depth = ctx.createGain(); depth.gain.value = 0.35;
    lfo.connect(depth).connect(g.gain); lfo.start();
    loopNoise('white').connect(f).connect(g).connect(master);
    nodes.push(f, g, lfo, depth);
  } else if (id === 'birds') {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3000;
    const g = ctx.createGain(); g.gain.value = 0.04;
    loopNoise('white').connect(f).connect(g).connect(master);
    nodes.push(f, g);
    const chirp = () => {
      const t = ctx.currentTime;
      const n = 2 + Math.floor(Math.random() * 4);
      const base = 2200 + Math.random() * 1800;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        const s = t + i * 0.11;
        o.frequency.setValueAtTime(base, s);
        o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.07);
        og.gain.setValueAtTime(0, s);
        og.gain.linearRampToValueAtTime(0.12, s + 0.01);
        og.gain.exponentialRampToValueAtTime(0.001, s + 0.09);
        o.connect(og).connect(master);
        o.start(s); o.stop(s + 0.1);
      }
      chirpTimer = setTimeout(chirp, 1200 + Math.random() * 4000);
    };
    chirp();
  }
}

export function stop() {
  clearTimeout(chirpTimer);
  for (const n of nodes) { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} }
  nodes = [];
}

export function chime() {
  ensure();
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.12);
    g.gain.linearRampToValueAtTime(0.08, t + i * 0.12 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.4);
  });
}

export function thud() {
  ensure();
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.5);
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.6);
}
