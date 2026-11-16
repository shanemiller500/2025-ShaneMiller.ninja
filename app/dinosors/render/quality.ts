/* ------------------------------------------------------------------ */
/*  Graphics quality. One shared, mutable config the painters read     */
/*  each frame (render-side only: the sim never looks at it).          */
/*  Low → Ultra trade pixels, shadows, light-map resolution, particle  */
/*  counts and water / post effects. "Auto" picks a preset from the    */
/*  device and steps down if frames get heavy.                         */
/* ------------------------------------------------------------------ */

export type QualityLevel = "low" | "medium" | "high" | "ultra";
export type QualityId = QualityLevel | "auto";

export interface QualityCfg {
  id: QualityLevel;
  /** most device pixels per CSS pixel the canvas will use */
  dprCap: number;
  /** baked terrain pixels per world pixel (texture sharpness when zoomed in) */
  terrainScale: number;
  /** light map resolution as a fraction of the screen */
  lightScale: number;
  /** 0 soft blobs · 1 sun-angled shadows · 2 + long shadows for buildings and walls */
  shadows: 0 | 1 | 2;
  /** particle spawn / draw multiplier */
  particles: number;
  /** soft sprite particles (off: plain dots) */
  softParticles: boolean;
  /** 0 flat · 1 caustics + glitter · 2 + sky reflections */
  water: 0 | 1 | 2;
  /** 0 none · 1 grading + vignette · 2 + bloom and sun shafts */
  post: 0 | 1 | 2;
  /** ambient life: motes, drifting leaves, grass sway (0..1.5) */
  ambient: number;
  /** gradient shading + highlights on creatures, plants and people */
  shading: boolean;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityCfg> = {
  low: { id: "low", dprCap: 1, terrainScale: 1, lightScale: 0.25, shadows: 0, particles: 0.45, softParticles: false, water: 0, post: 0, ambient: 0, shading: false },
  medium: { id: "medium", dprCap: 1.5, terrainScale: 1, lightScale: 0.4, shadows: 1, particles: 0.75, softParticles: true, water: 1, post: 1, ambient: 0.6, shading: true },
  high: { id: "high", dprCap: 2, terrainScale: 2, lightScale: 0.5, shadows: 2, particles: 1, softParticles: true, water: 2, post: 2, ambient: 1, shading: true },
  ultra: { id: "ultra", dprCap: 3, terrainScale: 2, lightScale: 0.75, shadows: 2, particles: 1.4, softParticles: true, water: 2, post: 2, ambient: 1.5, shading: true },
};

export const QUALITY_ORDER: QualityLevel[] = ["low", "medium", "high", "ultra"];

export const QUALITY_INFO: Record<QualityId, { name: string; hint: string }> = {
  auto: { name: "Auto", hint: "Picks the best look your device runs smoothly" },
  low: { name: "Low", hint: "Fastest: simple shadows, fewer effects" },
  medium: { name: "Medium", hint: "Balanced: soft effects, sun shadows" },
  high: { name: "High", hint: "Sharp terrain, reflections, bloom" },
  ultra: { name: "Ultra", hint: "Everything on, full 4K sharpness" },
};

/** The live config. Painters read it directly; change it only through setQuality. */
export const Q: QualityCfg = { ...QUALITY_PRESETS.high };

/** What the player picked ("auto" resolves to a level in Q.id). */
let picked: QualityId = "auto";
/** Bumped whenever Q changes, so caches keyed on quality know to rebuild. */
let version = 1;

export const qualityVersion = () => version;
export const pickedQuality = () => picked;

/** A sensible preset for this device: cores, memory, pointer type and screen size. */
export function detectQuality(): QualityLevel {
  if (typeof window === "undefined") return "high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const pixels = window.innerWidth * window.innerHeight * Math.min(3, window.devicePixelRatio || 1) ** 2;
  if (cores <= 2 || mem <= 2) return "low";
  if (touch) return cores >= 8 && mem >= 6 ? "high" : "medium";
  if (cores <= 4 || mem <= 4) return "medium";
  // a 4K panel at full pixel ratio is a lot of fill: keep Ultra for machines with the cores to spare
  if (cores >= 12 && mem >= 8 && pixels <= 3840 * 2160 * 1.05) return "ultra";
  return "high";
}

export function setQuality(id: QualityId) {
  picked = id;
  const level = id === "auto" ? detectQuality() : id;
  if (Q.id === level && version > 1) return false;
  Object.assign(Q, QUALITY_PRESETS[level]);
  version++;
  return true;
}

/** Auto mode only: drop one level (frames have been heavy for a while). Returns true if it changed. */
export function stepQualityDown() {
  if (picked !== "auto") return false;
  const i = QUALITY_ORDER.indexOf(Q.id);
  if (i <= 0) return false;
  Object.assign(Q, QUALITY_PRESETS[QUALITY_ORDER[i - 1]]);
  version++;
  return true;
}
