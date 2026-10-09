/* Single elimination. CPU bouts use the same Match and AIController as live play. */
import { AIController, type Difficulty } from "../engine/ai";
import { Match } from "../engine/match";
import type { FighterDef } from "../engine/types";

export interface Bout {
  a: FighterDef;
  b: FighterDef;
  winner: FighterDef | null;
  player: boolean;
  seedA: number;
  seedB: number;
  ko?: boolean;
  result?: string;
}
export interface Bracket {
  playerId: number;
  rounds: Bout[][];
  current: number;
  result: boolean | null;
  size: number;
}

export const roundName = (size: number, round: number) => {
  const remaining = size >> round;
  return remaining === 2 ? "Final" : remaining === 4 ? "Semifinal" : remaining === 8 ? "Quarterfinal" : `Round of ${remaining}`;
};

export const rating = (d: FighterDef) => Math.round(
  d.stats.combat * 0.23 + d.stats.speed * 0.14 + d.stats.strength * 0.14 +
  d.stats.durability * 0.15 + d.stats.power * 0.13 + d.stats.intelligence * 0.11 +
  (d.custom ? 8 : 0) + (d.moves.s1.projectile ? 3 : 0)
);
export const boutSeed = (br: Bracket, index: number) => ((br.playerId * 73856093) ^ (br.current * 19349663) ^ (index * 83492791)) >>> 0;

/** Standard high/low seed placement keeps the top seeds on opposite halves. */
function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const span = order.length * 2 + 1;
    order = order.flatMap((n) => [n, span - n]);
  }
  return order;
}
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newBracket(player: FighterDef, pool: FighterDef[], random = false, requested?: 8 | 16 | 32 | 64): Bracket {
  const unique = Array.from(new Map([player, ...pool].map((d) => [d.id, d])).values());
  const size = requested && unique.length >= requested ? requested : unique.length >= 32 ? 32 : unique.length >= 16 ? 16 : 8;
  const ranked = random ? shuffle(unique) : unique.sort((a, b) => rating(b) - rating(a));
  const elite = random ? 0 : Math.min(Math.floor(size / 4), ranked.length);
  const selected = [...ranked.slice(0, elite), ...shuffle(ranked.slice(elite)).slice(0, size - elite)];
  if (!selected.some((d) => d.id === player.id)) selected[selected.length - 1] = player;
  const seeded = random ? selected : selected.sort((a, b) => rating(b) - rating(a));
  const placed = seedOrder(seeded.length).map((n) => ({ def: seeded[n - 1], seed: n }));
  const first: Bout[] = [];
  for (let i = 0; i < placed.length; i += 2) first.push({ a: placed[i].def, b: placed[i + 1].def, seedA: placed[i].seed, seedB: placed[i + 1].seed, winner: null, player: placed[i].def.id === player.id || placed[i + 1].def.id === player.id });
  return { playerId: player.id, rounds: [first], current: 0, result: null, size: seeded.length };
}

export function simulateBout(a: FighterDef, b: FighterDef, difficulty: Difficulty = "hard", seed = Math.floor(Math.random() * 1e9)) {
  const m = new Match({ p1: a, p2: b, roundsToWin: 1, seed });
  const ca = new AIController(difficulty, seed + 1);
  const cb = new AIController(difficulty, seed + 2);
  for (let i = 0; i < 60 * 60 * 3 && m.phase !== "over"; i++) m.step([ca.tick(m.fighters[0], m.fighters[1], m), cb.tick(m.fighters[1], m.fighters[0], m)]);
  const index = m.winner ?? (m.fighters[0].health / a.maxHealth >= m.fighters[1].health / b.maxHealth ? 0 : 1);
  return { winner: index === 0 ? a : b, ko: m.fighters[1 - index].health <= 0, result: `${Math.round(m.fighters[0].health)}–${Math.round(m.fighters[1].health)} HP` };
}

export const simulate = (a: FighterDef, b: FighterDef, seed?: number) => simulateBout(a, b, "hard", seed).winner;
export const playerBout = (br: Bracket) => br.rounds[br.current]?.find((b) => b.player && !b.winner);
export const pendingCpuBouts = (br: Bracket) => br.rounds[br.current]?.filter((b) => !b.player && !b.winner) ?? [];

export function resolveCpuBout(br: Bracket, index: number, result = simulateBout(br.rounds[br.current][index].a, br.rounds[br.current][index].b, "hard", boutSeed(br, index))): Bracket {
  const rounds = br.rounds.map((r) => r.map((b) => ({ ...b })));
  const bout = rounds[br.current]?.[index];
  if (bout && !bout.player && !bout.winner) Object.assign(bout, result);
  return { ...br, rounds };
}

export function advance(br: Bracket, playerWon: boolean, ko = false, result?: string): Bracket {
  const rounds = br.rounds.map((r) => r.map((b) => ({ ...b })));
  const bout = rounds[br.current].find((b) => b.player && !b.winner);
  if (bout) {
    bout.winner = playerWon ? (bout.a.id === br.playerId ? bout.a : bout.b) : bout.a.id === br.playerId ? bout.b : bout.a;
    bout.ko = ko;
    bout.result = result;
  }
  return { ...br, rounds, result: playerWon ? br.result : false };
}

/** Advance only after every bout has an actual result. */
export function continueBracket(br: Bracket): Bracket {
  const current = br.rounds[br.current];
  if (!current?.every((b) => b.winner) || current.length === 1) return br;
  const next: Bout[] = [];
  for (let i = 0; i < current.length; i += 2) {
    const a = current[i].winner!;
    const b = current[i + 1].winner!;
    const seedOf = (d: FighterDef, bout: Bout) => d.id === bout.a.id ? bout.seedA : bout.seedB;
    next.push({ a, b, winner: null, player: a.id === br.playerId || b.id === br.playerId, seedA: seedOf(a, current[i]), seedB: seedOf(b, current[i + 1]) });
  }
  return { ...br, rounds: [...br.rounds, next], current: br.current + 1 };
}
