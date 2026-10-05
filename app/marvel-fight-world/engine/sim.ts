/* ------------------------------------------------------------------ */
/*  Headless CPU-vs-CPU matches (tournament brackets, balance tests)    */
/* ------------------------------------------------------------------ */

import { FightAI, type Difficulty } from "./ai";
import { Match } from "./match";
import type { FighterDef } from "./types";

/** Run a full one-round match off-screen and return the winning side. */
export function simulateMatch(p1: FighterDef, p2: FighterDef, seed = 1, difficulty: Difficulty = "hard"): 0 | 1 {
  const m = new Match({ p1, p2, roundsToWin: 1, roundSeconds: 60, seed });
  const a = new FightAI(0, difficulty, seed);
  const b = new FightAI(1, difficulty, seed + 1);
  for (let i = 0; i < 60 * 75 && m.phase !== "over"; i++) {
    m.step([a.update(m), b.update(m)]);
    m.events.length = 0;
  }
  if (m.winner !== null) return m.winner;
  const [x, y] = m.fighters;
  return x.health / x.def.maxHealth >= y.health / y.def.maxHealth ? 0 : 1;
}
