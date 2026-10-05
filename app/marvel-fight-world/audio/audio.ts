/* ------------------------------------------------------------------ */
/*  Fight World audio: every sound is synthesized (no files, no         */
/*  copyrighted samples). One AudioContext, created on a user gesture.  */
/* ------------------------------------------------------------------ */

import type { SfxKey } from "../engine/types";

class GameAudio {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private sfxVol = 0.8;
  private musicVol = 0.35;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private musicKey = 0;
  announcer = true;

  /** Call from a click/keypress. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.comp.connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.comp);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = this.musicVol;
      this.musicBus.connect(this.comp);
      const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (this.ctx && this.sfxBus && this.musicBus) {
      this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.03);
      this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.03);
    }
  }

  /* ── Building blocks ─────────────────────────────────────────────── */
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, bus = this.sfxBus) {
    const c = this.ctx;
    if (!c || !bus) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, vol, 0.005, dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(filter: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, delay = 0, q = 1, bus = this.sfxBus) {
    const c = this.ctx;
    if (!c || !bus || !this.noise) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, vol, 0.004, dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /* ── SFX ─────────────────────────────────────────────────────────── */
  play(key: SfxKey, volume = 1) {
    if (!this.ctx || this.sfxVol <= 0) return;
    const v = volume;
    const r = 0.92 + Math.random() * 0.16; // pitch variety
    switch (key) {
      case "jab":
        this.tone("sine", 160 * r, 60, 0.09, 0.7 * v);
        this.hiss("bandpass", 2400, 900, 0.06, 0.45 * v, 0, 1.2);
        break;
      case "heavy":
        this.tone("sine", 120 * r, 40, 0.18, 0.95 * v);
        this.tone("triangle", 220 * r, 70, 0.1, 0.35 * v);
        this.hiss("lowpass", 1800, 200, 0.14, 0.55 * v);
        break;
      case "kick":
        this.tone("sine", 140 * r, 50, 0.13, 0.8 * v);
        this.hiss("bandpass", 1500, 500, 0.09, 0.45 * v, 0, 1);
        break;
      case "whoosh":
        this.hiss("bandpass", 600 * r, 2600, 0.12, 0.22 * v, 0, 2);
        break;
      case "block":
        this.tone("square", 900 * r, 700, 0.05, 0.18 * v);
        this.tone("triangle", 1400 * r, 1100, 0.08, 0.2 * v);
        this.hiss("highpass", 4000, 3000, 0.05, 0.25 * v);
        break;
      case "jump":
        this.hiss("bandpass", 700, 1600, 0.09, 0.15 * v, 0, 2);
        break;
      case "land":
        this.tone("sine", 90, 40, 0.12, 0.45 * v);
        this.hiss("lowpass", 900, 150, 0.12, 0.3 * v);
        break;
      case "throw":
        this.hiss("bandpass", 500, 2000, 0.2, 0.3 * v, 0, 2);
        this.tone("sine", 100, 35, 0.3, 0.9 * v, 0.12);
        break;
      case "energy":
        this.tone("sawtooth", 300 * r, 900, 0.22, 0.18 * v);
        this.tone("sine", 600 * r, 1500, 0.22, 0.22 * v);
        break;
      case "zap":
        this.tone("square", 1800 * r, 300, 0.16, 0.14 * v);
        this.hiss("bandpass", 3000, 1200, 0.12, 0.25 * v, 0, 3);
        break;
      case "lightning":
        this.hiss("highpass", 6000, 1500, 0.35, 0.55 * v);
        this.tone("sawtooth", 80, 30, 0.5, 0.4 * v, 0.03);
        break;
      case "explosion":
        this.tone("sine", 90, 25, 0.6, 0.9 * v);
        this.hiss("lowpass", 2400, 80, 0.7, 0.75 * v);
        break;
      case "web":
        this.hiss("bandpass", 4200, 1600, 0.12, 0.35 * v, 0, 4);
        this.tone("sine", 1800, 600, 0.08, 0.1 * v);
        break;
      case "slash":
        this.hiss("highpass", 5200, 2500, 0.11, 0.42 * v);
        this.tone("triangle", 2600 * r, 1800, 0.07, 0.12 * v);
        break;
      case "magic":
        [0, 0.05, 0.1].forEach((d, i) => this.tone("sine", 700 + i * 260, 1400 + i * 300, 0.25, 0.12 * v, d));
        this.hiss("bandpass", 3000, 6000, 0.3, 0.12 * v, 0, 5);
        break;
      case "smash":
        this.tone("sine", 70, 22, 0.7, 1.1 * v);
        this.hiss("lowpass", 1400, 60, 0.6, 0.8 * v);
        this.tone("triangle", 160, 40, 0.3, 0.4 * v);
        break;
      case "gun":
        this.hiss("highpass", 3500, 900, 0.07, 0.6 * v);
        this.tone("square", 220, 60, 0.06, 0.2 * v);
        break;
      case "super":
        this.tone("sawtooth", 110, 880, 0.55, 0.22 * v);
        this.tone("sine", 220, 1760, 0.55, 0.22 * v);
        this.hiss("bandpass", 800, 6000, 0.55, 0.3 * v, 0, 2);
        break;
      case "ko":
        this.tone("sine", 60, 20, 1.4, 1.2 * v);
        this.hiss("lowpass", 1800, 40, 1.2, 0.8 * v);
        this.tone("sawtooth", 440, 110, 0.9, 0.12 * v, 0.05);
        break;
      case "dodge":
        this.hiss("bandpass", 1600, 400, 0.16, 0.22 * v, 0, 2);
        break;
      case "heal":
        [0, 0.08, 0.16].forEach((d, i) => this.tone("sine", 520 + i * 180, 700 + i * 180, 0.18, 0.12 * v, d));
        break;
      case "guardBreak":
        this.tone("square", 600, 120, 0.4, 0.25 * v);
        this.hiss("bandpass", 2500, 400, 0.4, 0.4 * v, 0, 2);
        break;
    }
  }

  /** UI clicks/moves */
  ui(kind: "move" | "select" | "back" | "confirm") {
    if (!this.ctx) return;
    if (kind === "move") this.tone("triangle", 880, 990, 0.05, 0.08);
    if (kind === "select") {
      this.tone("square", 520, 780, 0.08, 0.1);
      this.tone("triangle", 1040, 1560, 0.1, 0.08, 0.03);
    }
    if (kind === "back") this.tone("triangle", 600, 300, 0.08, 0.08);
    if (kind === "confirm") {
      [0, 0.07, 0.14].forEach((d, i) => this.tone("square", 440 * (1 + i * 0.5), 440 * (1 + i * 0.5), 0.12, 0.09, d));
    }
  }

  /* ── Announcer (browser speech, optional) ───────────────────────── */
  say(text: string) {
    if (!this.announcer || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 0.55;
      u.volume = Math.min(1, this.sfxVol + 0.2);
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }

  /* ── Music: tiny drum + bass sequencer ───────────────────────────── */
  startMusic(key = 0) {
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicKey = key;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private schedule() {
    const c = this.ctx;
    if (!c || !this.musicBus) return;
    const spb = 60 / 132 / 4; // 16th notes at 132 bpm
    const roots = [55, 49, 58.27, 46.25, 61.74, 51.91];
    const root = roots[this.musicKey % roots.length];
    const bassLine = [0, 0, 12, 0, 7, 0, 10, 12, 0, 0, 12, 0, 5, 7, 3, 5];
    while (this.nextNoteTime < c.currentTime + 0.12) {
      const s = this.musicStep % 16;
      const bar = Math.floor(this.musicStep / 16) % 4;
      const t = this.nextNoteTime - c.currentTime;
      if (s % 4 === 0) this.tone("sine", 150, 45, 0.16, 0.55, t, this.musicBus);
      if (s === 4 || s === 12) this.hiss("bandpass", 1800, 900, 0.14, 0.3, t, 0.8, this.musicBus);
      if (s % 2 === 1) this.hiss("highpass", 9000, 7000, 0.04, 0.09, t, 1, this.musicBus);
      if (s % 2 === 0) {
        const semis = bassLine[s] + (bar === 3 ? -2 : 0);
        const f = root * Math.pow(2, semis / 12);
        this.tone("sawtooth", f, f * 0.98, spb * 1.6, 0.14, t, this.musicBus);
      }
      if (bar === 3 && s === 14) this.hiss("bandpass", 600, 4000, 0.25, 0.12, t, 2, this.musicBus);
      this.nextNoteTime += spb;
      this.musicStep++;
    }
  }
}

export const audio = new GameAudio();
