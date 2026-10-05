/* ------------------------------------------------------------------ */
/*  Fight World audio — everything is synthesized with the Web Audio   */
/*  API (same approach as the Charles project): no sound files, no      */
/*  copyrighted audio. Unlocked on the first user gesture.              */
/* ------------------------------------------------------------------ */

import type { SfxKey } from "../engine/types";

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let sfxVolume = 0.8;
let musicVolume = 0.35;
let music: { stop: () => void } | null = null;

export function unlockAudio(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(comp);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicVolume;
    musicBus.connect(comp);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** True once a user gesture has created the audio context. */
export const audioReady = () => !!ctx;

function live(): Ctx | null {
  if (!ctx || !sfxBus) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setVolumes(sfx: number, mus: number) {
  sfxVolume = sfx;
  musicVolume = mus;
  if (ctx && sfxBus && musicBus) {
    sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.03);
    musicBus.gain.setTargetAtTime(mus, ctx.currentTime, 0.03);
  }
}

/* ── Building blocks ──────────────────────────────────────────────── */
function env(c: Ctx, out: AudioNode, at: number, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(out);
  return g;
}

function noiseBurst(c: Ctx, at: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1, sweepTo?: number) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  f.Q.value = q;
  src.connect(f);
  f.connect(env(c, sfxBus!, at, vol, 0.004, dur));
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.05);
}

function tone(c: Ctx, at: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.005) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  o.connect(env(c, sfxBus!, at, vol, attack, dur));
  o.start(at);
  o.stop(at + dur + attack + 0.05);
}

const vary = (v: number, amt = 0.08) => v * (1 + (Math.random() * 2 - 1) * amt);

/* ── Sound effects ────────────────────────────────────────────────── */
export function sfx(key: SfxKey, volume = 1) {
  const c = live();
  if (!c) return;
  const t = c.currentTime + 0.001;
  const v = volume;
  switch (key) {
    case "jab":
      noiseBurst(c, t, 0.07, 0.5 * v, "bandpass", vary(1800), 1.2);
      tone(c, t, "sine", vary(180), 70, 0.08, 0.5 * v);
      break;
    case "heavy":
      noiseBurst(c, t, 0.14, 0.7 * v, "lowpass", vary(1400), 0.8, 300);
      tone(c, t, "sine", vary(120), 40, 0.2, 0.9 * v);
      break;
    case "kick":
      noiseBurst(c, t, 0.1, 0.55 * v, "bandpass", vary(1100), 1);
      tone(c, t, "triangle", vary(150), 50, 0.12, 0.7 * v);
      break;
    case "whoosh":
      noiseBurst(c, t, 0.12, 0.18 * v, "bandpass", vary(700), 2, 2600);
      break;
    case "dodge":
      noiseBurst(c, t, 0.18, 0.25 * v, "bandpass", 2400, 3, 500);
      break;
    case "block":
      tone(c, t, "square", vary(900), 600, 0.06, 0.18 * v);
      tone(c, t, "triangle", vary(1400), 1200, 0.12, 0.2 * v);
      noiseBurst(c, t, 0.05, 0.3 * v, "highpass", 3000);
      break;
    case "jump":
      tone(c, t, "sine", 260, 520, 0.12, 0.12 * v);
      break;
    case "land":
      noiseBurst(c, t, 0.12, 0.4 * v, "lowpass", 400);
      tone(c, t, "sine", 90, 40, 0.15, 0.5 * v);
      break;
    case "throw":
      noiseBurst(c, t, 0.25, 0.4 * v, "bandpass", 500, 1, 1500);
      tone(c, t + 0.12, "sine", 110, 35, 0.3, 0.9 * v);
      noiseBurst(c, t + 0.12, 0.2, 0.6 * v, "lowpass", 900);
      break;
    case "energy":
      tone(c, t, "sawtooth", vary(300), 900, 0.22, 0.18 * v);
      tone(c, t, "sine", vary(600), 1400, 0.25, 0.18 * v);
      break;
    case "zap":
      tone(c, t, "square", vary(1200), 300, 0.16, 0.14 * v);
      noiseBurst(c, t, 0.12, 0.25 * v, "highpass", 2500);
      break;
    case "lightning":
      noiseBurst(c, t, 0.5, 0.8 * v, "highpass", 900, 0.7, 200);
      tone(c, t, "sawtooth", 90, 40, 0.5, 0.4 * v);
      for (let i = 0; i < 4; i++) tone(c, t + i * 0.03, "square", vary(2000, 0.3), 400, 0.05, 0.08 * v);
      break;
    case "explosion":
      noiseBurst(c, t, 0.7, 0.9 * v, "lowpass", 1200, 0.7, 80);
      tone(c, t, "sine", 80, 25, 0.6, 1 * v);
      break;
    case "web":
      noiseBurst(c, t, 0.12, 0.35 * v, "bandpass", 3500, 4, 1500);
      tone(c, t, "sine", 1600, 900, 0.08, 0.06 * v);
      break;
    case "slash":
      noiseBurst(c, t, 0.12, 0.5 * v, "highpass", vary(2500), 1, 6000);
      tone(c, t, "sawtooth", vary(1600), 700, 0.06, 0.08 * v);
      break;
    case "magic":
      for (let i = 0; i < 5; i++) tone(c, t + i * 0.035, "sine", vary(700 + i * 220), 1600 + i * 300, 0.18, 0.08 * v);
      break;
    case "smash":
      noiseBurst(c, t, 0.45, 1 * v, "lowpass", 900, 0.6, 60);
      tone(c, t, "sine", 70, 28, 0.5, 1.1 * v);
      break;
    case "gun":
      noiseBurst(c, t, 0.08, 0.7 * v, "highpass", 1200);
      tone(c, t, "square", 300, 80, 0.05, 0.25 * v);
      break;
    case "ko":
      tone(c, t, "sine", 160, 30, 1.2, 1 * v, 0.01);
      noiseBurst(c, t, 0.9, 0.9 * v, "lowpass", 1500, 0.7, 60);
      break;
    case "super":
      tone(c, t, "sawtooth", 110, 440, 0.6, 0.25 * v, 0.02);
      tone(c, t, "sawtooth", 165, 660, 0.6, 0.2 * v, 0.02);
      noiseBurst(c, t, 0.6, 0.35 * v, "bandpass", 500, 1, 5000);
      break;
    case "heal":
      for (let i = 0; i < 3; i++) tone(c, t + i * 0.08, "sine", 520 * (1 + i * 0.25), 600 * (1 + i * 0.25), 0.15, 0.1 * v);
      break;
    case "guardBreak":
      tone(c, t, "square", 900, 120, 0.3, 0.3 * v);
      noiseBurst(c, t, 0.3, 0.6 * v, "bandpass", 2000, 1, 300);
      break;
  }
}

/** Short announcer-ish stingers (synth, not voice). */
export function stinger(kind: "round" | "fight" | "win" | "select" | "confirm" | "back" | "hover") {
  const c = live();
  if (!c) return;
  const t = c.currentTime + 0.001;
  const notes: Record<typeof kind, [number, number][]> = {
    round: [[392, 0], [523, 0.12]],
    fight: [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.24]],
    win: [[523, 0], [659, 0.15], [784, 0.3], [1046, 0.45], [784, 0.6], [1046, 0.75]],
    select: [[880, 0]],
    confirm: [[660, 0], [990, 0.07]],
    back: [[500, 0], [330, 0.06]],
    hover: [[1200, 0]],
  };
  const vol = kind === "hover" ? 0.03 : kind === "select" ? 0.08 : 0.16;
  for (const [f, d] of notes[kind]) tone(c, t + d, "square", f, f, kind === "hover" ? 0.03 : 0.14, vol);
}

/* ── Music: a looping synth beat per arena mood ───────────────────── */
export function playMusic(mood: "menu" | "fight" | "world", tempo = 132) {
  stopMusic();
  const c = live();
  if (!c || !musicBus) return;
  const beat = 60 / tempo;
  const bass = mood === "menu" ? [55, 55, 65.4, 49] : mood === "world" ? [65.4, 73.4, 55, 61.7] : [55, 55, 82.4, 73.4];
  let next = c.currentTime + 0.05;
  let step = 0;
  let stopped = false;
  const out = musicBus;
  const schedule = () => {
    if (stopped || !ctx) return;
    while (next < ctx.currentTime + 0.4) {
      const bar = Math.floor(step / 8) % bass.length;
      const s = step % 8;
      // kick
      if (s % 4 === 0 || (mood === "fight" && s === 6)) {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(140, next);
        o.frequency.exponentialRampToValueAtTime(40, next + 0.12);
        o.connect(env(ctx, out, next, 0.55, 0.003, 0.16));
        o.start(next);
        o.stop(next + 0.2);
      }
      // hat
      if (mood !== "menu" || s % 2 === 1) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = 7000;
        src.connect(f);
        f.connect(env(ctx, out, next, s % 2 ? 0.08 : 0.04, 0.002, 0.04));
        src.start(next, Math.random() * 0.5);
        src.stop(next + 0.06);
      }
      // snare
      if (s === 4) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1800;
        src.connect(f);
        f.connect(env(ctx, out, next, 0.22, 0.002, 0.12));
        src.start(next, Math.random() * 0.5);
        src.stop(next + 0.15);
      }
      // bass
      if (s % 2 === 0) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = bass[bar] * (s === 6 ? 2 : 1);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = mood === "fight" ? 700 : 450;
        o.connect(lp);
        lp.connect(env(ctx, out, next, 0.16, 0.005, beat * 0.9));
        o.start(next);
        o.stop(next + beat);
      }
      // lead stab
      if (mood !== "menu" && (s === 3 || s === 7) && step % 32 > 15) {
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = bass[bar] * 8 * (s === 7 ? 1.5 : 1.335);
        o.connect(env(ctx, out, next, 0.035, 0.005, beat * 0.6));
        o.start(next);
        o.stop(next + beat);
      }
      next += beat / 2;
      step++;
    }
  };
  const id = window.setInterval(schedule, 100);
  schedule();
  music = {
    stop: () => {
      stopped = true;
      window.clearInterval(id);
    },
  };
}

export function stopMusic() {
  music?.stop();
  music = null;
}
