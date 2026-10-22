/* ------------------------------------------------------------------ */
/*  Dinosaur Land audio: every sound is synthesized with WebAudio      */
/*  (no recordings, no licensing). Sounds are grouped into categories, */
/*  attenuated + panned by distance from the camera, rate-limited, and */
/*  music and tonal birds provide the background without noise beds.   */
/* ------------------------------------------------------------------ */

import type { MusicMood } from "../game/musicMood";

/** Seconds of music scheduled ahead on the audio clock (covers a stutter of the main thread). */
const MUSIC_AHEAD = 1.2;

export type Category = "ambient" | "weather" | "creatures" | "effects" | "ui" | "music";

const THEMES = {
  calm: { beat: 0.56, notes: [60, 64, 67, 72, 69, 67, 64, 62, 65, 69, 72, 69, 67, 64, 62, 60], roots: [48, 45, 41, 43], wave: "sine" as OscillatorType, peak: 0.15 },
  hunt: { beat: 0.41, notes: [62, 65, 69, 72, 69, 65, 64, 62, 60, 65, 69, 72, 74, 72, 69, 65], roots: [50, 48, 46, 45], wave: "triangle" as OscillatorType, peak: 0.13 },
  attack: { beat: 0.3, notes: [69, 72, 76, 72, 67, 71, 74, 71, 65, 69, 72, 69, 64, 68, 71, 68], roots: [45, 43, 41, 40], wave: "triangle" as OscillatorType, peak: 0.17 },
};
const pitchOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Listener {
  x: number;
  y: number;
  zoom: number;
  /** half the view width in world px */
  span: number;
}

interface Beds {
  rain: number;
  wind: number;
  water: number;
  fire: number;
  night: number;
  day: number;
  volcano: number;
}

const RATE: Record<string, number> = {
  step: 0.09,
  chomp: 0.12,
  munch: 0.2,
  splash: 0.08,
  snore: 0.6,
  babble: 0.35,
  clack: 0.07,
  knock: 0.12,
  plop: 0.15,
  ignite: 0.25,
  hiss: 0.25,
  rustle: 0.2,
  thud: 0.1,
  yelp: 0.25,
  twang: 0.06,
  thunk: 0.06,
  sizzle: 0.5,
  drums: 4,
  hum: 0.8,
  zap: 0.08,
  tick: 0.5,
  chime: 0.3,
};

const CATEGORY: Record<string, Category> = {
  roar: "creatures",
  bellow: "creatures",
  honk: "creatures",
  chirp: "creatures",
  screech: "creatures",
  hiss: "effects",
  grunt: "creatures",
  snore: "creatures",
  yelp: "creatures",
  babble: "creatures",
  cheer: "creatures",
  thunder: "weather",
  pop: "ui",
  click: "ui",
  sticker: "ui",
  tone: "ui",
  tick: "ui",
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cats = new Map<Category, GainNode>();
  private noise: AudioBuffer | null = null;
  private last = new Map<string, number>();
  private birdT = 0;
  private active = 0;
  private musicMood: MusicMood | null = null;
  private musicLayer: GainNode | null = null;
  private musicStep = 0;
  private nextMusicAt = 0;
  /** the mood the game wants (the music's own clock plays it, frame rate or not) */
  private wantMood: MusicMood | null = null;
  private musicTimer = 0;
  muted = false;
  volume = 0.8;
  listener: Listener = { x: 0, y: 0, zoom: 1, span: 800 };

  /** Must run inside a user gesture. Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      for (const c of ["ambient", "weather", "creatures", "effects", "ui", "music"] as Category[]) {
        const g = ctx.createGain();
        g.gain.value = c === "ambient" ? 0.55 : c === "weather" ? 0.8 : c === "music" ? 0.48 : 1;
        g.connect(this.master);
        this.cats.set(c, g);
      }
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  setVolume(v: number) {
    this.volume = v;
    if (!this.muted && this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /**
   * The game says which mood it wants; the music keeps its own time on a real-time timer + the audio
   * clock, so a slow frame (zoomed right out, a busy battle) never drags the tempo.
   */
  setMusicMood(mood: MusicMood) {
    this.wantMood = mood;
    if (!this.musicTimer && typeof window !== "undefined") {
      this.musicTimer = window.setInterval(() => {
        if (this.wantMood) this.updateMusic(this.wantMood);
      }, 50);
    }
  }

  dispose() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    void this.ctx?.close();
    this.ctx = null;
    this.musicLayer = null;
    this.musicMood = null;
  }

  /** Finish the current melody before choosing the next scene's music. */
  updateMusic(mood: MusicMood) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.muted || this.volume <= 0) return;
    const now = ctx.currentTime;
    if (this.musicMood === null) this.nextMusicAt = now + 0.04;
    const phraseEnded = this.musicMood !== null && this.musicStep >= THEMES[this.musicMood].notes.length;
    // Hold the last notes and accompaniment until the next phrase starts.
    if (this.musicMood === null || (phraseEnded && this.nextMusicAt < now + MUSIC_AHEAD)) {
      const at = Math.max(now + 0.02, this.nextMusicAt);
      if (mood !== this.musicMood) {
        const old = this.musicLayer;
        if (old) {
          old.gain.cancelScheduledValues(at);
          old.gain.setTargetAtTime(0, at, 0.12);
          window.setTimeout(() => old.disconnect(), Math.max(0, at - now) * 1000 + 2200);
        }
        const layer = ctx.createGain();
        layer.gain.setValueAtTime(0, at);
        layer.gain.setTargetAtTime(1, at, 0.12);
        layer.connect(this.cats.get("music")!);
        this.musicLayer = layer;
        this.musicMood = mood;
      }
      this.musicStep = 0;
      this.nextMusicAt = at;
    }
    const theme = THEMES[this.musicMood!];
    // fell behind (the tab was busy): skip the beats we missed so the tune keeps its tempo, never slows
    if (this.nextMusicAt < now - 0.01) {
      const miss = Math.ceil((now - this.nextMusicAt) / theme.beat);
      this.musicStep += miss;
      this.nextMusicAt += miss * theme.beat;
    }
    let scheduled = 0;
    while (this.musicStep < theme.notes.length && this.nextMusicAt < now + MUSIC_AHEAD && scheduled++ < 32) {
      const at = this.nextMusicAt;
      const step = this.musicStep++;
      const layer = this.musicLayer!;
      this.musicNote(layer, pitchOf(theme.notes[step]), at, theme.beat * (this.musicMood === "calm" ? 0.9 : 0.72), theme.peak, theme.wave);
      if (step % 4 === 0) {
        const root = theme.roots[Math.floor(step / 4)];
        this.musicNote(layer, pitchOf(root), at, theme.beat * 3.5, this.musicMood === "calm" ? 0.1 : 0.13, "sine");
        if (this.musicMood === "calm") this.musicNote(layer, pitchOf(root + 7), at, theme.beat * 2.7, 0.045, "sine");
      }
      if (this.musicMood !== "calm" && step % 2 === 0) this.musicPulse(layer, at, step % 4 === 0 ? 0.13 : 0.075);
      this.nextMusicAt += theme.beat;
    }
  }

  private musicNote(layer: GainNode, freq: number, at: number, dur: number, peak: number, wave: OscillatorType) {
    const ctx = this.ctx!;
    const tone = ctx.createOscillator();
    tone.type = wave;
    tone.frequency.setValueAtTime(freq, at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    tone.connect(gain).connect(layer);
    tone.start(at);
    tone.stop(at + dur + 0.02);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  }

  private musicPulse(layer: GainNode, at: number, peak: number) {
    const ctx = this.ctx!;
    const drum = ctx.createOscillator();
    drum.type = "sine";
    drum.frequency.setValueAtTime(105, at);
    drum.frequency.exponentialRampToValueAtTime(48, at + 0.17);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
    drum.connect(gain).connect(layer);
    drum.start(at);
    drum.stop(at + 0.2);
    drum.onended = () => { drum.disconnect(); gain.disconnect(); };
  }

  /* ----------------------------- spatial ----------------------------- */

  /** volume + pan for a world position, or null if too far to hear */
  private place(x: number, y: number, vol: number) {
    const L = this.listener;
    const dx = x - L.x;
    const dy = y - L.y;
    const range = L.span * 1.6 + 300;
    const d = Math.hypot(dx, dy);
    if (d > range) return null;
    const near = 1 - d / range;
    const gain = vol * near * near * (0.6 + Math.min(1, L.zoom) * 0.4);
    if (gain < 0.02) return null;
    return { gain, pan: Math.max(-1, Math.min(1, dx / (L.span + 1))) * 0.8, dist: d };
  }

  private out(cat: Category, gain: number, pan: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.cats.get(cat)!);
    } else g.connect(this.cats.get(cat)!);
    return g;
  }

  private noiseSrc(at: number, dur: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    n.loopStart = Math.random();
    n.start(at, Math.random() * 1.5);
    n.stop(at + dur);
    return n;
  }

  private env(g: GainNode, at: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  }

  /* ----------------------------- one-shots ----------------------------- */

  play(sound: string, x: number, y: number, vol = 1, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const rate = RATE[sound] ?? 0.05;
    const key = sound;
    if (now - (this.last.get(key) ?? -9) < rate) return;
    if (this.active > 28 && sound !== "boom" && sound !== "thunder") return;
    const ui = sound === "pop" || sound === "click" || sound === "sticker" || sound === "drums" || sound === "evolve" || sound === "tick";
    const pl = ui ? { gain: vol, pan: 0, dist: 0 } : this.place(x, y, vol);
    if (!pl) return;
    this.last.set(key, now);
    const cat = CATEGORY[sound] ?? "effects";
    // thunder arrives late when the strike is far away
    const at = now + (sound === "thunder" ? Math.min(2.2, pl.dist / 1400) + 0.05 : 0.01);
    const out = this.out(cat, pl.gain, pl.pan);
    this.active++;
    window.setTimeout(() => {
      this.active--;
      out.disconnect();
    }, 4000);
    this.synth(sound, at, out, pitch * (0.94 + Math.random() * 0.12));
  }

  /**
   * A pure test tone for the Resonance table: the exact frequency, coloured by the material.
   * `close` (0..1) adds a shimmering overtone as you near the material's true note.
   */
  tone(freq: number, material: string, close = 0, dur = 0.9) {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== "running") return;
    const at = ctx.currentTime + 0.01;
    const out = this.out("ui", 0.8, 0);
    const wave: OscillatorType = material === "copper" || material === "magnetite" ? "triangle" : material === "meteorite" ? "sawtooth" : "sine";
    const voice = (f: number, peak: number, type: OscillatorType, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, at);
      o.detune.value = detune;
      const g = ctx.createGain();
      this.env(g, at, 0.02, peak, dur);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.1);
    };
    voice(freq, wave === "sawtooth" ? 0.08 : 0.22, wave);
    if (material === "crystal" || material === "quartz") voice(freq * 2, 0.06, "sine", 4);
    if (close > 0.5) voice(freq * 1.5, 0.12 * close, "sine", Math.sin(close * 9) * 8);
    if (close > 0.95) [2, 3, 4].forEach((k) => voice(freq * k, 0.06, "sine", k * 2));
    window.setTimeout(() => out.disconnect(), (dur + 0.6) * 1000);
  }

  private synth(sound: string, at: number, out: GainNode, p: number) {
    const ctx = this.ctx!;
    const osc = (type: OscillatorType, f0: number, f1: number, dur: number, peak: number, a = 0.01, dest: AudioNode = out) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
      const g = ctx.createGain();
      this.env(g, at, a, peak, dur);
      o.connect(g).connect(dest);
      o.start(at);
      o.stop(at + a + dur + 0.05);
      return o;
    };
    const noise = (type: BiquadFilterType, f0: number, f1: number, q: number, dur: number, peak: number, a = 0.005, delay = 0) => {
      const n = this.noiseSrc(at + delay, a + dur + 0.05);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0, at + delay);
      f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), at + delay + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at + delay);
      g.gain.exponentialRampToValueAtTime(peak, at + delay + a);
      g.gain.exponentialRampToValueAtTime(0.0001, at + delay + a + dur);
      n.connect(f).connect(g).connect(out);
    };
    switch (sound) {
      case "roar": {
        // growly saw through a sweeping low-pass + rumble noise
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.Q.value = 6;
        f.frequency.setValueAtTime(300 * p, at);
        f.frequency.linearRampToValueAtTime(1300 * p, at + 0.35);
        f.frequency.exponentialRampToValueAtTime(250 * p, at + 1.4);
        f.connect(out);
        const o1 = osc("sawtooth", 95 * p, 60 * p, 1.4, 0.5, 0.12, f);
        const o2 = osc("square", 142 * p, 75 * p, 1.3, 0.25, 0.12, f);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 28;
        const lg = ctx.createGain();
        lg.gain.value = 18 * p;
        lfo.connect(lg);
        lg.connect(o1.frequency);
        lg.connect(o2.frequency);
        lfo.start(at);
        lfo.stop(at + 1.6);
        noise("bandpass", 500 * p, 200 * p, 1.2, 1.3, 0.35, 0.1);
        break;
      }
      case "bellow": {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 600 * p;
        f.connect(out);
        const o = osc("triangle", 70 * p, 52 * p, 1.6, 0.7, 0.2, f);
        const vib = ctx.createOscillator();
        vib.frequency.value = 5;
        const vg = ctx.createGain();
        vg.gain.value = 4 * p;
        vib.connect(vg).connect(o.frequency);
        vib.start(at);
        vib.stop(at + 1.9);
        osc("sawtooth", 140 * p, 104 * p, 1.5, 0.12, 0.2, f);
        break;
      }
      case "honk": {
        // hollow trumpet: two detuned squares through a formant
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 700 * p;
        f.Q.value = 3;
        f.connect(out);
        osc("square", 220 * p, 200 * p, 0.6, 0.5, 0.05, f);
        osc("square", 223 * p, 205 * p, 0.6, 0.4, 0.05, f);
        osc("sine", 110 * p, 100 * p, 0.6, 0.3, 0.05);
        break;
      }
      case "chirp":
        for (let i = 0; i < 3; i++) {
          const o = ctx.createOscillator();
          o.type = "sine";
          const t = at + i * 0.09;
          o.frequency.setValueAtTime(1400 * p, t);
          o.frequency.exponentialRampToValueAtTime(2600 * p, t + 0.06);
          const g = ctx.createGain();
          this.env(g, t, 0.005, 0.35, 0.07);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + 0.1);
        }
        break;
      case "screech": {
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1800 * p;
        f.Q.value = 2;
        f.connect(out);
        osc("sawtooth", 1300 * p, 700 * p, 0.5, 0.45, 0.02, f);
        osc("square", 1950 * p, 1100 * p, 0.45, 0.15, 0.02, f);
        break;
      }
      case "hiss":
        osc("sine", 680 * p, 280 * p, 0.22, 0.1, 0.02);
        break;
      case "grunt":
        osc("square", 120 * p, 80 * p, 0.25, 0.3, 0.02);
        noise("lowpass", 600, 300, 1, 0.2, 0.2);
        break;
      case "snore": {
        osc("sine", 115 * p, 75 * p, 0.65, 0.12, 0.18);
        break;
      }
      case "step":
        osc("sine", 70, 38, 0.18, 0.7, 0.005);
        noise("lowpass", 300, 120, 1, 0.12, 0.25);
        break;
      case "thud":
        osc("sine", 110, 45, 0.2, 0.6, 0.005);
        noise("lowpass", 800, 200, 1, 0.15, 0.3);
        break;
      case "splash":
        noise("bandpass", 1600, 700, 0.8, 0.35, 0.45, 0.005);
        noise("highpass", 4000, 3000, 0.5, 0.2, 0.15, 0.01, 0.03);
        break;
      case "thunder":
        noise("lowpass", 1800, 120, 0.7, 0.2, 0.9, 0.005);
        noise("lowpass", 400, 60, 0.8, 2.6, 0.8, 0.08, 0.1);
        osc("sine", 50, 30, 2.2, 0.4, 0.1);
        break;
      case "rumble":
        noise("lowpass", 160, 60, 1, 3.2, 0.8, 0.6);
        osc("sine", 38, 30, 3, 0.5, 0.6);
        break;
      case "boom":
        noise("lowpass", 2000, 80, 0.7, 2.4, 1, 0.005);
        osc("sine", 90, 28, 1.8, 0.9, 0.005);
        break;
      case "ignite":
        osc("triangle", 190 * p, 460 * p, 0.25, 0.14, 0.02);
        break;
      case "chomp":
        noise("bandpass", 1200, 800, 2, 0.06, 0.5);
        noise("bandpass", 900, 600, 2, 0.06, 0.4, 0.002, 0.12);
        osc("sine", 160, 90, 0.1, 0.3);
        break;
      case "munch":
        noise("highpass", 2500, 2000, 1, 0.05, 0.25);
        noise("highpass", 2500, 2000, 1, 0.05, 0.2, 0.002, 0.1);
        break;
      case "crack":
        for (let i = 0; i < 4; i++) noise("highpass", 3000, 2500, 1, 0.03, 0.5, 0.001, i * 0.07);
        break;
      case "pop":
        osc("sine", 500, 1100, 0.12, 0.4, 0.005);
        break;
      case "click":
        osc("triangle", 900, 700, 0.05, 0.25, 0.003);
        break;
      case "sticker":
        [660, 880, 1320].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.value = f;
          const g = ctx.createGain();
          this.env(g, at + i * 0.09, 0.01, 0.3, 0.25);
          o.connect(g).connect(out);
          o.start(at + i * 0.09);
          o.stop(at + i * 0.09 + 0.3);
        });
        break;
      case "plop":
        osc("sine", 420, 140, 0.15, 0.4, 0.005);
        break;
      case "tussle":
        for (let i = 0; i < 6; i++) noise("bandpass", 400 + Math.random() * 600, 300, 1.5, 0.1, 0.4, 0.005, i * 0.18);
        break;
      case "bonk":
        osc("sine", 320, 140, 0.18, 0.7, 0.002);
        noise("bandpass", 1800, 1200, 3, 0.05, 0.4);
        break;
      case "whoosh": {
        osc("triangle", 220 * p, 620 * p, 0.38, 0.17, 0.06);
        break;
      }
      case "clack":
        osc("square", 1800, 1200, 0.04, 0.3, 0.001);
        break;
      case "chop":
      case "knock":
        osc("triangle", 260, 160, 0.08, 0.5, 0.002);
        noise("bandpass", 1000, 700, 2, 0.05, 0.3);
        break;
      case "build":
        for (let i = 0; i < 3; i++) {
          const t2 = at + i * 0.16;
          const o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.setValueAtTime(240, t2);
          o.frequency.exponentialRampToValueAtTime(150, t2 + 0.08);
          const g = ctx.createGain();
          this.env(g, t2, 0.002, 0.5, 0.1);
          o.connect(g).connect(out);
          o.start(t2);
          o.stop(t2 + 0.15);
        }
        break;
      case "timber":
        osc("sawtooth", 180, 90, 0.7, 0.15, 0.2);
        noise("lowpass", 900, 150, 1, 0.5, 0.6, 0.01, 0.6);
        break;
      case "cheer":
        for (let i = 0; i < 4; i++) {
          const f = ctx.createBiquadFilter();
          f.type = "bandpass";
          f.frequency.value = 900 + i * 120;
          f.Q.value = 4;
          f.connect(out);
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          const t2 = at + i * 0.05;
          o.frequency.setValueAtTime(260 + i * 40, t2);
          o.frequency.linearRampToValueAtTime(420 + i * 50, t2 + 0.3);
          o.frequency.linearRampToValueAtTime(360 + i * 40, t2 + 0.8);
          const g = ctx.createGain();
          this.env(g, t2, 0.05, 0.25, 0.8);
          o.connect(g).connect(f);
          o.start(t2);
          o.stop(t2 + 0.95);
        }
        break;
      case "yelp":
        osc("triangle", 600 * p, 1200 * p, 0.18, 0.35, 0.01);
        break;
      case "babble": {
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 800;
        f.Q.value = 3;
        f.connect(out);
        const syl = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < syl; i++) {
          const t2 = at + i * 0.17;
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.setValueAtTime((180 + Math.random() * 60) * p, t2);
          o.frequency.linearRampToValueAtTime((140 + Math.random() * 60) * p, t2 + 0.14);
          const g = ctx.createGain();
          this.env(g, t2, 0.02, 0.35, 0.13);
          o.connect(g).connect(f);
          o.start(t2);
          o.stop(t2 + 0.17);
        }
        break;
      }
      case "rustle":
        osc("triangle", 240 * p, 130 * p, 0.08, 0.09, 0.01);
        break;
      case "stampede":
        noise("lowpass", 200, 120, 1, 2.5, 0.7, 0.3);
        for (let i = 0; i < 12; i++) osc("sine", 70, 40, 0.12, 0.35, 0.005).frequency.setValueAtTime(70, at + i * 0.18);
        break;
      case "drums":
        // a war-drum beat: BOOM boom boom-BOOM
        [0, 0.32, 0.5, 0.82, 1.3, 1.62, 1.8, 2.12].forEach((dt, i) => {
          const t2 = at + dt;
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(i % 4 === 0 ? 95 : 130, t2);
          o.frequency.exponentialRampToValueAtTime(48, t2 + 0.25);
          const g = ctx.createGain();
          this.env(g, t2, 0.004, i % 4 === 0 ? 0.9 : 0.55, 0.3);
          o.connect(g).connect(out);
          o.start(t2);
          o.stop(t2 + 0.35);
        });
        break;
      case "evolve":
        // a rising shimmer
        [0, 0.08, 0.16, 0.24, 0.32, 0.4].forEach((dt, i) => {
          const t2 = at + dt;
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(440 * Math.pow(1.26, i), t2);
          o.frequency.exponentialRampToValueAtTime(440 * Math.pow(1.26, i) * 1.5, t2 + 0.5);
          const g = ctx.createGain();
          this.env(g, t2, 0.02, 0.18, 0.6);
          o.connect(g).connect(out);
          o.start(t2);
          o.stop(t2 + 0.7);
        });
        break;
      case "twang":
        osc("triangle", 520, 260, 0.12, 0.35, 0.002);
        noise("bandpass", 2500, 1500, 3, 0.06, 0.25);
        break;
      case "thunk":
        osc("sine", 180, 70, 0.1, 0.6, 0.002);
        noise("bandpass", 900, 500, 2, 0.06, 0.4);
        break;
      case "sizzle":
        osc("sine", 540 * p, 340 * p, 0.12, 0.08, 0.02);
        break;
      case "hum":
        // low, slightly beating drone of tuned stone
        osc("sine", 110 * p, 112 * p, 1.4, 0.22, 0.25);
        osc("sine", 165 * p, 166 * p, 1.4, 0.1, 0.3);
        osc("triangle", 220 * p, 221 * p, 1.2, 0.05, 0.3);
        break;
      case "chime":
        [784, 1046, 1318, 1568].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = f * p;
          const g = ctx.createGain();
          this.env(g, at + i * 0.07, 0.005, 0.18, 0.9);
          o.connect(g).connect(out);
          o.start(at + i * 0.07);
          o.stop(at + i * 0.07 + 1);
        });
        break;
      case "zap":
        osc("sawtooth", 1800 * p, 300 * p, 0.18, 0.18, 0.002);
        noise("bandpass", 4000, 1200, 3, 0.14, 0.3);
        osc("sine", 90, 60, 0.2, 0.3, 0.005);
        break;
      case "crack":
        noise("highpass", 3000, 1800, 1, 0.12, 0.6, 0.001);
        osc("triangle", 2400 * p, 1200 * p, 0.25, 0.12, 0.002);
        break;
      case "powerdown":
        osc("sawtooth", 420, 40, 1.1, 0.2, 0.01);
        osc("sine", 220, 30, 1.2, 0.25, 0.01);
        break;
      case "tick":
        osc("square", 1200 * p, 1200 * p, 0.05, 0.18, 0.002);
        osc("sine", 300, 200, 0.12, 0.25, 0.002);
        break;
      default:
        osc("sine", 440, 440, 0.1, 0.2);
    }
  }

  /* ----------------------------- ambience ----------------------------- */

  /** Occasional tonal bird calls; no continuous static or crackle. */
  updateBeds(b: Beds, dt: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    this.birdT -= dt;
    if (b.day > 0.4 && b.rain < 0.4 && this.birdT <= 0) {
      this.birdT = 1.5 + Math.random() * 4;
      this.bird(b.day);
    }
  }

  private bird(level: number) {
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.02;
    const out = this.out("ambient", 0.05 + level * 0.06, (Math.random() - 0.5) * 1.6);
    const base = 1800 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = "sine";
      const t = at + i * (0.1 + Math.random() * 0.06);
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.09);
      const g = ctx.createGain();
      this.env(g, t, 0.005, 0.5, 0.08);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.12);
    }
    window.setTimeout(() => out.disconnect(), 1500);
  }
}
