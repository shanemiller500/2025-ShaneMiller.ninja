/* ------------------------------------------------------------------ */
/*  Charles audio: synthesized barks/farts + AI voice with lip sync    */
/* ------------------------------------------------------------------ */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let muted = false;

/** Must be called from a user gesture before audio can play. */
export function unlockAudio(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume();
  void loadBarks();
  return ctx;
}

/** The context only if a user gesture already created it (no autoplay warnings). */
function live(): Ctx | null {
  if (!ctx) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isAudioUnlocked() {
  return !!ctx && ctx.state === "running";
}

export function setMuted(value: boolean) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.9, ctx.currentTime, 0.02);
  if (value && typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function noiseBuffer(c: Ctx, seconds: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** One gruff "woof". Pitch varies so repeated barks don't sound canned. */
function woof(c: Ctx, at: number, pitch = 1) {
  if (!master) return;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.9, at + 0.012);
  out.gain.exponentialRampToValueAtTime(0.25, at + 0.09);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  out.connect(analyser ?? master);

  const formant = c.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.setValueAtTime(1100 * pitch, at);
  formant.frequency.exponentialRampToValueAtTime(600 * pitch, at + 0.18);
  formant.Q.value = 1.4;
  formant.connect(out);

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(420 * pitch, at);
  osc.frequency.exponentialRampToValueAtTime(170 * pitch, at + 0.2);
  osc.connect(formant);
  osc.start(at);
  osc.stop(at + 0.24);

  const growl = c.createOscillator();
  growl.type = "square";
  growl.frequency.setValueAtTime(95 * pitch, at);
  const growlGain = c.createGain();
  growlGain.gain.value = 0.18;
  growl.connect(growlGain).connect(formant);
  growl.start(at);
  growl.stop(at + 0.2);

  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 0.2);
  const nf = c.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 1800 * pitch;
  const ng = c.createGain();
  ng.gain.value = 0.35;
  n.connect(nf).connect(ng).connect(out);
  n.start(at);
}

/* ---------- real barks: a recorded big-dog bark sprite ---------- */
// Five single barks, one per second, cut from CC BY-SA recordings on Wikimedia Commons
// ("Rottweiler Barking" by MichaeltheFox8621, "Dog barking" by Dr. Nono YesMaybe).
const BARK_SPRITE = "/sounds/charles-barks.mp3";
const BARK_SLOTS: [number, number][] = [
  [0, 0.34],
  [1, 0.36],
  [2, 0.35],
  [3, 0.35],
  [4, 0.39],
];
let barkBuffer: AudioBuffer | null = null;
let barkLoading: Promise<void> | null = null;

/** Fetch + decode the bark recordings once (after the first user gesture). */
export function loadBarks() {
  const c = live();
  if (!c || barkBuffer || barkLoading) return barkLoading ?? Promise.resolve();
  barkLoading = fetch(BARK_SPRITE)
    .then((r) => r.arrayBuffer())
    .then((bytes) => c.decodeAudioData(bytes))
    .then((buf) => {
      barkBuffer = buf;
    })
    .catch(() => {
      barkLoading = null;
    });
  return barkLoading;
}

/** Bark 1-3 times with the real recording (synth fallback). Returns the duration in ms. */
export function bark(times = 1 + Math.floor(Math.random() * 2)): number {
  const c = live();
  if (!c || muted) return 330 * times;
  if (!barkBuffer) {
    void loadBarks();
    const base = 0.9 + Math.random() * 0.25;
    for (let i = 0; i < times; i++) woof(c, c.currentTime + i * 0.26, base + (Math.random() - 0.5) * 0.08);
    return 260 * times;
  }
  let at = c.currentTime + 0.01;
  let last = -1;
  for (let i = 0; i < times; i++) {
    let pick = Math.floor(Math.random() * BARK_SLOTS.length);
    if (pick === last) pick = (pick + 1) % BARK_SLOTS.length;
    last = pick;
    const [offset, len] = BARK_SLOTS[pick];
    const src = c.createBufferSource();
    src.buffer = barkBuffer;
    // a touch deeper: he's a Lab/Chow, not a chihuahua
    src.playbackRate.value = 0.86 + Math.random() * 0.1;
    const g = c.createGain();
    g.gain.value = 0.95;
    src.connect(g).connect(analyser ?? master!);
    src.start(at, offset, len);
    at += len / src.playbackRate.value + 0.06 + Math.random() * 0.08;
  }
  return Math.round((at - c.currentTime) * 1000);
}

/** A long, wobbly, deeply unnecessary fart. */
export function fart(big = false) {
  const c = live();
  if (!c || muted || !master) return;
  const at = c.currentTime;
  const dur = big ? 1.4 : 0.8 + Math.random() * 0.4;

  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.7, at + 0.05);
  out.gain.setValueAtTime(0.7, at + dur * 0.7);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  out.connect(master);

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  lp.Q.value = 6;
  lp.connect(out);

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, at);
  osc.frequency.linearRampToValueAtTime(60, at + dur);
  // flutter
  const lfo = c.createOscillator();
  lfo.frequency.setValueAtTime(18, at);
  lfo.frequency.linearRampToValueAtTime(9, at + dur);
  const lfoGain = c.createGain();
  lfoGain.gain.value = 28;
  lfo.connect(lfoGain).connect(osc.frequency);
  osc.connect(lp);

  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, dur);
  const ng = c.createGain();
  ng.gain.value = 0.25;
  n.connect(ng).connect(lp);

  osc.start(at);
  lfo.start(at);
  n.start(at);
  osc.stop(at + dur);
  lfo.stop(at + dur);
}

/** Crunchy snack noises. */
export function crunch() {
  const c = live();
  if (!c || muted || !master) return;
  for (let i = 0; i < 4; i++) {
    const at = c.currentTime + i * 0.11 + Math.random() * 0.03;
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, 0.07);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000 + Math.random() * 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.6, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    n.connect(hp).connect(g).connect(master);
    n.start(at);
  }
}

/** A cartoon slide whistle for jumps, treats and thrown objects. */
export function whoosh(up = true) {
  const c = live();
  if (!c || muted || !master) return;
  const at = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(up ? 300 : 900, at);
  osc.frequency.exponentialRampToValueAtTime(up ? 900 : 250, at + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.15, at + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
  osc.connect(g).connect(master);
  osc.start(at);
  osc.stop(at + 0.4);
}

/** Small splat for poop landings and stink-bomb pops. */
export function splat() {
  const c = live();
  if (!c || muted || !master) return;
  const at = c.currentTime;
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 0.25);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, at);
  lp.frequency.exponentialRampToValueAtTime(120, at + 0.25);
  const g = c.createGain();
  g.gain.setValueAtTime(0.8, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
  n.connect(lp).connect(g).connect(master);
  n.start(at);
}

/* ------------------------------------------------------------------ */
/*  Voice                                                              */
/* ------------------------------------------------------------------ */

/** Fetches OpenAI TTS for one segment. Resolves null if voice is unavailable. */
let voiceOffline = false;

export async function fetchVoice(text: string, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const c = live();
  if (!c || voiceOffline) return null;
  try {
    const res = await fetch("/api/charles/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (res.status === 503) voiceOffline = true;
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return await c.decodeAudioData(bytes);
  } catch {
    return null;
  }
}

/** Plays a decoded voice clip through the analyser (so the jaw can follow it). */
export function playBuffer(buffer: AudioBuffer, signal?: AbortSignal): Promise<void> {
  const c = live();
  if (!c || !analyser) return Promise.resolve();
  return new Promise((resolve) => {
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(analyser!);
    src.onended = () => resolve();
    signal?.addEventListener("abort", () => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      resolve();
    });
    src.start();
  });
}

/** Browser speech fallback when the AI voice is off or unavailable. */
export function speakWithBrowser(text: string, signal?: AbortSignal): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis || muted) {
    // Still leave time for the bubble to be read.
    return new Promise((r) => setTimeout(r, Math.min(4000, 400 + text.length * 45)));
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    // Charles is an Aussie. Prefer an Australian male voice, then any Australian, then any English.
    const preferred =
      voices.find((v) => /en[-_]AU/i.test(v.lang) && /male|james|lee|william|liam|gordon|russell/i.test(v.name)) ??
      voices.find((v) => /en[-_]AU/i.test(v.lang)) ??
      voices.find((v) => /en-(US|GB)/i.test(v.lang) && /male|daniel|david|guy|george|arthur/i.test(v.name)) ??
      voices.find((v) => /^en/i.test(v.lang));
    if (preferred) {
      u.voice = preferred;
      u.lang = preferred.lang;
    }
    u.pitch = 0.8;
    u.rate = 1.02;
    const done = () => resolve();
    u.onend = done;
    u.onerror = done;
    signal?.addEventListener("abort", () => {
      window.speechSynthesis.cancel();
      resolve();
    });
    window.speechSynthesis.speak(u);
  });
}

const levelData = new Uint8Array(256);
/** Current loudness 0..1 of everything routed through the analyser. */
export function voiceLevel(): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(levelData);
  let sum = 0;
  for (let i = 0; i < levelData.length; i++) {
    const v = (levelData[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / levelData.length) * 4);
}

/** Classic two-tone doorbell. The worst sound in the world, per Charles. */
export function dingDong() {
  const c = live();
  if (!c || muted || !master) return;
  const tones: [number, number][] = [
    [659.25, 0],
    [523.25, 0.55],
  ];
  for (const [freq, offset] of tones) {
    const at = c.currentTime + offset;
    for (const [mult, vol] of [
      [1, 0.35],
      [2.01, 0.08],
      [3.02, 0.04],
    ]) {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
      osc.connect(g).connect(master);
      osc.start(at);
      osc.stop(at + 1.5);
    }
  }
}

/** A gust of wind through the aspens. */
export function windGust() {
  const c = live();
  if (!c || muted || !master) return;
  const at = c.currentTime;
  const dur = 2.2;
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, dur);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(300, at);
  bp.frequency.linearRampToValueAtTime(900, at + dur * 0.5);
  bp.frequency.linearRampToValueAtTime(400, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.35, at + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  n.connect(bp).connect(g).connect(master);
  n.start(at);
}

/** A car driving past: engine hum + tire hiss that swells and drops pitch (Doppler). */
export function carPass(seconds = 2.4) {
  const c = live();
  if (!c || muted || !master) return;
  const at = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.32, at + seconds * 0.5);
  out.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  out.connect(master);

  const eng = c.createOscillator();
  eng.type = "sawtooth";
  eng.frequency.setValueAtTime(96, at);
  eng.frequency.setValueAtTime(96, at + seconds * 0.45);
  eng.frequency.exponentialRampToValueAtTime(70, at + seconds * 0.6);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  const eg = c.createGain();
  eg.gain.value = 0.5;
  eng.connect(lp).connect(eg).connect(out);

  const hiss = c.createBufferSource();
  hiss.buffer = noiseBuffer(c, seconds);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(900, at);
  bp.frequency.exponentialRampToValueAtTime(500, at + seconds);
  bp.Q.value = 0.7;
  const hg = c.createGain();
  hg.gain.value = 0.6;
  hiss.connect(bp).connect(hg).connect(out);

  eng.start(at);
  eng.stop(at + seconds);
  hiss.start(at);
}

/** A bull elk's bugle: a rising, wavering whistle. */
export function elkBugle() {
  const c = live();
  if (!c || muted || !master) return;
  const at = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, at);
  osc.frequency.exponentialRampToValueAtTime(1500, at + 0.7);
  osc.frequency.setValueAtTime(1500, at + 1.3);
  osc.frequency.exponentialRampToValueAtTime(700, at + 1.7);
  const vib = c.createOscillator();
  vib.frequency.value = 7;
  const vg = c.createGain();
  vg.gain.value = 22;
  vib.connect(vg).connect(osc.frequency);
  const harm = c.createOscillator();
  harm.type = "triangle";
  harm.frequency.setValueAtTime(260, at);
  harm.frequency.exponentialRampToValueAtTime(750, at + 0.7);
  harm.frequency.exponentialRampToValueAtTime(350, at + 1.7);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.12, at + 0.2);
  g.gain.setValueAtTime(0.12, at + 1.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
  osc.connect(g);
  harm.connect(g);
  g.connect(master);
  for (const o of [osc, vib, harm]) {
    o.start(at);
    o.stop(at + 1.9);
  }
}

/** A low moose grunt or two. */
export function mooseGrunt() {
  const c = live();
  if (!c || muted || !master) return;
  for (let i = 0; i < 2; i++) {
    const at = c.currentTime + i * 0.55;
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(95, at);
    osc.frequency.exponentialRampToValueAtTime(60, at + 0.35);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.4, at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    osc.connect(lp).connect(g).connect(master);
    osc.start(at);
    osc.stop(at + 0.45);
  }
}

/** A low, rumbling bear growl. */
export function bearGrowl() {
  const c = live();
  if (!c || muted || !master) return;
  const at = c.currentTime;
  const dur = 1.4;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(70, at);
  osc.frequency.linearRampToValueAtTime(55, at + dur);
  const trem = c.createOscillator();
  trem.frequency.value = 14;
  const tg = c.createGain();
  tg.gain.value = 0.25;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.45, at + 0.15);
  g.gain.setValueAtTime(0.45, at + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  trem.connect(tg).connect(g.gain);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 380;
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, dur);
  const nf = c.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 240;
  const ng = c.createGain();
  ng.gain.value = 0.5;
  osc.connect(lp).connect(g);
  n.connect(nf).connect(ng).connect(g);
  g.connect(master);
  osc.start(at);
  trem.start(at);
  n.start(at);
  osc.stop(at + dur);
  trem.stop(at + dur);
}
