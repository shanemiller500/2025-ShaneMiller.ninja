/* ------------------------------------------------------------------ */
/*  8-fighter single-elimination bracket. The player's matches are      */
/*  fought for real; every other pairing is simulated headlessly with   */
/*  the same engine (AI vs AI at "hard"), so upsets happen naturally.   */
/* ------------------------------------------------------------------ */

import { AIController } from "../engine/ai";
import { Match } from "../engine/match";
import type { FighterDef } from "../engine/types";

export interface Bout {
  a: FighterDef;
  b: FighterDef;
  winner: FighterDef | null;
  /** "player" when the human fights in it */
  player: boolean;
}

export interface Bracket {
  playerId: number;
  rounds: Bout[][];
  /** Index of the round currently being played */
  current: number;
  /** null while running, true = champion, false = eliminated */
  result: boolean | null;
}

export const ROUND_NAMES = ["Quarter-finals", "Semi-finals", "Final"];

export function newBracket(player: FighterDef, pool: FighterDef[]): Bracket {
  const others = pool.filter((d) => d.id !== player.id);
  const picks: FighterDef[] = [];
  while (picks.length < 7 && others.length) picks.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
  const seeds = [player, ...picks];
  const first: Bout[] = [];
  for (let i = 0; i < 8; i += 2) first.push({ a: seeds[i], b: seeds[i + 1], winner: null, player: i === 0 });
  return { playerId: player.id, rounds: [first], current: 0, result: null };
}

/** Run one AI-vs-AI match to completion (≈ a few ms). */
export function simulate(a: FighterDef, b: FighterDef, seed = Math.floor(Math.random() * 1e9)): FighterDef {
  const m = new Match({ p1: a, p2: b, roundsToWin: 1, seed });
  const ca = new AIController("hard", seed + 1);
  const cb = new AIController("hard", seed + 2);
  for (let i = 0; i < 60 * 60 * 3 && m.phase !== "over"; i++) {
    m.step([ca.tick(m.fighters[0], m.fighters[1], m), cb.tick(m.fighters[1], m.fighters[0], m)]);
  }
  if (m.winner === 0) return a;
  if (m.winner === 1) return b;
  return m.fighters[0].health / a.maxHealth >= m.fighters[1].health / b.maxHealth ? a : b;
}

export function playerBout(br: Bracket): Bout | undefined {
  return br.rounds[br.current]?.find((b) => b.player);
}

/** Record the player's result, simulate the rest of the round and seed the next one. */
export function advance(br: Bracket, playerWon: boolean): Bracket {
  const rounds = br.rounds.map((r) => r.map((b) => ({ ...b })));
  const round = rounds[br.current];
  for (const bout of round) {
    if (bout.player) bout.winner = playerWon ? (bout.a.id === br.playerId ? bout.a : bout.b) : bout.a.id === br.playerId ? bout.b : bout.a;
    else if (!bout.winner) bout.winner = simulate(bout.a, bout.b);
  }
  if (!playerWon) {
    // Finish the bracket without the player so the champion is shown
    let cur = round;
    while (cur.length > 1) {
      const next: Bout[] = [];
      for (let i = 0; i < cur.length; i += 2) {
        const a = cur[i].winner!;
        const b = cur[i + 1].winner!;
        next.push({ a, b, winner: simulate(a, b), player: false });
      }
      rounds.push(next);
      cur = next;
    }
    return { ...br, rounds, current: rounds.length - 1, result: false };
  }
  if (round.length === 1) return { ...br, rounds, result: true };
  const next: Bout[] = [];
  for (let i = 0; i < round.length; i += 2) {
    const a = round[i].winner!;
    const b = round[i + 1].winner!;
    next.push({ a, b, winner: null, player: a.id === br.playerId || b.id === br.playerId });
  }
  rounds.push(next);
  return { ...br, rounds, current: br.current + 1 };
}
