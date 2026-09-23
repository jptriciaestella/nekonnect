// ============================================================
//  NEKONNECT 🐱🐟  —  Game Engine v3 (Addictive & Juicy)
// ============================================================

// ── Constants ────────────────────────────────────────────────
const CANVAS_SIZE = 544;
const PAD = 16;
const USABLE = CANVAS_SIZE - PAD * 2;   // 512

const NUM_FISH_COLORS = 6;
const FISH_PALETTE = [
  { name:'red',    body:'#FF6B6B', light:'#FFA5A5', dark:'#D94444', fin:'#E05555' },
  { name:'blue',   body:'#5BACE3', light:'#8FC8EE', dark:'#3A8ABF', fin:'#4A9AD0' },
  { name:'green',  body:'#6BCB77', light:'#A0DDA8', dark:'#48A854', fin:'#58B862' },
  { name:'yellow', body:'#FFD93D', light:'#FFE77A', dark:'#D4B130', fin:'#EECB35' },
  { name:'purple', body:'#A55EEA', light:'#C89BF0', dark:'#7E3FBA', fin:'#9050D5' },
  { name:'pink',   body:'#FF8ED4', light:'#FFB8E4', dark:'#D064A8', fin:'#EE7DC4' },
];

const MIN_CHAIN = 2;
const ITEM_CHAIN_CHURU  = 4;
const ITEM_CHAIN_YARN   = 5;
const ITEM_CHAIN_CATNIP = 6;

// ── Helpers ──────────────────────────────────────────────────
const lerp  = (a,b,t) => a + (b - a) * t;
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const rand  = (lo,hi) => Math.random() * (hi - lo) + lo;
const randI = (lo,hi) => Math.floor(rand(lo, hi));
const wait  = ms => new Promise(r => setTimeout(r, ms));

// Canvas roundRect polyfill for older browsers
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!radii) radii = 0;
    const r = typeof radii === 'number' ? radii : (radii[0] || 0);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

// ── Level & Biome Data ───────────────────────────────────────
function getBiomeData(lvl) {
  if (lvl <= 4) {
    return { name: 'Sunny Garden', icon: '🏡', theme: 'garden' };
  } else if (lvl <= 9) {
    return { name: 'Ocean Lagoon', icon: '🌊', theme: 'ocean' };
  } else if (lvl <= 14) {
    return { name: 'Cat Cafe', icon: '☕', theme: 'cafe' };
  } else {
    return { name: 'Moonlit Rooftop', icon: '🌙', theme: 'moonlight' };
  }
}

function getLevelData(lvl) {
  const g = Math.min(8, 5 + Math.floor((lvl - 1) / 4));
  const c = Math.min(NUM_FISH_COLORS, 4 + Math.floor((lvl - 1) / 3));
  const t = 280 + (lvl - 1) * 260 + Math.floor((lvl - 1) / 2) * 110;
  const o = Math.min(10, Math.max(0, Math.floor((lvl - 3) * 1.3)));
  // Challenging move limits
  const m = Math.max(10, 15 + Math.floor(g / 2) - Math.floor((lvl % 5) / 2));
  const biome = getBiomeData(lvl);
  return { gridSize: g, numColors: c, target: t, obstacles: o, moves: m, biome };
}

// ── Audio Manager (Juicy & Expressive) ────────────────────────
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._musicTimer = null;
    this.musicPlaying = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  _vol() { return this.muted ? 0 : 1; }

  _osc(freq, type, t, dur, vol) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  // Progressive Bubble Pop Sound scaling with step index i
  pop(i, total) {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    // Ascending pitch ladder scaling with i
    const baseFreq = 460 + Math.pow(i, 1.22) * 110;

    // 1. Initial click / transient snap (gets crisper with i)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(baseFreq * 2.5, n);
    clickOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, n + 0.012);
    clickGain.gain.setValueAtTime(Math.min(0.28, 0.16 + i * 0.02) * this._vol(), n);
    clickGain.gain.exponentialRampToValueAtTime(0.001, n + 0.012);
    clickOsc.connect(clickGain).connect(this.ctx.destination);
    clickOsc.start(n);
    clickOsc.stop(n + 0.012);

    // 2. Resonant bubble body with downward scoop
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(baseFreq * 1.35, n);
    bodyOsc.frequency.exponentialRampToValueAtTime(baseFreq, n + 0.045);
    const bodyVol = Math.min(0.32, 0.18 + i * 0.022) * this._vol();
    bodyGain.gain.setValueAtTime(bodyVol, n);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, n + 0.08);
    bodyOsc.connect(bodyGain).connect(this.ctx.destination);
    bodyOsc.start(n);
    bodyOsc.stop(n + 0.08);

    // 3. Extra sparkle harmonic chime when i >= 3, getting brighter each step!
    if (i >= 3) {
      const harmOsc = this.ctx.createOscillator();
      const harmGain = this.ctx.createGain();
      harmOsc.type = 'triangle';
      harmOsc.frequency.setValueAtTime(baseFreq * 2.0, n);
      harmGain.gain.setValueAtTime(Math.min(0.12, 0.04 + (i - 3) * 0.02) * this._vol(), n);
      harmGain.gain.exponentialRampToValueAtTime(0.001, n + 0.1);
      harmOsc.connect(harmGain).connect(this.ctx.destination);
      harmOsc.start(n);
      harmOsc.stop(n + 0.1);
    }
  }

  // Synthesizes a real cute, expressive cat meow!
  meow(type = 'happy') {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    const dur = type === 'happy' ? 0.42 : 0.55;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc2.type = 'triangle';
    filter.type = 'bandpass';
    filter.Q.value = 3.6;

    if (type === 'happy') {
      // Cute rising then gentle dipping vocal meow ("m-ee-oww! ✨")
      osc.frequency.setValueAtTime(450, n);
      osc.frequency.exponentialRampToValueAtTime(940, n + 0.14);
      osc.frequency.exponentialRampToValueAtTime(620, n + dur);

      osc2.frequency.setValueAtTime(454, n);
      osc2.frequency.exponentialRampToValueAtTime(948, n + 0.14);
      osc2.frequency.exponentialRampToValueAtTime(625, n + dur);

      filter.frequency.setValueAtTime(800, n);
      filter.frequency.exponentialRampToValueAtTime(2500, n + 0.14);
      filter.frequency.exponentialRampToValueAtTime(1100, n + dur);

      gain.gain.setValueAtTime(0, n);
      gain.gain.linearRampToValueAtTime(0.2 * this._vol(), n + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.15 * this._vol(), n + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, n + dur);
    } else {
      // Melancholic / sad meow for game over ("m-e-o-w... 😿")
      osc.frequency.setValueAtTime(500, n);
      osc.frequency.exponentialRampToValueAtTime(440, n + 0.15);
      osc.frequency.exponentialRampToValueAtTime(260, n + dur);

      osc2.frequency.setValueAtTime(504, n);
      osc2.frequency.exponentialRampToValueAtTime(444, n + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(262, n + dur);

      filter.frequency.setValueAtTime(1200, n);
      filter.frequency.exponentialRampToValueAtTime(600, n + dur);

      gain.gain.setValueAtTime(0, n);
      gain.gain.linearRampToValueAtTime(0.16 * this._vol(), n + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, n + dur);
    }

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.ctx.destination);

    osc.start(n);
    osc2.start(n);
    osc.stop(n + dur);
    osc2.stop(n + dur);
  }

  select(i) {
    if (!this.ctx) return;
    this._osc(360 + i * 55, 'sine', this.ctx.currentTime, 0.08, 0.1 * this._vol());
  }

  deselect() {
    if (!this.ctx) return;
    this._osc(250, 'sine', this.ctx.currentTime, 0.06, 0.07 * this._vol());
  }

  powerUpSpawn() {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this._osc(f, 'sine', n + i * 0.07, 0.25, 0.12 * this._vol()));
  }

  explosion() {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime, sr = this.ctx.sampleRate;
    const len = sr * 0.25, buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / len * 6);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.22, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.25);
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
    s.connect(fl).connect(g).connect(this.ctx.destination); s.start(n); s.stop(n + 0.25);
    this._osc(75, 'sine', n, 0.2, 0.25 * this._vol());
  }

  lightning() {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    this._osc(1200, 'sawtooth', n, 0.08, 0.12 * this._vol());
    this._osc(100, 'sine', n + 0.03, 0.2, 0.2 * this._vol());
    this.explosion();
  }

  // 1. Churu Treat: Creamy squelch + punchy cartoon bubble blast
  churuBlast() {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(420, n);
    o.frequency.exponentialRampToValueAtTime(160, n + 0.08);
    g.gain.setValueAtTime(0.26 * this._vol(), n);
    g.gain.exponentialRampToValueAtTime(0.001, n + 0.1);
    o.connect(g).connect(this.ctx.destination);
    o.start(n); o.stop(n + 0.1);

    const len = Math.floor(this.ctx.sampleRate * 0.28);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / len * 5);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24 * this._vol(), n + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, n + 0.28);
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 750;
    s.connect(fl).connect(ng).connect(this.ctx.destination);
    s.start(n + 0.02); s.stop(n + 0.28);
    this._osc(68, 'sine', n + 0.02, 0.22, 0.28 * this._vol());
  }

  // 2. Yarn Ball: Rubbery / twangy spring boing sound
  yarnBoing() {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    const dur = 0.24;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, n);
    o.frequency.exponentialRampToValueAtTime(640, n + 0.07);
    o.frequency.exponentialRampToValueAtTime(380, n + dur);

    const lfo = this.ctx.createOscillator(), lfoG = this.ctx.createGain();
    lfo.frequency.value = 22;
    lfoG.gain.value = 35;
    lfo.connect(o.frequency);
    lfo.start(n); lfo.stop(n + dur);

    g.gain.setValueAtTime(0.22 * this._vol(), n);
    g.gain.exponentialRampToValueAtTime(0.001, n + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(n); o.stop(n + dur);
  }

  // 3. Catnip: Electric zap crackle + celestial sparkle arpeggio
  catnipZap() {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    const z = this.ctx.createOscillator(), zg = this.ctx.createGain();
    z.type = 'sawtooth';
    z.frequency.setValueAtTime(1500, n);
    z.frequency.exponentialRampToValueAtTime(280, n + 0.09);
    zg.gain.setValueAtTime(0.18 * this._vol(), n);
    zg.gain.exponentialRampToValueAtTime(0.001, n + 0.09);
    z.connect(zg).connect(this.ctx.destination);
    z.start(n); z.stop(n + 0.09);

    [1318, 1568, 2093, 2637].forEach((f, i) => {
      this._osc(f, 'sine', n + 0.03 + i * 0.035, 0.18, 0.1 * this._vol());
    });
    this.explosion();
  }

  // 4. Pop Adjacent (🐾 Paw Swipe): Swift swoosh scratches + resonant slap
  pawSwipe() {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    [0, 0.045].forEach((offset) => {
      const len = Math.floor(this.ctx.sampleRate * 0.06);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18 * this._vol(), n + offset);
      g.gain.exponentialRampToValueAtTime(0.001, n + offset + 0.06);
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2.0;
      s.connect(bp).connect(g).connect(this.ctx.destination);
      s.start(n + offset); s.stop(n + offset + 0.06);
    });
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(540, n + 0.06);
    o.frequency.exponentialRampToValueAtTime(140, n + 0.16);
    g.gain.setValueAtTime(0.24 * this._vol(), n + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, n + 0.18);
    o.connect(g).connect(this.ctx.destination);
    o.start(n + 0.06); o.stop(n + 0.18);
    this._osc(80, 'sine', n + 0.06, 0.18, 0.25 * this._vol());
  }

  // 5. Shuffle (🔀 Reshuffle): Cascading deck shuffle flutter & chime
  cardShuffle() {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    for (let i = 0; i < 7; i++) {
      const t = n + i * 0.024;
      const freq = 420 + i * 160;
      this._osc(freq, 'triangle', t, 0.03, 0.09 * this._vol());
    }
    this._osc(659, 'sine', n + 0.18, 0.22, 0.14 * this._vol());
    this._osc(1046, 'sine', n + 0.24, 0.28, 0.16 * this._vol());
  }

  // 6. Teleport (✨ Warp): Deep sub whoosh sweeping up + cosmic shimmer
  teleportWhoosh() {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.currentTime;
    const dur = 0.32;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, n);
    o.frequency.exponentialRampToValueAtTime(680, n + dur);
    g.gain.setValueAtTime(0.26 * this._vol(), n);
    g.gain.exponentialRampToValueAtTime(0.001, n + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(n); o.stop(n + dur);

    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.14 * this._vol(), n);
    ng.gain.exponentialRampToValueAtTime(0.001, n + dur);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(600, n);
    bp.frequency.exponentialRampToValueAtTime(2800, n + dur);
    bp.Q.value = 4.0;
    s.connect(bp).connect(ng).connect(this.ctx.destination);
    s.start(n); s.stop(n + dur);

    [1046, 1318, 1568].forEach((f, i) => {
      this._osc(f, 'triangle', n + 0.15 + i * 0.04, 0.26, 0.1 * this._vol());
    });
  }

  levelUp() {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => this._osc(f, 'triangle', n + i * 0.09, 0.4, 0.15 * this._vol()));
    setTimeout(() => this.meow('happy'), 350);
  }

  // ── Background Music ──
  startMusic() {
    if (this.musicPlaying || !this.ctx) return;
    this.musicPlaying = true;
    this._scheduleMusic();
  }
  stopMusic() { this.musicPlaying = false; clearTimeout(this._musicTimer); }

  _scheduleMusic() {
    if (!this.musicPlaying || !this.ctx) return;
    const n = this.ctx.currentTime + 0.05;
    const notes = [262, 330, 392, 440, 392, 330, 294, 262, 294, 330, 392, 330, 440, 392, 330, 262];
    const bass  = [131, null, 196, null, 220, null, 196, null, 131, null, 196, null, 220, null, 131, null];
    const beat  = 0.28;
    const vol   = this.muted ? 0 : 0.045;
    const bvol  = this.muted ? 0 : 0.035;

    notes.forEach((f, i) => {
      if (!f) return;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const t = n + i * beat;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.setValueAtTime(vol, t + beat * 0.65);
      g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.95);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + beat);
    });

    bass.forEach((f, i) => {
      if (!f) return;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = n + i * beat;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(bvol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + beat * 2 * 0.9);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + beat * 2);
    });

    const loopLen = notes.length * beat * 1000;
    this._musicTimer = setTimeout(() => this._scheduleMusic(), loopLen - 50);
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }
}

// ── Particle FX & Shockwaves ─────────────────────────────────
class Particle {
  constructor(x, y, color, sz, vx, vy, life) {
    this.x = x; this.y = y; this.color = color; this.sz = sz; this.vx = vx; this.vy = vy;
    this.life = life; this.max = life; this.alive = true;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 300 * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    const t = this.life / this.max;
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.sz * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Shockwave {
  constructor(x, y, color, maxRadius) {
    this.x = x; this.y = y; this.color = color;
    this.r = 6; this.maxR = maxRadius || 34;
    this.life = 0.26; this.maxLife = 0.26;
    this.alive = true;
  }
  update(dt) {
    this.life -= dt;
    const t = 1 - Math.max(0, this.life / this.maxLife);
    this.r = 6 + (this.maxR - 6) * Math.sin(t * Math.PI * 0.5);
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = t * 0.75;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(1, 3.5 * t);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class FloatingHeart {
  constructor(x, y) {
    this.x = x + rand(-18, 18);
    this.y = y - 12;
    this.vx = rand(-25, 25);
    this.vy = rand(45, 85);
    this.life = 0.95; this.maxLife = 0.95;
    this.alive = true;
    this.icon = ['💖', '❤️', '✨', '🐾', '😻'][randI(0, 5)];
    this.size = rand(18, 26);
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y -= this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = t;
    ctx.font = `${this.size}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, this.x, this.y);
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.ps = [];
    this.shockwaves = [];
    this.hearts = [];
  }

  emit(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(80, 250);
      this.ps.push(new Particle(x, y, color, rand(3, 7), Math.cos(a) * sp, Math.sin(a) * sp - 50, rand(0.3, 0.7)));
    }
  }

  emitPop(x, y, color, stepIndex = 0, totalChain = 2) {
    // Shockwave radius expands progressively with stepIndex
    const shockRadius = 24 + stepIndex * 4.5;
    this.shockwaves.push(new Shockwave(x, y, color, shockRadius));

    // Particle count scales progressively from 6 up to 32+
    const count = Math.floor(6 + Math.pow(stepIndex, 1.4) * 3.5);
    const maxSpeed = 160 + stepIndex * 24;

    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(70, maxSpeed);
      const c = (stepIndex >= 3 && i % 3 === 0) ? '#FFD700' : color;
      this.ps.push(new Particle(x, y, c, rand(3, 8), Math.cos(a) * sp, Math.sin(a) * sp - 50, rand(0.35, 0.75)));
    }

    // Add star sparkles as chain builds up
    if (stepIndex >= 3) {
      const starCount = Math.min(8, 2 + Math.floor(stepIndex * 0.9));
      this.emitStar(x, y, starCount);
    }
  }

  emitStar(x, y, n = 6) {
    const cs = ['#FFD700', '#FFF', '#FFB347', '#FFFACD', '#FF8ED4'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, sp = rand(70, 170);
      this.ps.push(new Particle(x, y, cs[i % cs.length], rand(2, 6), Math.cos(a) * sp, Math.sin(a) * sp, rand(0.4, 0.85)));
    }
  }

  emitHearts(x, y, n = 3) {
    for (let i = 0; i < n; i++) this.hearts.push(new FloatingHeart(x, y));
  }

  update(dt) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      this.ps[i].update(dt);
      if (!this.ps[i].alive) this.ps.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].update(dt);
      if (!this.shockwaves[i].alive) this.shockwaves.splice(i, 1);
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      this.hearts[i].update(dt);
      if (!this.hearts[i].alive) this.hearts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const sw of this.shockwaves) sw.draw(ctx);
    for (const p of this.ps) p.draw(ctx);
    for (const h of this.hearts) h.draw(ctx);
  }
}

// ── Floating Text ────────────────────────────────────────────
class FloatingText {
  constructor(x, y, txt, color, sz) {
    this.x = x; this.y = y; this.txt = txt; this.color = color; this.sz = sz || 22;
    this.life = 1; this.max = 1; this.alive = true;
  }
  update(dt) { this.y -= 55 * dt; this.life -= dt; if (this.life <= 0) this.alive = false; }
  draw(ctx) {
    const t = this.life / this.max;
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.font = `900 ${this.sz}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 6;
    ctx.fillText(this.txt, this.x, this.y);
    ctx.restore();
  }
}

// ── Tile (Fish / Item / Obstacle) ────────────────────────────
class Tile {
  constructor(col, row, cell, ox, oy) {
    this.col = col; this.row = row;
    this.cell = cell; this.ox = ox; this.oy = oy;
    this.kind = 'fish';
    this.colorIndex = 0;
    this.itemType = null;
    this.x = ox + col * cell + cell / 2;
    this.y = oy + row * cell + cell / 2;
    this.scale = 0; this.targetScale = 1;
    this.opacity = 1; this.selected = false;
    this.popping = false; this.popTimer = 0; this.alive = true;
    this.wobble = rand(0, Math.PI * 2);
  }

  startPop() { this.popping = true; this.popTimer = 0; }

  update(dt) {
    if (this.popping) {
      this.popTimer += dt;
      if (this.popTimer < 0.08) {
        // Elastic overshoot on pop!
        this.scale = lerp(this.scale, 1.55, 22 * dt);
      } else {
        this.scale = lerp(this.scale, 0, 24 * dt);
        this.opacity = lerp(this.opacity, 0, 16 * dt);
        if (this.opacity < 0.05) this.alive = false;
      }
    } else {
      this.scale += (this.targetScale - this.scale) * Math.min(1, 14 * dt);
    }
  }
}

function makeFish(col, row, ci, cell, ox, oy) {
  const t = new Tile(col, row, cell, ox, oy);
  t.kind = 'fish'; t.colorIndex = ci;
  return t;
}

function makeItem(col, row, itemType, cell, ox, oy) {
  const t = new Tile(col, row, cell, ox, oy);
  t.kind = 'item'; t.itemType = itemType;
  return t;
}

function makeObstacle(col, row, cell, ox, oy) {
  const t = new Tile(col, row, cell, ox, oy);
  t.kind = 'obstacle'; t.scale = 1; t.targetScale = 1;
  return t;
}

// ── Grid ─────────────────────────────────────────────────────
class Grid {
  constructor(size, numColors, numObstacles, catCol, catRow) {
    this.size = size;
    this.numColors = numColors;
    this.cell = Math.floor(USABLE / size);
    this.px   = this.cell * size;
    this.ox   = PAD + Math.floor((USABLE - this.px) / 2);
    this.oy   = PAD + Math.floor((USABLE - this.px) / 2);
    this.cells = [];
    this._init(numObstacles, catCol, catRow);
  }

  _init(numObs, catCol, catRow) {
    this.cells = [];
    for (let r = 0; r < this.size; r++) {
      this.cells[r] = [];
      for (let c = 0; c < this.size; c++) {
        if (c === catCol && r === catRow) { this.cells[r][c] = null; continue; }
        this.cells[r][c] = makeFish(c, r, randI(0, this.numColors), this.cell, this.ox, this.oy);
      }
    }
    // Place obstacles avoiding cat adjacent
    let placed = 0;
    const tries = numObs * 25;
    for (let t = 0; t < tries && placed < numObs; t++) {
      const c = randI(0, this.size), r = randI(0, this.size);
      if (Math.abs(c - catCol) <= 1 && Math.abs(r - catRow) <= 1) continue;
      if (this.cells[r][c]?.kind === 'obstacle') continue;
      this.cells[r][c] = makeObstacle(c, r, this.cell, this.ox, this.oy);
      placed++;
    }
  }

  get(c, r) { if (c < 0 || c >= this.size || r < 0 || r >= this.size) return undefined; return this.cells[r][c]; }
  set(c, r, v) { this.cells[r][c] = v; }

  tileXY(c, r) { return { x: this.ox + c * this.cell + this.cell / 2, y: this.oy + r * this.cell + this.cell / 2 }; }

  xyToColRow(x, y) {
    const c = Math.floor((x - this.ox) / this.cell);
    const r = Math.floor((y - this.oy) / this.cell);
    if (c >= 0 && c < this.size && r >= 0 && r < this.size) return { col: c, row: r };
    return null;
  }

  spawnAt(positions) {
    for (const { col, row } of positions) {
      const f = makeFish(col, row, randI(0, this.numColors), this.cell, this.ox, this.oy);
      this.cells[row][col] = f;
    }
  }

  getArea(c, r, rad) {
    const res = [];
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      const t = this.get(c + dc, r + dr);
      if (t && t.alive && t.kind !== 'obstacle') res.push(t);
    }
    return res;
  }

  getRow(r) { const res = []; for (let c = 0; c < this.size; c++) { const t = this.get(c, r); if (t && t.alive && t.kind !== 'obstacle') res.push(t); } return res; }
  getCol(c) { const res = []; for (let r = 0; r < this.size; r++) { const t = this.get(c, r); if (t && t.alive && t.kind !== 'obstacle') res.push(t); } return res; }

  hasValidChains(catC, catR) {
    const adj = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const t = this.get(catC + dc, catR + dr);
      if (t && t.alive && (t.kind === 'fish' || t.kind === 'item')) adj.push(t);
    }
    for (const a of adj) {
      if (a.kind === 'item') return true;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = a.col + dc, nr = a.row + dr;
        if (nc === catC && nr === catR) continue;
        const n = this.get(nc, nr);
        if (n && n.alive && ((n.kind === 'fish' && n.colorIndex === a.colorIndex) || n.kind === 'item')) return true;
      }
    }
    return false;
  }

  shuffle(catC, catR) {
    const fishTiles = [];
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) {
      const t = this.cells[r][c];
      if (t && t.kind === 'fish') fishTiles.push(t);
    }
    const colors = fishTiles.map(f => f.colorIndex);
    for (let i = colors.length - 1; i > 0; i--) { const j = randI(0, i + 1); [colors[i], colors[j]] = [colors[j], colors[i]]; }
    fishTiles.forEach((f, i) => { f.colorIndex = colors[i]; });
  }

  allTiles() {
    const res = [];
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.cells[r][c]) res.push(this.cells[r][c]);
    return res;
  }
}

// ── Rendering Functions ──────────────────────────────────────

function drawFishSprite(ctx, x, y, ci, scale, opacity, selected, cellSz, time) {
  const pal = FISH_PALETTE[ci];
  ctx.save(); ctx.globalAlpha = opacity; ctx.translate(x, y);
  const s = cellSz * 0.36 * scale;
  const wb = selected ? Math.sin(time * 8) * 0.06 : Math.sin(time * 2) * 0.02;
  ctx.scale(1 + wb, 1 - wb * 0.5);
  if (selected) { ctx.shadowColor = pal.body; ctx.shadowBlur = 16; }

  // Tail
  ctx.fillStyle = pal.fin; ctx.beginPath();
  ctx.moveTo(-s * 1.0, 0); ctx.quadraticCurveTo(-s * 1.2, -s * 0.7, -s * 1.6, -s * 0.55);
  ctx.quadraticCurveTo(-s * 1.3, 0, -s * 1.6, s * 0.55); ctx.quadraticCurveTo(-s * 1.2, s * 0.7, -s * 1.0, 0);
  ctx.fill();
  // Body
  ctx.fillStyle = pal.body; ctx.beginPath(); ctx.ellipse(0, 0, s * 1.15, s * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  // Belly
  ctx.fillStyle = pal.light; ctx.beginPath(); ctx.ellipse(s * 0.05, s * 0.15, s * 0.7, s * 0.38, 0, 0, Math.PI); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  // Dorsal fin
  ctx.fillStyle = pal.fin; ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.68);
  ctx.quadraticCurveTo(s * 0.15, -s * 1.2, s * 0.5, -s * 0.68); ctx.fill();
  // Eye
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.12, s * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.1, s * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.53, -s * 0.18, s * 0.06, 0, Math.PI * 2); ctx.fill();
  // Blush
  ctx.fillStyle = 'rgba(255,150,150,0.38)'; ctx.beginPath(); ctx.ellipse(s * 0.55, s * 0.18, s * 0.18, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // Mouth
  ctx.strokeStyle = pal.dark; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(s * 0.68, s * 0.05, s * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function drawChuru(ctx, x, y, scale, cellSz, time) {
  ctx.save(); ctx.translate(x, y); const s = cellSz * 0.34 * scale;
  const bob = Math.sin(time * 3) * 2;
  ctx.translate(0, bob);
  ctx.fillStyle = '#FF6B9D';
  ctx.beginPath(); ctx.roundRect(-s * 0.28, -s * 0.78, s * 0.56, s * 1.56, s * 0.14); ctx.fill();
  ctx.fillStyle = '#E04580';
  ctx.beginPath(); ctx.roundRect(-s * 0.33, -s * 0.83, s * 0.66, s * 0.22, s * 0.08); ctx.fill();
  ctx.fillStyle = '#FFB6D4'; ctx.fillRect(-s * 0.22, -s * 0.28, s * 0.44, s * 0.46);
  // Paw print
  ctx.fillStyle = '#E04580';
  ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-s * 0.09, -s * 0.18, s * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.09, -s * 0.18, s * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -s * 0.24, s * 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#FF6B9D'; ctx.lineWidth = 2;
  ctx.globalAlpha = 0.3 + Math.sin(time * 4) * 0.2;
  ctx.beginPath(); ctx.arc(0, 0, s * 1.15, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawYarnBall(ctx, x, y, scale, cellSz, time) {
  ctx.save(); ctx.translate(x, y); const s = cellSz * 0.34 * scale;
  const bob = Math.sin(time * 2.5 + 1) * 2;
  ctx.translate(0, bob);
  ctx.fillStyle = '#9B59B6'; ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8E44AD'; ctx.lineWidth = 1.5;
  for (let a = 0; a < Math.PI; a += 0.55) { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.28, a + time * 0.4, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.2, s * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9B59B6'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s * 0.45, s * 0.45);
  ctx.quadraticCurveTo(s * 0.75, s * 0.85, s * 0.4 + Math.sin(time * 3) * s * 0.12, s * 0.95); ctx.stroke();
  ctx.strokeStyle = '#C39BF0'; ctx.lineWidth = 2;
  ctx.globalAlpha = 0.3 + Math.sin(time * 3.5) * 0.2;
  ctx.beginPath(); ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawCatnip(ctx, x, y, scale, cellSz, time) {
  ctx.save(); ctx.translate(x, y); const s = cellSz * 0.34 * scale;
  const bob = Math.sin(time * 3.2 + 2) * 2;
  ctx.translate(0, bob);
  ctx.strokeStyle = '#27AE60'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, s * 0.55); ctx.quadraticCurveTo(-s * 0.08, 0, 0, -s * 0.25); ctx.stroke();
  ctx.fillStyle = '#2ECC71'; ctx.beginPath();
  ctx.moveTo(0, -s * 0.78);
  ctx.quadraticCurveTo(-s * 0.55, -s * 0.85, -s * 0.48, -s * 0.28);
  ctx.quadraticCurveTo(-s * 0.38, s * 0.08, 0, -s * 0.08);
  ctx.quadraticCurveTo(s * 0.38, s * 0.08, s * 0.48, -s * 0.28);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.85, 0, -s * 0.78);
  ctx.fill();
  ctx.strokeStyle = '#27AE60'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.72); ctx.lineTo(0, -s * 0.08); ctx.stroke();
  ctx.fillStyle = '#FFD700'; ctx.globalAlpha = 0.5 + Math.sin(time * 5) * 0.3;
  [[-s * 0.28, -s * 0.58], [s * 0.28, -s * 0.48], [0, -s * 0.38]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.arc(sx, sy, s * 0.055, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

function drawObstacle(ctx, x, y, cellSz, time) {
  ctx.save(); ctx.translate(x, y); const s = cellSz * 0.38;
  ctx.fillStyle = '#8D7B68';
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, s * 0.5);
  ctx.lineTo(-s * 0.85, -s * 0.05);
  ctx.lineTo(-s * 0.45, -s * 0.55);
  ctx.lineTo(s * 0.15, -s * 0.65);
  ctx.lineTo(s * 0.7, -s * 0.25);
  ctx.lineTo(s * 0.8, s * 0.35);
  ctx.lineTo(s * 0.3, s * 0.55);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#A4907C';
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 0.5); ctx.lineTo(s * 0.1, -s * 0.6);
  ctx.lineTo(s * 0.5, -s * 0.2); ctx.lineTo(-s * 0.1, -s * 0.15);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#635345'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.1); ctx.lineTo(s * 0.15, s * 0.15); ctx.lineTo(s * 0.05, s * 0.35); ctx.stroke();
  ctx.restore();
}

// Cat with cursor-following pupils & happy squint (^ ^) face
function drawCat(ctx, x, y, scale, cellSz, time, lookDir, isHappy) {
  ctx.save(); ctx.translate(x, y);
  const s = cellSz * 0.38 * scale;
  const bx = Math.sin(time * 4.5) * 1.5, by = Math.sin(time * 3.8) * 1.2;
  ctx.translate(bx, by);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.ellipse(0, s * 0.95, s * 0.75, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  // Body
  ctx.fillStyle = '#FFB347'; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
  // Stripes
  ctx.fillStyle = '#E89830';
  ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.5, s * 0.38, s * 0.07, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.2, -s * 0.55, s * 0.33, s * 0.065, 0.3, 0, Math.PI * 2); ctx.fill();

  // Ears
  [[-1, 1], [1, 1]].forEach(([dx]) => {
    ctx.fillStyle = '#FFB347'; ctx.beginPath();
    ctx.moveTo(dx * s * 0.7, -s * 0.5); ctx.lineTo(dx * s * 0.45, -s * 1.25); ctx.lineTo(dx * s * 0.05, -s * 0.65); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFB6C1'; ctx.beginPath();
    ctx.moveTo(dx * s * 0.58, -s * 0.55); ctx.lineTo(dx * s * 0.45, -s * 1.05); ctx.lineTo(dx * s * 0.18, -s * 0.65); ctx.closePath(); ctx.fill();
  });

  if (isHappy) {
    // Joyful squinting eyes (^ ^)
    ctx.strokeStyle = '#7D5A3C';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    // Left eye
    ctx.beginPath();
    ctx.arc(-s * 0.33, -s * 0.04, s * 0.16, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    // Right eye
    ctx.beginPath();
    ctx.arc(s * 0.33, -s * 0.04, s * 0.16, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Rosy blushing cheeks
    ctx.fillStyle = 'rgba(255, 80, 140, 0.55)';
    ctx.beginPath(); ctx.ellipse(-s * 0.52, s * 0.14, s * 0.22, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.52, s * 0.14, s * 0.22, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // Eyes with pupils following the cursor!
    const lx = (lookDir ? lookDir.x : 0) * s * 0.1;
    const ly = (lookDir ? lookDir.y : 0) * s * 0.08;

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-s * 0.33, -s * 0.08, s * 0.22, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.33, -s * 0.08, s * 0.22, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#2D2D2D';
    ctx.beginPath(); ctx.ellipse(-s * 0.31 + lx, -s * 0.06 + ly, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.35 + lx, -s * 0.06 + ly, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-s * 0.26, -s * 0.16, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.40, -s * 0.16, s * 0.06, 0, Math.PI * 2); ctx.fill();

    // Cheek blush
    ctx.fillStyle = 'rgba(255, 150, 150, 0.35)';
    ctx.beginPath(); ctx.ellipse(-s * 0.52, s * 0.14, s * 0.16, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.52, s * 0.14, s * 0.16, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Nose
  ctx.fillStyle = '#FF9999'; ctx.beginPath();
  ctx.moveTo(0, s * 0.08); ctx.lineTo(-s * 0.09, s * 0.2); ctx.lineTo(s * 0.09, s * 0.2); ctx.closePath(); ctx.fill();

  // Mouth (happy W shape)
  ctx.strokeStyle = '#7D5A3C'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.15, s * 0.28); ctx.quadraticCurveTo(-s * 0.07, s * 0.38, 0, s * 0.25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.15, s * 0.28); ctx.quadraticCurveTo(s * 0.07, s * 0.38, 0, s * 0.25); ctx.stroke();

  // Whiskers
  ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.18 + i * s * 0.09); ctx.lineTo(-s * 0.88, s * 0.12 + i * s * 0.14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.28, s * 0.18 + i * s * 0.09); ctx.lineTo(s * 0.88, s * 0.12 + i * s * 0.14); ctx.stroke();
  }
  ctx.restore();
}

// ── Main Game ────────────────────────────────────────────────
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.audio  = new AudioManager();
    this.particles = new ParticleSystem();
    this.floats = [];
    this.grid   = null;

    // State
    this.state = 'title'; // title | idle | chaining | processing | teleporting | levelcomplete | gameover
    this.level = 1;
    this.levelData = null;
    this.score = 0;
    this.moves = 15;

    // Cat Anchor
    this.catCol = 2; this.catRow = 2;
    this.catX = 0; this.catY = 0;
    this.catScale = 1;
    this.catLookDir = { x: 0, y: 0 };
    this.catHappyTimer = 0; // if > 0, cat displays happy face (^ ^)

    // Cursor tracking
    this.pointerX = CANVAS_SIZE / 2;
    this.pointerY = CANVAS_SIZE / 2;

    // Hop animation
    this._hop = null;
    this._bounce = null;

    // Chain
    this.chain = [];
    this.chainColor = -1;
    this.yarnActive = false;

    // Power-ups: balanced & scarce!
    this.pw = { pop: 1, shuffle: 1, teleport: 1 };

    // Shake
    this.shakeAmt = 0; this.shakeDcy = 0;

    // Time
    this.time = 0; this.lastTS = 0;
    this._shuffleTimeout = null;

    // DOM Elements
    this.scoreEl     = document.getElementById('score');
    this.targetEl    = document.getElementById('target');
    this.levelEl     = document.getElementById('level');
    this.movesEl     = document.getElementById('moves');
    this.movesDispEl = document.getElementById('moves-display');
    this.biomeNameEl = document.getElementById('biome-name');
    this.biomeIconEl = document.getElementById('biome-icon');
    this.progressEl  = document.getElementById('progress-fill');
    this.chainCntEl  = document.getElementById('chain-count');
    this.chainInfEl  = document.getElementById('chain-info');
    this.titleScr    = document.getElementById('title-screen');
    this.startBtn    = document.getElementById('start-btn');
    this.toastEl     = document.getElementById('powerup-toast');
    this.lvlCompEl   = document.getElementById('level-complete');
    this.nextBtn     = document.getElementById('next-level-btn');
    this.gameOverEl  = document.getElementById('game-over');
    this.retryBtn    = document.getElementById('retry-btn');
    this.muteBtn     = document.getElementById('mute-btn');
    this.rewardNoticeEl = document.getElementById('reward-notice');

    this.popBtn     = document.getElementById('btn-pop');
    this.shuffleBtn = document.getElementById('btn-shuffle');
    this.teleBtn    = document.getElementById('btn-teleport');
    this.popCnt     = document.getElementById('count-pop');
    this.shuffleCnt = document.getElementById('count-shuffle');
    this.teleCnt    = document.getElementById('count-teleport');

    this._bindEvents();
  }

  // ── Events ──
  _bindEvents() {
    this.startBtn.addEventListener('click', () => this._startGame());
    this.nextBtn.addEventListener('click', () => this._nextLevel());
    this.retryBtn.addEventListener('click', () => this._retryLevel());
    this.muteBtn.addEventListener('click', () => {
      const m = this.audio.toggleMute();
      this.muteBtn.textContent = m ? '🔇' : '🔊';
    });

    // Bottom bar power-ups
    this.popBtn.addEventListener('click', () => this._usePop());
    this.shuffleBtn.addEventListener('click', () => this._useShuffle());
    this.teleBtn.addEventListener('click', () => this._useTeleport());

    // Mouse pointer
    this.canvas.addEventListener('mousedown', e => this._ptr(e.offsetX, e.offsetY, 'down'));
    this.canvas.addEventListener('mousemove', e => {
      this.pointerX = e.offsetX;
      this.pointerY = e.offsetY;
      this._ptr(e.offsetX, e.offsetY, 'move');
    });
    this.canvas.addEventListener('mouseup', () => this._ptr(this.pointerX, this.pointerY, 'up'));
    this.canvas.addEventListener('mouseleave', () => this._ptr(this.pointerX, this.pointerY, 'up'));

    // Touch pointer
    const txy = (e) => {
      const t = e.touches[0] || e.changedTouches[0], r = this.canvas.getBoundingClientRect();
      return [(t.clientX - r.left) * (this.canvas.width / r.width), (t.clientY - r.top) * (this.canvas.height / r.height)];
    };
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const [x, y] = txy(e);
      this.pointerX = x; this.pointerY = y;
      this._ptr(x, y, 'down');
    }, { passive: false });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const [x, y] = txy(e);
      this.pointerX = x; this.pointerY = y;
      this._ptr(x, y, 'move');
    }, { passive: false });
    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      this._ptr(this.pointerX, this.pointerY, 'up');
    }, { passive: false });
  }

  _ptr(x, y, action) {
    if (action === 'down') { this.audio.init(); this.audio.resume(); }
    if (action === 'down') this._onDown(x, y);
    else if (action === 'move') this._onMove(x, y);
    else if (action === 'up') this._onUp();
  }

  // ── Start & Levels ──
  _startGame() {
    this.level = 1;
    this.pw = { pop: 1, shuffle: 1, teleport: 1 };
    this._startLevel();
    this.titleScr.classList.add('hidden');
    this.audio.init(); this.audio.resume();
    this.audio.startMusic();
  }

  _startLevel() {
    this.levelData = getLevelData(this.level);
    const ld = this.levelData;
    this.score = 0;
    this.moves = ld.moves;

    // Apply environment theme
    document.body.className = 'theme-' + ld.biome.theme;
    this.biomeNameEl.textContent = ld.biome.name;
    this.biomeIconEl.textContent = ld.biome.icon;

    const mid = Math.floor(ld.gridSize / 2);
    this.catCol = mid; this.catRow = mid;
    this.grid = new Grid(ld.gridSize, ld.numColors, ld.obstacles, this.catCol, this.catRow);
    const cp = this.grid.tileXY(this.catCol, this.catRow);
    this.catX = cp.x; this.catY = cp.y; this.catScale = 1;
    this.chain = []; this.chainColor = -1; this.yarnActive = false;
    this.state = 'idle';
    this.catHappyTimer = 0;

    this._updateHUD();
    this._checkStuck();
    this.lvlCompEl.classList.remove('visible');
    this.gameOverEl.classList.remove('visible');
  }

  _nextLevel() {
    this.level++;
    // Power-up rewards only every 5 levels (Milestone rewards)
    if (this.level % 5 === 0) {
      this.pw.pop++; this.pw.shuffle++; this.pw.teleport++;
      this._showToast('🎉 Milestone Bundle: +1 to ALL Power-Ups!');
    }
    this._startLevel();
  }

  _retryLevel() {
    this._startLevel();
  }

  _completeLevel() {
    this.state = 'levelcomplete';
    this.audio.levelUp();
    this.catHappyTimer = 4.0;
    this.particles.emitHearts(this.catX, this.catY, 6);

    document.getElementById('complete-score').textContent = this.score.toLocaleString();
    document.getElementById('complete-level').textContent = this.level;

    // Update milestone notice
    if ((this.level + 1) % 5 === 0) {
      this.rewardNoticeEl.textContent = `⭐ Next level (Lvl ${this.level + 1}) is a Milestone! Earns +1 to ALL Power-Ups!`;
    } else {
      const nextMilestone = Math.ceil((this.level + 1) / 5) * 5;
      this.rewardNoticeEl.textContent = `✨ Next power-up bundle unlocks at Level ${nextMilestone}!`;
    }

    this.lvlCompEl.classList.add('visible');
  }

  _gameOver() {
    this.state = 'gameover';
    this.audio.meow('sad');
    this.catHappyTimer = 0;
    document.getElementById('fail-score').textContent = this.score.toLocaleString();
    document.getElementById('fail-target').textContent = this.levelData.target.toLocaleString();
    this.gameOverEl.classList.add('visible');
  }

  // ── Pointer Handlers ──
  _onDown(x, y) {
    if (this.state === 'teleporting') {
      this._finishTeleport(x, y);
      return;
    }
    if (this.state !== 'idle') return;
    const pos = this.grid.xyToColRow(x, y);
    if (!pos) return;

    // Must click a tile adjacent to cat
    const dc = Math.abs(pos.col - this.catCol), dr = Math.abs(pos.row - this.catRow);
    if (dc > 1 || dr > 1 || (dc === 0 && dr === 0)) return;

    const tile = this.grid.get(pos.col, pos.row);
    if (!tile || !tile.alive || tile.kind === 'obstacle') return;

    this.state = 'chaining';
    this.chain = [tile];
    tile.selected = true;
    this.yarnActive = false;

    if (tile.kind === 'item') {
      this.chainColor = -1;
      if (tile.itemType === 'yarn') {
        this.yarnActive = true;
        this.audio.yarnBoing();
      }
    } else {
      this.chainColor = tile.colorIndex;
      this.audio.select(0);
    }
    this._updateChainUI();
    clearTimeout(this._shuffleTimeout);
  }

  _onMove(x, y) {
    if (this.state !== 'chaining') return;
    const pos = this.grid.xyToColRow(x, y);
    if (!pos) return;

    // Return to starting anchor (cat) cancels entire chain preview!
    if (pos.col === this.catCol && pos.row === this.catRow) {
      this.chain.forEach(t => t.selected = false);
      this.chain = [];
      this.state = 'idle';
      this.audio.deselect();
      this._hideChainUI();
      this._checkStuck();
      return;
    }

    const tile = this.grid.get(pos.col, pos.row);
    if (!tile || !tile.alive || tile.kind === 'obstacle') return;

    const last = this.chain[this.chain.length - 1];
    if (tile === last) return;

    // Backtrack to second-to-last
    if (this.chain.length >= 2 && tile === this.chain[this.chain.length - 2]) {
      const removed = this.chain.pop();
      removed.selected = false;
      this.audio.deselect();
      this._recalcChainColor();
      this._updateChainUI();
      return;
    }

    if (tile.selected) return;

    // Adjacency check
    const adc = Math.abs(pos.col - last.col), adr = Math.abs(pos.row - last.row);
    if (adc > 1 || adr > 1 || (adc === 0 && adr === 0)) return;

    // Color check
    if (tile.kind === 'fish') {
      if (this.chainColor !== -1 && tile.colorIndex !== this.chainColor) return;
    }

    // Add to chain
    this.chain.push(tile);
    tile.selected = true;

    if (tile.kind === 'item' && tile.itemType === 'yarn') {
      this.yarnActive = true;
      this.chainColor = -1; // lane switch: next fish picks new color!
      this.audio.yarnBoing();
    } else if (tile.kind === 'fish') {
      if (this.chainColor === -1 || this.yarnActive) {
        this.chainColor = tile.colorIndex;
        this.yarnActive = false;
      }
    }

    if (!(tile.kind === 'item' && tile.itemType === 'yarn')) {
      this.audio.select(this.chain.length - 1);
    }
    this._updateChainUI();
  }

  _onUp() {
    if (this.state !== 'chaining') return;

    if (this.chain.length >= MIN_CHAIN) {
      this._processChain();
    } else {
      this.chain.forEach(t => t.selected = false);
      this.chain = [];
      this.state = 'idle';
      this._hideChainUI();
      this._checkStuck();
    }
  }

  _recalcChainColor() {
    this.chainColor = -1;
    this.yarnActive = false;
    for (const t of this.chain) {
      if (t.kind === 'item' && t.itemType === 'yarn') {
        this.yarnActive = true;
        this.chainColor = -1;
      } else if (t.kind === 'fish') {
        this.chainColor = t.colorIndex;
        this.yarnActive = false;
      }
    }
  }

  _updateChainUI() {
    const len = this.chain.length;
    const pts = len * len * 10;
    this.chainCntEl.textContent = len;
    this.chainInfEl.textContent = `× ${len}  →  +${pts} pts`;
    this.chainCntEl.classList.add('visible');
    this.chainInfEl.classList.add('visible');
  }

  _hideChainUI() {
    this.chainCntEl.classList.remove('visible');
    this.chainInfEl.classList.remove('visible');
  }

  // ── Chain Processing (Juicy Pops & Combos) ──
  async _processChain() {
    this.state = 'processing';
    this._hideChainUI();
    const chain = [...this.chain];
    const len = chain.length;

    // Deduct 1 move
    this.moves--;

    // Score & Combo perks
    const pts = len * len * 10;
    this.score += pts;
    this._updateHUD();

    const midT = chain[Math.floor(len / 2)];
    this.floats.push(new FloatingText(midT.x, midT.y - 12, `+${pts}`, '#FFD700', Math.min(18 + len * 3, 36)));

    const items = chain.filter(t => t.kind === 'item');

    // Hop cat along chain. Slower, rhythmic and tactile; only long chains (len >= 5) accelerate progressively!
    for (let i = 0; i < chain.length; i++) {
      const tile = chain[i];

      // Pace calculation:
      // Normal chains (< 5): constant relaxed, rhythmic bounce (~0.19s)
      // Long chains (>= 5): starts relaxed, then gradually gains momentum (down to ~0.085s, never an unreadable blur!)
      let hopDur = 0.19;
      let pause = 44;

      if (len >= 5) {
        const accelFactor = Math.max(0, (i - 1) / (len - 1)); // kicks in gently after step 1
        const minHop = Math.max(0.085, 0.145 - (len - 5) * 0.01);
        hopDur = lerp(0.19, minHop, Math.pow(accelFactor, 1.25));
        pause = Math.max(18, Math.floor(44 - accelFactor * 24));
      }

      await this._animateHop(this.catX, this.catY, tile.x, tile.y, hopDur);

      // Progressive screen shake: only starts after several tiles and ramps gently
      if (i >= 2) {
        const shake = (i >= 5) ? (4.5 + (i - 5) * 2.2) : (i * 1.0);
        this.shakeAmt = Math.max(this.shakeAmt, shake);
        this.shakeDcy = 0.88;
      }

      // Pop tile with progressive particle spray, stars & shockwave ring
      tile.startPop();
      const col = tile.kind === 'fish' ? FISH_PALETTE[tile.colorIndex].body : '#FF6B9D';
      this.particles.emitPop(tile.x, tile.y, col, i, len);
      this.audio.pop(i, len);

      this.catCol = tile.col; this.catRow = tile.row;

      // Climax on the final tile of a satisfying chain (len >= 4)
      if (i === len - 1 && len >= 4) {
        this.shakeAmt = Math.min(18, 6 + len * 1.8);
        this.catHappyTimer = 1.4;
        this.audio.meow('happy');
        this.particles.emitHearts(this.catX, this.catY, Math.min(6, 2 + Math.floor(len * 0.6)));

        const callouts = len >= 7 ? 'CAT-TASTIC!! ⚡💖' : (len >= 6 ? 'PURR-FECT!! 🐱' : (len >= 5 ? 'TASTY COMBO! 🐟' : 'NICE! 🐾'));
        this.floats.push(new FloatingText(CANVAS_SIZE / 2, 70, callouts, '#FF6B6B', 30));
      }

      await wait(pause);
    }

    await wait(60);

    // Remove chain tiles from grid
    for (const t of chain) {
      if (this.grid.cells[t.row] && this.grid.cells[t.row][t.col] === t)
        this.grid.cells[t.row][t.col] = null;
    }

    // Trigger item power-ups
    const extraCleared = [];
    for (const item of items) {
      const cleared = await this._triggerItem(item, chain);
      extraCleared.push(...cleared);
    }

    if (extraCleared.length > 0) {
      for (const t of extraCleared) {
        if (this.grid.cells[t.row] && this.grid.cells[t.row][t.col] === t)
          this.grid.cells[t.row][t.col] = null;
      }
      const bonus = extraCleared.length * 15;
      this.score += bonus;
      this.floats.push(new FloatingText(CANVAS_SIZE / 2, CANVAS_SIZE / 2, `BONUS +${bonus}`, '#FF6B6B', 28));
      this._updateHUD();
      await wait(140);
    }

    // Spawn empty spots
    const spawnPositions = [];
    for (let r = 0; r < this.grid.size; r++) for (let c = 0; c < this.grid.size; c++) {
      if (c === this.catCol && r === this.catRow) continue;
      if (this.grid.cells[r][c] === null) spawnPositions.push({ col: c, row: r });
    }

    // Long chains spawn treats/items
    if (len >= ITEM_CHAIN_CATNIP && spawnPositions.length > 0) {
      const sp = spawnPositions.splice(randI(0, spawnPositions.length), 1)[0];
      const it = makeItem(sp.col, sp.row, 'catnip', this.grid.cell, this.grid.ox, this.grid.oy);
      this.grid.set(sp.col, sp.row, it);
      this.particles.emitStar(it.x, it.y, 14);
      this.audio.powerUpSpawn();
      this._showToast('🌿 Catnip appeared!');
    } else if (len >= ITEM_CHAIN_YARN && spawnPositions.length > 0) {
      const sp = spawnPositions.splice(randI(0, spawnPositions.length), 1)[0];
      const it = makeItem(sp.col, sp.row, 'yarn', this.grid.cell, this.grid.ox, this.grid.oy);
      this.grid.set(sp.col, sp.row, it);
      this.particles.emitStar(it.x, it.y, 14);
      this.audio.powerUpSpawn();
      this._showToast('🧶 Yarn Ball appeared!');
    } else if (len >= ITEM_CHAIN_CHURU && spawnPositions.length > 0) {
      const sp = spawnPositions.splice(randI(0, spawnPositions.length), 1)[0];
      const it = makeItem(sp.col, sp.row, 'churu', this.grid.cell, this.grid.ox, this.grid.oy);
      this.grid.set(sp.col, sp.row, it);
      this.particles.emitStar(it.x, it.y, 14);
      this.audio.powerUpSpawn();
      this._showToast('🩷 Churu appeared!');
    }

    // Rare chain bonus (7+ gives 1 Teleport)
    if (len >= 7) {
      this.pw.teleport++;
      this._showToast('✨ Mega Chain: +1 Teleport!');
    }

    // Respawn fish in-place
    this.grid.spawnAt(spawnPositions);

    await wait(200);

    // Reset chain state
    this.chain = [];
    this.chainColor = -1;
    this.yarnActive = false;
    this._updatePowerUpCounts();

    // Check Win vs Game Over
    if (this.score >= this.levelData.target) {
      this._completeLevel();
      return;
    } else if (this.moves <= 0) {
      this._gameOver();
      return;
    }

    this.state = 'idle';
    this._checkStuck();
  }

  async _triggerItem(item, chain) {
    const cleared = [];
    const col = item.col, row = item.row;
    if (item.itemType === 'churu') {
      this._showToast('💥 Churu Blast!');
      this.audio.churuBlast();
      this.shakeAmt = 9; this.shakeDcy = 0.9;
      const area = this.grid.getArea(col, row, 1);
      for (const f of area) {
        if (!f.popping && f.alive && !(f.col === this.catCol && f.row === this.catRow)) {
          f.startPop();
          const pal = f.kind === 'fish' ? FISH_PALETTE[f.colorIndex].body : '#FF6B9D';
          this.particles.emitPop(f.x, f.y, pal, 4, 6);
          cleared.push(f);
        }
      }
      await wait(120);
    } else if (item.itemType === 'catnip') {
      this._showToast('⚡ Catnip Lightning!');
      this.audio.catnipZap();
      this.shakeAmt = 12; this.shakeDcy = 0.88;
      const rowT = this.grid.getRow(row), colT = this.grid.getCol(col);
      const seen = new Set();
      for (const f of [...rowT, ...colT]) {
        if (seen.has(f)) continue; seen.add(f);
        if (!f.popping && f.alive && !(f.col === this.catCol && f.row === this.catRow)) {
          f.startPop();
          const pal = f.kind === 'fish' ? FISH_PALETTE[f.colorIndex].body : '#2ECC71';
          this.particles.emitPop(f.x, f.y, pal, 5, 6);
          cleared.push(f);
        }
      }
      await wait(180);
    }
    return cleared;
  }

  _animateHop(fx, fy, tx, ty, dur) {
    return new Promise(resolve => {
      this._hop = { fx, fy, tx, ty, dur, elapsed: 0, resolve };
    });
  }

  // ── Bottom Bar Consumables ──
  _usePop() {
    if (this.state !== 'idle' || this.pw.pop <= 0) return;
    this.pw.pop--;
    this._updatePowerUpCounts();
    this.audio.pawSwipe();
    this.shakeAmt = 6; this.shakeDcy = 0.9;

    const toPop = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const t = this.grid.get(this.catCol + dc, this.catRow + dr);
      if (t && t.alive && t.kind !== 'obstacle') {
        t.startPop(); toPop.push(t);
        const col = t.kind === 'fish' ? FISH_PALETTE[t.colorIndex].body : '#FF6B9D';
        this.particles.emitPop(t.x, t.y, col, 2, 4);
      }
    }

    setTimeout(() => {
      const positions = [];
      for (const t of toPop) {
        if (this.grid.cells[t.row][t.col] === t) this.grid.cells[t.row][t.col] = null;
        positions.push({ col: t.col, row: t.row });
      }
      this.grid.spawnAt(positions);
      this._checkStuck();
    }, 320);
  }

  _useShuffle() {
    if (this.state !== 'idle' || this.pw.shuffle <= 0) return;
    this.pw.shuffle--;
    this._updatePowerUpCounts();
    this.grid.shuffle(this.catCol, this.catRow);
    this.audio.cardShuffle();
    this._showToast('🔀 Shuffled!');
    this._checkStuck();
  }

  _useTeleport() {
    if (this.state !== 'idle' || this.pw.teleport <= 0) return;
    this.state = 'teleporting';
    this._showToast('✨ Tap any cell to teleport!');
    clearTimeout(this._shuffleTimeout);
  }

  _finishTeleport(x, y) {
    const pos = this.grid.xyToColRow(x, y);
    if (!pos) { this.state = 'idle'; this._checkStuck(); return; }
    const tile = this.grid.get(pos.col, pos.row);
    if (tile && tile.kind === 'obstacle') return;

    this.pw.teleport--;
    this._updatePowerUpCounts();

    if (tile && tile.alive) {
      this.grid.set(this.catCol, this.catRow, tile);
      tile.col = this.catCol; tile.row = this.catRow;
      const tp = this.grid.tileXY(this.catCol, this.catRow);
      tile.x = tp.x; tile.y = tp.y;
    } else {
      const f = makeFish(this.catCol, this.catRow, randI(0, this.grid.numColors), this.grid.cell, this.grid.ox, this.grid.oy);
      this.grid.set(this.catCol, this.catRow, f);
    }

    this.grid.set(pos.col, pos.row, null);
    this.catCol = pos.col; this.catRow = pos.row;
    const cp = this.grid.tileXY(this.catCol, this.catRow);
    this.catX = cp.x; this.catY = cp.y;

    this.particles.emitStar(this.catX, this.catY, 16);
    this.audio.teleportWhoosh();
    this.state = 'idle';
    this._checkStuck();
  }

  // ── Auto-Shuffle ──
  _checkStuck() {
    clearTimeout(this._shuffleTimeout);
    if (this.state !== 'idle') return;
    if (!this.grid.hasValidChains(this.catCol, this.catRow)) {
      this._shuffleTimeout = setTimeout(() => {
        if (this.state !== 'idle') return;
        this.grid.shuffle(this.catCol, this.catRow);
        this._showToast('🔀 No moves! Auto-shuffled');
      }, 1000);
    }
  }

  // ── UI ──
  _updateHUD() {
    this.scoreEl.textContent = this.score.toLocaleString();
    this.targetEl.textContent = this.levelData.target.toLocaleString();
    this.levelEl.textContent = this.level;
    this.movesEl.textContent = this.moves;

    // Pulse danger if moves <= 3
    this.movesDispEl.classList.toggle('danger', this.moves <= 3);

    const pct = Math.min(100, (this.score / this.levelData.target) * 100);
    this.progressEl.style.width = pct + '%';
    this._updatePowerUpCounts();
  }

  _updatePowerUpCounts() {
    this.popCnt.textContent = this.pw.pop;
    this.shuffleCnt.textContent = this.pw.shuffle;
    this.teleCnt.textContent = this.pw.teleport;
    this.popBtn.classList.toggle('disabled', this.pw.pop <= 0);
    this.shuffleBtn.classList.toggle('disabled', this.pw.shuffle <= 0);
    this.teleBtn.classList.toggle('disabled', this.pw.teleport <= 0);
  }

  _showToast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('visible'), 1600);
  }

  // ── Update ──
  update(dt) {
    this.time += dt;

    if (this.catHappyTimer > 0) {
      this.catHappyTimer -= dt;
    }

    // Cat eyes track cursor smoothly
    const dx = this.pointerX - this.catX;
    const dy = this.pointerY - this.catY;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const targetLx = clamp(dx / Math.max(dist, 1), -1, 1);
      const targetLy = clamp(dy / Math.max(dist, 1), -1, 1);
      this.catLookDir.x = lerp(this.catLookDir.x, targetLx, Math.min(1, 14 * dt));
      this.catLookDir.y = lerp(this.catLookDir.y, targetLy, Math.min(1, 14 * dt));
    }

    if (this.grid) for (const t of this.grid.allTiles()) t.update(dt);

    // Cat Hop
    if (this._hop) {
      const h = this._hop;
      h.elapsed += dt;
      const t = Math.min(h.elapsed / h.dur, 1);
      this.catX = lerp(h.fx, h.tx, t);
      this.catY = lerp(h.fy, h.ty, t) - Math.sin(t * Math.PI) * 18;

      if (t < 0.3) this.catScale = lerp(1, 1.18, t / 0.3);
      else if (t > 0.85) this.catScale = lerp(1.18, 0.88, (t - 0.85) / 0.15);
      else this.catScale = 1.18;

      if (t >= 1) {
        this.catX = h.tx; this.catY = h.ty; this.catScale = 0.88;
        h.resolve(); this._hop = null;
        this._bounce = { elapsed: 0, dur: 0.15 };
      }
    }

    // Cat Bounce on land
    if (this._bounce) {
      this._bounce.elapsed += dt;
      const t = Math.min(this._bounce.elapsed / this._bounce.dur, 1);
      this.catScale = lerp(0.88, 1.0, t);
      if (t >= 1) this._bounce = null;
    }

    this.particles.update(dt);

    for (let i = this.floats.length - 1; i >= 0; i--) {
      this.floats[i].update(dt);
      if (!this.floats[i].alive) this.floats.splice(i, 1);
    }

    if (this.shakeAmt > 0.5) this.shakeAmt *= this.shakeDcy; else this.shakeAmt = 0;
  }

  // ── Draw ──
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (!this.grid) return;
    ctx.save();

    // Screen Shake
    if (this.shakeAmt > 0.5) {
      ctx.translate((Math.random() - 0.5) * this.shakeAmt * 2, (Math.random() - 0.5) * this.shakeAmt * 2);
    }

    this._drawGridBg(ctx);

    if (this.chain.length >= 1 && this.state === 'chaining') this._drawChainLine(ctx);

    // Tiles
    for (const t of this.grid.allTiles()) {
      if (t.scale < 0.01 || t.opacity < 0.01) continue;
      if (t.kind === 'fish') drawFishSprite(ctx, t.x, t.y, t.colorIndex, t.scale, t.opacity, t.selected, this.grid.cell, this.time + t.wobble);
      else if (t.kind === 'item') {
        if (t.itemType === 'churu') drawChuru(ctx, t.x, t.y, t.scale, this.grid.cell, this.time);
        else if (t.itemType === 'yarn') drawYarnBall(ctx, t.x, t.y, t.scale, this.grid.cell, this.time);
        else if (t.itemType === 'catnip') drawCatnip(ctx, t.x, t.y, t.scale, this.grid.cell, this.time);
      }
      else if (t.kind === 'obstacle') drawObstacle(ctx, t.x, t.y, this.grid.cell, this.time);
    }

    // Cat Anchor
    drawCat(ctx, this.catX, this.catY, this.catScale, this.grid.cell, this.time, this.catLookDir, this.catHappyTimer > 0);

    if (this.state === 'teleporting') this._drawTeleportOverlay(ctx);

    this.particles.draw(ctx);
    for (const f of this.floats) f.draw(ctx);

    ctx.restore();
  }

  _drawGridBg(ctx) {
    const g = this.grid;
    for (let r = 0; r < g.size; r++) for (let c = 0; c < g.size; c++) {
      const x = g.ox + c * g.cell, y = g.oy + r * g.cell;
      const even = (r + c) % 2 === 0;
      ctx.fillStyle = even ? 'rgba(255,225,200,0.32)' : 'rgba(255,240,225,0.22)';
      ctx.beginPath(); ctx.roundRect(x + 2, y + 2, g.cell - 4, g.cell - 4, 6); ctx.fill();
    }
    // Subtle anchor glow
    const cx = g.ox + this.catCol * g.cell, cy = g.oy + this.catRow * g.cell;
    ctx.fillStyle = 'rgba(255,179,71,0.18)';
    ctx.beginPath(); ctx.roundRect(cx + 1, cy + 1, g.cell - 2, g.cell - 2, 6); ctx.fill();
  }

  _drawChainLine(ctx) {
    if (this.chain.length === 0) return;
    ctx.save();
    let color = '#FFB347';
    if (this.chainColor >= 0) color = FISH_PALETTE[this.chainColor].body;
    ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.5;

    const cp = this.grid.tileXY(this.catCol, this.catRow);
    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y);
    for (const t of this.chain) ctx.lineTo(t.x, t.y);
    ctx.stroke();

    ctx.strokeStyle = this.chainColor >= 0 ? FISH_PALETTE[this.chainColor].light : '#FFD499';
    ctx.lineWidth = 10; ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.moveTo(cp.x, cp.y);
    for (const t of this.chain) ctx.lineTo(t.x, t.y);
    ctx.stroke();

    // Floating badge on last tile
    const last = this.chain[this.chain.length - 1];
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(last.x + this.grid.cell * 0.35, last.y - this.grid.cell * 0.35, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '900 14px Nunito,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.chain.length, last.x + this.grid.cell * 0.35, last.y - this.grid.cell * 0.35);
    ctx.restore();
  }

  _drawTeleportOverlay(ctx) {
    const g = this.grid;
    ctx.save();
    for (let r = 0; r < g.size; r++) for (let c = 0; c < g.size; c++) {
      if (c === this.catCol && r === this.catRow) continue;
      const tile = g.get(c, r);
      if (tile && tile.kind === 'obstacle') continue;
      const x = g.ox + c * g.cell, y = g.oy + r * g.cell;
      ctx.fillStyle = `rgba(160,220,255,${0.18 + Math.sin(this.time * 4) * 0.08})`;
      ctx.beginPath(); ctx.roundRect(x + 2, y + 2, g.cell - 4, g.cell - 4, 6); ctx.fill();
    }
    ctx.restore();
  }

  // ── Loop ──
  loop(ts) {
    const dt = Math.min((ts - this.lastTS) / 1000, 0.05);
    this.lastTS = ts;
    if (this.state !== 'title') { this.update(dt); this.draw(); }
    requestAnimationFrame(t => this.loop(t));
  }

  start() { this.lastTS = performance.now(); requestAnimationFrame(t => this.loop(t)); }
}

// ── Initialize ───────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start();
});
