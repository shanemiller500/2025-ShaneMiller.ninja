/* ------------------------------------------------------------------ */
/*  Local persistence: settings, favourites, recents and match stats    */
/*  (localStorage only — no accounts, every read/write is guarded).      */
/* ------------------------------------------------------------------ */

import type { Difficulty } from "../engine/ai";
import { DEFAULT_BINDINGS, type Bindings } from "../engine/input";
import type { BloodLevel } from "../render/particles";

const KEY = "mfw:save:v1";

export interface Settings {
  difficulty: Difficulty;
  sfx: number;
  music: number;
  blood: BloodLevel;
  showHitboxes: boolean;
  rounds: 1 | 2 | 3;
  bindings: [Bindings, Bindings];
  touchControls: "auto" | "on" | "off";
}

export interface FighterRecord {
  played: number;
  wins: number;
}

export interface Stats {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  kos: number;
  perfects: number;
  biggestCombo: number;
  fastestKo: number | null;
  survivalBest: number;
  tournamentsWon: number;
  byFighter: Record<string, FighterRecord>;
}

export interface Save {
  settings: Settings;
  favorites: number[];
  recent: number[];
  stats: Stats;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "normal",
  sfx: 0.8,
  music: 0.35,
  blood: "light",
  showHitboxes: false,
  rounds: 2,
  bindings: DEFAULT_BINDINGS,
  touchControls: "auto",
};

const emptyStats = (): Stats => ({
  matches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  kos: 0,
  perfects: 0,
  biggestCombo: 0,
  fastestKo: null,
  survivalBest: 0,
  tournamentsWon: 0,
  byFighter: {},
});

export function loadSave(): Save {
  const fresh: Save = { settings: { ...DEFAULT_SETTINGS }, favorites: [], recent: [], stats: emptyStats() };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const s = JSON.parse(raw) as Partial<Save>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
      favorites: Array.isArray(s.favorites) ? s.favorites : [],
      recent: Array.isArray(s.recent) ? s.recent : [],
      stats: { ...emptyStats(), ...(s.stats ?? {}) },
    };
  } catch {
    return fresh;
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / blocked: the game still works this session */
  }
}

export function pushRecent(s: Save, id: number): Save {
  return { ...s, recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 12) };
}

export interface MatchResult {
  /** Fighter ids [p1, p2] and names */
  ids: [number, number];
  names: [string, string];
  /** Which sides were human-controlled */
  human: [boolean, boolean];
  winner: 0 | 1 | null;
  kos: [number, number];
  perfects: [number, number];
  maxCombo: [number, number];
  fastestKo: number | null;
}

/** Fold a finished match into the local stats (from the human players' point of view). */
export function recordMatch(s: Save, r: MatchResult): Save {
  const st: Stats = { ...s.stats, byFighter: { ...s.stats.byFighter } };
  st.matches++;
  for (const side of [0, 1] as const) {
    if (!r.human[side]) continue;
    const rec = { ...(st.byFighter[r.names[side]] ?? { played: 0, wins: 0 }) };
    rec.played++;
    if (r.winner === side) rec.wins++;
    st.byFighter[r.names[side]] = rec;
    st.kos += r.kos[side];
    st.perfects += r.perfects[side];
    st.biggestCombo = Math.max(st.biggestCombo, r.maxCombo[side]);
  }
  const humanSide = r.human[0] ? 0 : r.human[1] ? 1 : null;
  const versusCpu = r.human[0] !== r.human[1];
  if (r.winner === null) st.draws++;
  else if (versusCpu && humanSide !== null) {
    if (r.winner === humanSide) st.wins++;
    else st.losses++;
  } else st.wins++; // local VS: somebody at the keyboard won
  if (r.fastestKo !== null && (humanSide === null || r.winner === humanSide || !versusCpu)) {
    st.fastestKo = st.fastestKo === null ? r.fastestKo : Math.min(st.fastestKo, r.fastestKo);
  }
  return { ...s, stats: st };
}

export function resetStats(s: Save): Save {
  return { ...s, stats: emptyStats() };
}
