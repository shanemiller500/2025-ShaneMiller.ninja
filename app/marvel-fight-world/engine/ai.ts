/* ------------------------------------------------------------------ */
/*  Deterministic CPU opponent                                          */
/*                                                                      */
/*  The AI produces the same InputFrame a keyboard would, so it plays   */
/*  by the exact same rules. Difficulty only changes how fast it        */
/*  thinks/reacts and how often it chooses the smart option.            */
/* ------------------------------------------------------------------ */

import type { Fighter } from "./fighter";
import type { Match } from "./match";
import { Rng } from "./rng";
import type { Action, InputFrame, MoveSlot } from "./types";
import { emptyInput } from "./types";

export type Difficulty = "easy" | "normal" | "hard" | "insane";

interface Profile {
  /** Frames between decisions */
  think: number;
  /** Frames before reacting to an incoming attack */
  reaction: number;
  block: number;
  antiAir: number;
  aggression: number;
  special: number;
  ult: number;
  comboLen: number;
  jump: number;
  throwRate: number;
  dodge: number;
  /** Gap between button presses in a string */
  gap: number;
  /** Outgoing damage multiplier (kid-friendly lower levels) */
  damage: number;
}

export const AI_PROFILES: Record<Difficulty, Profile> = {
  easy: { think: 24, reaction: 26, block: 0.12, antiAir: 0.08, aggression: 0.35, special: 0.1, ult: 0.25, comboLen: 1, jump: 0.04, throwRate: 0.02, dodge: 0.02, gap: 12, damage: 0.7 },
  normal: { think: 14, reaction: 16, block: 0.33, antiAir: 0.28, aggression: 0.55, special: 0.2, ult: 0.5, comboLen: 2, jump: 0.06, throwRate: 0.05, dodge: 0.05, gap: 9, damage: 0.88 },
  hard: { think: 7, reaction: 9, block: 0.6, antiAir: 0.6, aggression: 0.7, special: 0.3, ult: 0.75, comboLen: 3, jump: 0.07, throwRate: 0.1, dodge: 0.1, gap: 7, damage: 1 },
  insane: { think: 3, reaction: 4, block: 0.86, antiAir: 0.85, aggression: 0.86, special: 0.36, ult: 0.95, comboLen: 4, jump: 0.08, throwRate: 0.16, dodge: 0.18, gap: 5, damage: 1.1 },
};

type Hold = Partial<Record<Action | "fwd" | "back", boolean>>;
interface Step {
  hold: Hold;
  frames: number;
}

const SLOT_INPUT: Record<MoveSlot, Hold> = {
  lp: { lp: true },
  hp: { hp: true },
  kick: { kick: true },
  low: { down: true, kick: true },
  launcher: { down: true, hp: true },
  air: { kick: true },
  throw: { lp: true, kick: true },
  s1: { special: true },
  s2: { down: true, special: true },
  s3: { fwd: true, special: true },
  ult: { ult: true },
};

export class AIController {
  readonly profile: Profile;
  private rng: Rng;
  private queue: Step[] = [];
  private drift: Hold = {};
  private thinkTimer = 0;
  private reactTimer = -1;
  private reactPlan: Step[] | null = null;
  private lastOppMove: MoveSlot | null = null;
  private repeats = 0;
  private lastObservedMoveTime = 0;

  constructor(readonly difficulty: Difficulty, seed = 7) {
    this.profile = AI_PROFILES[difficulty];
    this.rng = new Rng(seed);
  }

  reset() {
    this.queue = [];
    this.drift = {};
    this.thinkTimer = 0;
    this.reactTimer = -1;
    this.reactPlan = null;
    this.lastOppMove = null;
    this.repeats = 0;
    this.lastObservedMoveTime = 0;
  }

  private resolve(me: Fighter, h: Hold): InputFrame {
    const out = emptyInput();
    for (const k of Object.keys(h) as (keyof Hold)[]) {
      if (!h[k]) continue;
      if (k === "fwd") out[me.facing === 1 ? "right" : "left"] = true;
      else if (k === "back") out[me.facing === 1 ? "left" : "right"] = true;
      else out[k] = true;
    }
    return out;
  }

  private press(slot: MoveSlot, wait: number): Step[] {
    return [
      { hold: SLOT_INPUT[slot], frames: 2 },
      { hold: {}, frames: wait },
    ];
  }

  tick(me: Fighter, opp: Fighter, match: Match): InputFrame {
    if (match.phase !== "fight") {
      this.reset();
      return emptyInput();
    }
    const p = this.profile;
    const dist = Math.abs(opp.x - me.x);
    if (opp.slot && opp.moveTime <= 2 && (this.lastObservedMoveTime > opp.moveTime || this.lastOppMove !== opp.slot)) {
      this.repeats = opp.slot === this.lastOppMove ? this.repeats + 1 : 0;
      this.lastOppMove = opp.slot;
    }
    this.lastObservedMoveTime = opp.moveTime;

    // ── Defensive reactions (incoming attack or projectile) ─────────
    if (this.reactTimer < 0 && me.state !== "attack" && me.grounded) {
      const threat = this.threat(me, opp, match, dist);
      if (threat) {
        this.reactTimer = p.reaction + this.rng.int(0, 4);
        this.reactPlan = this.reaction(me, threat);
      }
    }
    if (this.reactTimer >= 0) {
      if (this.reactTimer-- === 0 && this.reactPlan) {
        this.queue = this.reactPlan;
        this.reactPlan = null;
      }
    }

    // ── Execute queued presses ─────────────────────────────────────
    if (this.queue.length) {
      const step = this.queue[0];
      const out = this.resolve(me, step.hold);
      if (--step.frames <= 0) this.queue.shift();
      return out;
    }

    // ── Think ───────────────────────────────────────────────────────
    if (--this.thinkTimer <= 0) {
      this.thinkTimer = p.think + this.rng.int(0, Math.ceil(p.think / 2));
      this.decide(me, opp, dist);
    }
    return this.resolve(me, this.drift);
  }

  private threat(me: Fighter, opp: Fighter, match: Match, dist: number): { low: boolean; projectile: boolean } | null {
    const m = opp.move;
    if (m && opp.state === "attack" && opp.movePhase !== "recovery" && !m.grabRange) {
      const reach = (m.hitbox ? m.hitbox.x + m.hitbox.w / 2 : 120) + (m.lunge ? m.lunge.vx * 8 : 0) + 40;
      if (dist < reach && !m.projectile && !m.volley) return { low: !!m.low, projectile: false };
    }
    for (const pr of match.projectiles) {
      if (pr.dead || pr.owner === me.index || pr.fromSky) continue;
      const toward = Math.sign(me.x - pr.x) === Math.sign(pr.vx) || pr.returning;
      if (toward && Math.abs(pr.x - me.x) < 260) return { low: !!pr.spec.ground, projectile: true };
    }
    return null;
  }

  private reaction(me: Fighter, t: { low: boolean; projectile: boolean }): Step[] | null {
    const p = this.profile;
    if (t.projectile && this.rng.chance(p.jump * 4)) return [{ hold: { up: true, fwd: true }, frames: 3 }];
    if (this.rng.chance(p.dodge) && me.stamina > 30) return [{ hold: { block: true }, frames: 1 }, { hold: { block: true, back: true }, frames: 2 }];
    const patternRead = this.difficulty === "hard" || this.difficulty === "insane" ? Math.min(0.15, this.repeats * 0.035) : 0;
    if (this.rng.chance(p.block + patternRead)) return [{ hold: { block: true, down: t.low }, frames: 18 + this.rng.int(0, 10) }];
    return null;
  }

  private decide(me: Fighter, opp: Fighter, dist: number) {
    const p = this.profile;
    const r = this.rng;
    const d = me.def;
    const myHealth = me.health / d.maxHealth;
    const theirHealth = opp.health / opp.def.maxHealth;
    const behind = myHealth + 0.12 < theirHealth;
    const protectingLead = myHealth > theirHealth + 0.22;
    const ownRanged = !!(d.moves.s1.projectile || d.moves.s1.volley);
    const enemyRanged = !!(opp.def.moves.s1.projectile || opp.def.moves.s1.volley);
    const range = ownRanged ? (enemyRanged ? 220 : 275) : 95 * d.physical.reach;
    const matchupPressure = enemyRanged && !ownRanged ? 0.1 : d.archetype === "speed" && opp.def.archetype === "tank" ? 0.06 : 0;
    const aggression = Math.max(0.15, Math.min(0.95, p.aggression + matchupPressure + (behind ? 0.17 : 0) - (protectingLead ? 0.12 : 0)));
    this.drift = {};
    const busy = opp.state === "knockdown" || opp.state === "getup";

    // Anti-air a jump-in
    if (!opp.grounded && opp.state === "air" && dist < 260 && Math.sign(opp.vx) === -Math.sign(opp.x - me.x) && r.chance(p.antiAir)) {
      this.queue = this.press("launcher", 6);
      return;
    }

    // Ultimate when it can land
    if (me.meter >= 100 && dist < (d.moves.ult.hitbox ? d.moves.ult.hitbox.x + d.moves.ult.hitbox.w / 2 : 700) && !busy && r.chance(p.ult * 0.5)) {
      this.queue = this.press("ult", 10);
      return;
    }

    // Punish dizzy / trapped opponents with the best string we know
    if ((opp.state === "dizzy" || opp.state === "trapped") && dist < 200) {
      this.queue = this.comboString(d.combos.length ? d.combos[0].seq : ["lp", "lp", "hp"], 4);
      return;
    }

    const ranged = ownRanged;
    if (dist > Math.max(320, range + 60)) {
      if (ranged && r.chance(p.special * 1.6) && !me.cooldowns.s1) {
        this.queue = this.press("s1", 12);
      } else if (r.chance(p.jump)) {
        this.queue = [{ hold: { up: true, fwd: true }, frames: 3 }, { hold: { fwd: true }, frames: 16 }, ...this.press("air", 10)];
      } else if (r.chance(aggression)) {
        this.drift = { fwd: true };
        if (r.chance(0.3)) this.queue = [{ hold: { fwd: true }, frames: 1 }, { hold: {}, frames: 2 }, { hold: { fwd: true }, frames: 18 }];
      } else {
        this.drift = r.chance(0.5) ? {} : { back: true };
      }
      return;
    }

    if (dist > Math.max(150, range)) {
      if (r.chance(p.special) && !me.cooldowns.s3) this.queue = this.press("s3", 14);
      else if (ranged && protectingLead && r.chance(0.5)) this.drift = { back: true };
      else if (r.chance(aggression)) this.drift = { fwd: true };
      else if (r.chance(0.25)) this.drift = { block: true };
      return;
    }

    // In range
    if (busy) {
      this.drift = r.chance(0.5) ? { back: true } : {};
      return;
    }
    if ((opp.state === "block" || opp.state === "crouchBlock" || opp.state === "blockstun") && r.chance(p.throwRate * 3)) {
      this.queue = this.press("throw", 10);
      return;
    }
    if (r.chance(aggression)) {
      const combos = d.combos.filter((c) => c.seq.length <= p.comboLen + 1);
      const seq: MoveSlot[] =
        combos.length && r.chance(0.6) ? r.pick(combos).seq : (["lp", "lp", "hp", "kick", "low"] as MoveSlot[]).slice(0, Math.max(1, p.comboLen) + r.int(0, 1));
      this.queue = this.comboString(seq.slice(0, p.comboLen + 1), p.gap);
      return;
    }
    if (r.chance(p.special) && !me.cooldowns.s2) {
      this.queue = this.press("s2", 12);
      return;
    }
    this.drift = r.chance(0.5) ? { block: true } : { back: true };
  }

  private comboString(seq: MoveSlot[], gap: number): Step[] {
    return seq.flatMap((s) => this.press(s, gap));
  }
}
