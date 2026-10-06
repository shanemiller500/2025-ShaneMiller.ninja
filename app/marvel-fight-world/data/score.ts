/* ------------------------------------------------------------------ */
/*  Fight scoring. Every CPU fight earns points (local versus doesn't   */
/*  count — there's no one to credit fairly). Harder CPUs, stronger     */
/*  opponents, style (combos, perfects, ultimates, speed) and win       */
/*  streaks all pay; losing still earns a little for K.O.s and combos.  */
/* ------------------------------------------------------------------ */

import type { Difficulty } from "../engine/ai";
import type { FighterDef } from "../engine/types";

export const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 0.6, normal: 1, hard: 1.5, insane: 2.2 };

export interface ScoreLine {
  label: string;
  points: number;
}

export interface ScoreBreakdown {
  lines: ScoreLine[];
  total: number;
  won: boolean | null;
  /** Win streak after this fight */
  streak: number;
  bestStreak: number;
  newBestStreak: boolean;
}

export interface ScoreInput {
  won: boolean | null;
  difficulty: Difficulty;
  me: FighterDef;
  opponent: FighterDef;
  kos: number;
  perfects: number;
  maxCombo: number;
  ults: number;
  fastestKo: number | null;
  healthLeft: number;
  streakBefore: number;
  bestStreakBefore: number;
}

const power = (d: FighterDef) => Object.values(d.stats).reduce((a, b) => a + b, 0);

export function scoreMatch(i: ScoreInput): ScoreBreakdown {
  const mult = DIFFICULTY_MULT[i.difficulty];
  const lines: ScoreLine[] = [];
  const add = (label: string, pts: number) => {
    const p = Math.round(pts);
    if (p > 0) lines.push({ label, points: p });
  };

  const streak = i.won === true ? i.streakBefore + 1 : i.won === false ? 0 : i.streakBefore;
  if (i.won === true) {
    add(`Victory · ${i.difficulty} CPU`, 100 * mult);
    const ratio = power(i.opponent) / Math.max(1, power(i.me));
    if (ratio > 1.05) add("Underdog win", Math.min(150, (ratio - 1) * 160) * mult);
    add("Health left", i.healthLeft * 60 * mult);
    if (i.fastestKo !== null && i.fastestKo < 40) add("Speed K.O.", (40 - i.fastestKo) * 4 * mult);
    if (streak >= 2) add(`Win streak ×${streak}`, Math.min(400, streak * 20) * mult);
  } else if (i.won === null) {
    add("Draw", 30 * mult);
  } else {
    add("Fought hard", 10);
  }
  add(`K.O.${i.kos === 1 ? "" : "s"} ×${i.kos}`, i.kos * 25 * mult);
  add(`Perfect round${i.perfects === 1 ? "" : "s"}`, i.perfects * 75 * mult);
  if (i.maxCombo >= 3) add(`${i.maxCombo}-hit combo`, i.maxCombo * 8 * mult);
  add(`Ultimate${i.ults === 1 ? "" : "s"} landed`, i.ults * 20 * mult);

  const total = lines.reduce((a, l) => a + l.points, 0);
  const bestStreak = Math.max(i.bestStreakBefore, streak);
  return { lines, total, won: i.won, streak, bestStreak, newBestStreak: streak > i.bestStreakBefore && streak >= 2 };
}

/** Championship bonus for winning a tournament bracket. */
export const TOURNAMENT_BONUS = 500;
