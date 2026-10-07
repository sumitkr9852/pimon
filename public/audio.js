// Procedural vibe engine — zero audio files, pure WebAudio.
// Three loops: Midnight Drive (dark synth), Lofi Rain (chill), Neon Pulse (upbeat arp).

const VIBES = {
  midnight: {
    label: 'MIDNIGHT DRIVE',
    lyric: 'city lights fade, we ride slow',
    bpm: 84,
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], // Am F G Em (midi)
    bass: [33, 29, 31, 28],
    arp: [69, 72, 76, 72],
    wave: 'sawtooth', cutoff: 900,
  },
  lofi: {
    label: 'LOFI RAIN',
    lyric: 'raindrops on the window pane',
    bpm: 76,
    chords: [[60, 64, 67, 71], [58, 62, 65, 69], [55, 59, 62, 65], [53, 57, 60, 64]],
    bass: [36, 34, 31, 29],
    arp: [72, 76, 79, 76],
    wave: 'triangle', cutoff: 1400,
  },
  neon: {
    label: 'NEON PULSE',
    lyric: 'electric hearts in neon light',
    bpm: 104,
    chords: [[57, 60, 64, 67], [55, 60, 64, 67], [53, 57, 60, 65], [55, 59, 62, 67]],
    bass: [33, 31, 29, 31],
    arp: [69, 72, 76, 79, 76, 72],
    wave: 'square', cutoff: 2200,
  },
};

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class VibeEngine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.vibeKey = null;
    this.timer = null;
    this.step = 0;
    this.nextT = 0;
  }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      // gentle lowpass on everything
      this.bus = this.ctx.createBiquadFilter();
      this.bus.type = 'lowpass';
      this.bus.frequency.value = 5200;
      this.bus.connect(this.master);
      this.master.connect(this.ctx.destination);
      // soft delay for space
      this.delay = this.ctx.createDelay(1);
      this.delay.delayTime.value = 0.32;
      const fb = this.ctx.createGain(); fb.gain.value = 0.28;
      this.delay.connect(fb); fb.connect(this.delay);
      this.delaySend = this.ctx.createGain(); this.delaySend.gain.value = 0.5;
      this.delaySend.connect(this.delay); this.delay.connect(this.bus);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  note(freq, t, dur, type, vol, dest) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  hat(t, vol) {
    const len = this.ctx.sampleRate * 0.05;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t);
  }
  schedule() {
    const v = VIBES[this.vibeKey];
    const spb = 60 / v.bpm / 2; // 8th notes
    while (this.nextT < this.ctx.currentTime + 0.35) {
      const t = this.nextT, s = this.step % 32;
      const bar = Math.floor(s / 8); // 4 bars of 8 steps
      // pad chord at bar start
      if (s % 8 === 0) {
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = v.cutoff;
        lp.connect(this.bus);
        v.chords[bar].forEach((m) => {
          [-4, 4].forEach((det) => {
            const o = this.ctx.createOscillator();
            o.type = v.wave; o.frequency.value = midiHz(m); o.detune.value = det;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.05, t + 0.6);
            g.gain.linearRampToValueAtTime(0.0008, t + spb * 8);
            o.connect(g); g.connect(lp);
            o.start(t); o.stop(t + spb * 8 + 0.1);
          });
        });
      }
      // bass on beats
      if (s % 4 === 0) this.note(midiHz(v.bass[bar]), t, spb * 3, 'sine', 0.22);
      // arp sparkle
      if (s % 2 === 0) {
        const m = v.arp[(s / 2) % v.arp.length] + (bar === 3 ? 2 : 0);
        this.note(midiHz(m), t, spb * 1.5, 'sine', 0.06, this.delaySend);
      }
      // hats off-beat
      if (s % 4 === 2) this.hat(t, 0.05);
      this.nextT += spb;
      this.step++;
    }
  }
  start(key) {
    this.init();
    this.stop(false);
    this.vibeKey = key;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.playing = true;
    this.timer = setInterval(() => this.schedule(), 120);
  }
  stop(fade = true) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    if (fade && this.ctx) {
      this.master.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
      setTimeout(() => { if (!this.playing) this.master.gain.value = 0.5; }, 500);
    }
  }
  toggle() {
    if (this.playing) { this.stop(); return false; }
    if (this.vibeKey) this.start(this.vibeKey);
    return this.playing;
  }
}

export const VIBE_LIST = Object.entries(VIBES).map(([key, v]) => ({ key, ...v }));
