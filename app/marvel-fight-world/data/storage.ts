/* ------------------------------------------------------------------ */
/*  Local persistence (per browser). Every access is guarded: private   */
/*  windows / blocked storage just fall back to defaults.               */
/* ------------------------------------------------------------------ */

import { safeSetItem } from "@/utils/storageJanitor";
import type { Difficulty } from "../engine/ai";
import { DEFAULT_BINDINGS, type Bindings } from "../input/input";

const PREFIX = "fightworld:";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    // always hand back a fresh copy: callers mutate what they load (e.g. recordMatch)
    return { ...clone(fallback), ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return clone(fallback);
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
    safeSetItem(PREFIX + key, JSON.stringify(value));
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
  /** Leaderboard points (CPU fights only) */
  score: number;
  /** Current consecutive CPU wins */
  streak: number;
  bestStreak: number;
  bestStreakBy: string;
  bestStreakById: number | null;
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
  score: 0,
  streak: 0,
  bestStreak: 0,
  bestStreakBy: "",
  bestStreakById: null,
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
  /** Leaderboard points earned (0 / omitted for unscored local versus) */
  points?: number;
  /** Counts towards win streaks (CPU fights) */
  scored?: boolean;
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
  if (r.scored) {
    s.score = (s.score ?? 0) + Math.max(0, Math.round(r.points ?? 0));
    if (r.won === true) {
      s.streak = (s.streak ?? 0) + 1;
      if (s.streak > (s.bestStreak ?? 0)) {
        s.bestStreak = s.streak;
        s.bestStreakBy = r.fighterName;
        s.bestStreakById = r.fighterId;
      }
    } else if (r.won === false) s.streak = 0;
  }
  saveStats(s);
  return s;
}

/** The fighter you've won the most with (ties → most picked). */
export function mainFighter(s: Stats): { id: number; name: string } | null {
  let best: { id: number; name: string; w: number; p: number } | null = null;
  for (const [id, r] of Object.entries(s.fighters)) {
    if (!best || r.wins > best.w || (r.wins === best.w && r.picks > best.p)) best = { id: Number(id), name: r.name, w: r.wins, p: r.picks };
  }
  return best ? { id: best.id, name: best.name } : null;
}

export function recordSurvival(streak: number) {
  const s = loadStats();
  s.survivalBest = Math.max(s.survivalBest, streak);
  saveStats(s);
}

export function recordTournamentWin(bonus = 0) {
  const s = loadStats();
  s.tournamentWins++;
  s.score = (s.score ?? 0) + bonus;
  saveStats(s);
}

/* ── Fight World exploring (fighter + where you are) ───────────────── */
export interface WorldProgress {
  playerId: number | null;
  zone: string | null;
  x: number;
}
export const EMPTY_WORLD: WorldProgress = { playerId: null, zone: null, x: -900 };
export const loadWorldProgress = (): WorldProgress => read("world", EMPTY_WORLD);
export const saveWorldProgress = (w: WorldProgress) => write("world", w);

/* ── Player profile (leaderboard name) ─────────────────────────────── */
export interface Profile {
  name: string;
}
export const EMPTY_PROFILE: Profile = { name: "" };
export const loadProfile = (): Profile => read("profile", EMPTY_PROFILE);
export const saveProfile = (p: Profile) => write("profile", p);

/** Leaderboard names: 2–20 letters, numbers, spaces and . _ - ' */
export const cleanName = (n: string) => n.replace(/\s+/g, " ").trim().slice(0, 20);
export const validName = (n: string) => /^[A-Za-z0-9À-ɏ ._'-]{2,20}$/.test(cleanName(n));

/* ── Whole-profile bundle (cloud saves) ────────────────────────────── */
export interface ProgressBundle {
  v: 1;
  settings: Settings;
  favorites: number[];
  recent: number[];
  stats: Stats;
  world: WorldProgress;
  profile?: Profile;
}

export function exportProgress(): ProgressBundle {
  return { v: 1, settings: loadSettings(), favorites: loadFavorites(), recent: loadRecent(), stats: loadStats(), world: loadWorldProgress(), profile: loadProfile() };
}

/** Replace everything stored locally with a saved bundle. */
export function importProgress(json: string): boolean {
  try {
    const b = JSON.parse(json) as Partial<ProgressBundle>;
    if (b?.v !== 1) return false;
    if (b.settings) write("settings", b.settings);
    if (Array.isArray(b.favorites)) write("favorites", b.favorites);
    if (Array.isArray(b.recent)) write("recent", b.recent);
    if (b.stats) write("stats", { ...EMPTY_STATS, ...b.stats });
    if (b.world) write("world", { ...EMPTY_WORLD, ...b.world });
    // Keep a locally chosen name if the cloud save doesn't have one yet
    if (b.profile?.name) write("profile", { ...EMPTY_PROFILE, ...b.profile });
    return true;
  } catch {
    return false;
  }
}
