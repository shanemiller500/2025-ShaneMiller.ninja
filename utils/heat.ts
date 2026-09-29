/* ------------------------------------------------------------------ */
/*  Shared heat scale for the market dashboards (crypto + stocks)      */
/*  Tiles are shaded by % change — deeper color = bigger move.         */
/* ------------------------------------------------------------------ */

/** Thresholds (abs % change) that step up the intensity. */
export const HEAT_SCALES = {
  /** Crypto moves are big: 0.5 / 2 / 5 % */
  crypto: [0.5, 2, 5],
  /** Equities move less: 0.25 / 1 / 2.5 % */
  stocks: [0.25, 1, 2.5],
} as const;

type Scale = readonly number[];

const UP = [
  "bg-emerald-50 text-emerald-900 ring-emerald-200/70 dark:bg-emerald-400/[0.08] dark:text-emerald-100 dark:ring-emerald-400/15",
  "bg-emerald-100 text-emerald-950 ring-emerald-300/70 dark:bg-emerald-400/[0.18] dark:text-emerald-50 dark:ring-emerald-400/25",
  "bg-emerald-300 text-emerald-950 ring-emerald-400/70 dark:bg-emerald-500/40 dark:text-white dark:ring-emerald-400/40",
  "bg-emerald-500 text-white ring-emerald-600/60 dark:bg-emerald-500/70 dark:text-white dark:ring-emerald-300/50",
];

const DOWN = [
  "bg-rose-50 text-rose-900 ring-rose-200/70 dark:bg-rose-400/[0.08] dark:text-rose-100 dark:ring-rose-400/15",
  "bg-rose-100 text-rose-950 ring-rose-300/70 dark:bg-rose-400/[0.18] dark:text-rose-50 dark:ring-rose-400/25",
  "bg-rose-300 text-rose-950 ring-rose-400/70 dark:bg-rose-500/40 dark:text-white dark:ring-rose-400/40",
  "bg-rose-500 text-white ring-rose-600/60 dark:bg-rose-500/70 dark:text-white dark:ring-rose-300/50",
];

const FLAT =
  "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10";

/** Intensity 0–3 for an absolute % move. */
export function heatLevel(pct: number, scale: Scale = HEAT_SCALES.crypto): number {
  const a = Math.abs(pct);
  return scale.filter((s) => a >= s).length;
}

/** Tailwind classes (bg, text, ring) for a tile given its % change. */
export function heatTone(pct: number | null | undefined, scale: Scale = HEAT_SCALES.crypto): string {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return FLAT;
  return (pct > 0 ? UP : DOWN)[heatLevel(pct, scale)];
}

/** Legend swatches, strongest red → strongest green. */
export const HEAT_LEGEND = [DOWN[3], DOWN[2], DOWN[1], FLAT, UP[1], UP[2], UP[3]];

export const parsePct = (v: unknown): number => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/** Inset glow used to flash a tile on each live tick. */
export const tickGlow = (dir: "up" | "down") =>
  dir === "up"
    ? "inset 0 0 0 2px rgba(16,185,129,0.95), 0 0 22px rgba(16,185,129,0.55)"
    : "inset 0 0 0 2px rgba(244,63,94,0.95), 0 0 22px rgba(244,63,94,0.55)";
