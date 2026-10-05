/* ------------------------------------------------------------------ */
/*  Local persistence (per browser). Every access is guarded: private   */
/*  windows / blocked storage just fall back to defaults.               */
/* ------------------------------------------------------------------ */

import type { Difficulty } from "../engine/ai";
import { DEFAULT_BINDINGS, type Bindings } from "../input/input";

const PREFIX = "fightworld:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/* ── Settings ──────────────────────────────────────────────────────── */
export type BloodLevel = "off" | "light" | "arcade";

export interface Settings {
  difficulty: Difficulty;
  sfxVolume: number;
  musicVolume: number;
  blood: BloodLevel;
  roundsToWin: 1 | 2;
  screenShake: boolean;
  announcer: boolean;
  showHitboxes: boolean;
  bindings: [Bindings, Bindings];
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "normal",
  sfxVolume: 0.8,
  musicVolume: 0.35,
  blood: "light",
  roundsToWin: 2,
  screenShake: true,
  announcer: true,
  showHitboxes: false,
  bindings: DEFAULT_BINDINGS,
};

export const loadSettings = (): Settings => {
  const s = read("settings", DEFAULT_SETTINGS);
  // Merge bindings defensively (new actions added later get defaults)
  const b = s.bindings ?? DEFAULT_BINDINGS;
  s.bindings = [0, 1].map((i) => ({ ...DEFAULT_BINDINGS[i], ...(b[i] ?? {}) })) as [Bindings, Bindings];
  return s;
};
export const saveSettings = (s: Settings) => write("settings", s);

/* ── Favorites / recent ────────────────────────────────────────────── */
export const loadFavorites = () => readArray<number>("favorites");
export const saveFavorites = (ids: number[]) => write("favorites", ids);
export const loadRecent = () => readArray<number>("recent");
export function pushRecent(id: number) {
  const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 12);
  write("recent", next);
  return next;
}

/* ── Match statistics ──────────────────────────────────────────────── */
export interface FighterRecord {
  picks: number;
  wins: number;
  losses: number;
  kos: number;
}

export interface Stats {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  knockouts: number;
  perfects: number;
  biggestCombo: number;
  biggestComboBy: string;
  fastestKo: number | null;
  fastestKoBy: string;
  survivalBest: number;
  tournamentWins: number;
  fighters: Record<string, FighterRecord & { name: string }>;
}

export const EMPTY_STATS: Stats = {
  matches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  knockouts: 0,
  perfects: 0,
  biggestCombo: 0,
  biggestComboBy: "",
  fastestKo: null,
  fastestKoBy: "",
  survivalBest: 0,
  tournamentWins: 0,
  fighters: {},
};

export const loadStats = (): Stats => read("stats", EMPTY_STATS);
export const saveStats = (s: Stats) => write("stats", s);
export const resetStats = () => write("stats", EMPTY_STATS);

export interface MatchRecord {
  /** Human player's fighter (player 1 in versus) */
  fighterId: number;
  fighterName: string;
  opponentId: number;
  opponentName: string;
  won: boolean | null;
  kos: number;
  perfects: number;
  maxCombo: number;
  fastestKo: number | null;
}

export function recordMatch(r: MatchRecord) {
  const s = loadStats();
  s.matches++;
  if (r.won === true) s.wins++;
  else if (r.won === false) s.losses++;
  else s.draws++;
  s.knockouts += r.kos;
  s.perfects += r.perfects;
  if (r.maxCombo > s.biggestCombo) {
    s.biggestCombo = r.maxCombo;
    s.biggestComboBy = r.fighterName;
  }
  if (r.fastestKo !== null && (s.fastestKo === null || r.fastestKo < s.fastestKo)) {
    s.fastestKo = Math.round(r.fastestKo * 10) / 10;
    s.fastestKoBy = r.fighterName;
  }
  const f = (s.fighters[r.fighterId] ??= { name: r.fighterName, picks: 0, wins: 0, losses: 0, kos: 0 });
  f.name = r.fighterName;
  f.picks++;
  if (r.won === true) f.wins++;
  if (r.won === false) f.losses++;
  f.kos += r.kos;
  saveStats(s);
  return s;
}

export function recordSurvival(streak: number) {
  const s = loadStats();
  s.survivalBest = Math.max(s.survivalBest, streak);
  saveStats(s);
}

export function recordTournamentWin() {
  const s = loadStats();
  s.tournamentWins++;
  saveStats(s);
}
