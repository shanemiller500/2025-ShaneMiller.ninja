/* ------------------------------------------------------------------ */
/*  Deterministic CPU opponent                                          */
/*                                                                      */
/*  The AI produces the same InputFrame a human would, so it plays by   */
/*  the exact same rules. Difficulty changes reaction time, how often   */
/*  it blocks, how well it combos and how greedy it is with specials.   */
/* ------------------------------------------------------------------ */

import type { Fighter } from "./fighter";
import type { Match } from "./match";
import { Rng } from "./rng";
import type { InputFrame } from "./types";
import { emptyInput } from "./types";

export type Difficulty = "easy" | "normal" | "hard" | "insane";

interface Profile {
  /** Frames between decisions */
  think: number;
  /** Chance to block an incoming attack it notices */
  block: number;
  /** Chance to continue a combo after a hit lands */
  combo: number;
  aggression: number;
  special: number;
  antiAir: number;
  /** Outgoing damage multiplier (kid-friendly on easy/normal) */
  damage: number;
}

export const DIFFICULTY: Record<Difficulty, Profile> = {
  easy: { think: 26, block: 0.12, combo: 0.15, aggression: 0.4, special: 0.08, antiAir: 0.05, damage: 0.6 },
  normal: { think: 16, block: 0.3, combo: 0.45, aggression: 0.55, special: 0.16, antiAir: 0.2, damage: 0.85 },
  hard: { think: 9, block: 0.58, combo: 0.75, aggression: 0.7, special: 0.24, antiAir: 0.5, damage: 1 },
  insane: { think: 4, block: 0.85, combo: 0.95, aggression: 0.85, special: 0.32, antiAir: 0.85, damage: 1.1 },
};

type Plan = { until: number; hold: Partial<InputFrame>; tap?: (keyof InputFrame)[] };

export class FightAI {
  private rng: Rng;
  private p: Profile;
  private plan: Plan | null = null;
  private nextThink = 0;
  private pendingTaps: { at: number; keys: (keyof InputFrame)[]; hold?: Partial<InputFrame> }[] = [];
  private lastCombo = 0;

  constructor(
    readonly index: 0 | 1,
    readonly difficulty: Difficulty,
    seed = 7
  ) {
    this.rng = new Rng(seed + index * 101);
    this.p = DIFFICULTY[difficulty];
  }

  update(m: Match): InputFrame {
    const me = m.fighters[this.index];
    const op = m.fighters[this.index === 0 ? 1 : 0];
    const out = emptyInput();
    if (m.phase !== "fight") return out;
    const t = me.clock;

    // Scheduled button taps (combo strings)
    for (let i = this.pendingTaps.length - 1; i >= 0; i--) {
      const tap = this.pendingTaps[i];
      if (t >= tap.at) {
        for (const k of tap.keys) out[k] = true;
        Object.assign(out, tap.hold ?? {});
        if (t > tap.at) this.pendingTaps.splice(i, 1);
      }
    }

    const dx = op.x - me.x;
    const dist = Math.abs(dx) - (me.def.width + op.def.width) / 2;
    const toward: keyof InputFrame = dx > 0 ? "right" : "left";
    const away: keyof InputFrame = dx > 0 ? "left" : "right";

    // React: incoming attack → block / anti-air (checked every frame, gated by chance per attack)
    const threat = this.threat(m, me, op, dist);
    if (threat && me.grounded && (me.state === "idle" || me.state === "walk" || me.state === "crouch" || me.state === "block" || me.state === "crouchBlock")) {
      if (threat === "air" && this.roll(this.p.antiAir, op.clock, 1)) {
        out.down = true;
        out.hp = true;
        return out;
      }
      if (this.roll(this.p.block, op.clock - (op.moveTime || 0), 2)) {
        out.block = true;
        out.down = threat === "low";
        return out;
      }
    }

    // Combo continuation: keep pressing when the last move connected
    if (me.state === "attack" && me.moveContact && me.moveHit && me.combo !== this.lastCombo) {
      this.lastCombo = me.combo;
      if (this.rng.chance(this.p.combo)) {
        const seq = this.rng.pick(me.def.combos).seq;
        const idx = Math.min(seq.length - 1, Math.max(0, me.comboSlots.length));
        const next = seq[idx];
        this.pendingTaps.push({ at: t + 2, keys: this.keysFor(next), hold: this.holdFor(next, toward) });
      }
    }

    if (t >= this.nextThink && this.pendingTaps.length === 0) {
      this.nextThink = t + this.p.think + this.rng.int(0, this.p.think);
      this.plan = this.decide(m, me, op, dist, toward, away);
    }

    if (this.plan && t <= this.plan.until) {
      Object.assign(out, this.plan.hold);
      if (this.plan.tap) {
        for (const k of this.plan.tap) out[k] = true;
        this.plan.tap = undefined;
      }
    }
    return out;
  }

  /** Deterministic per-attack roll so the AI commits for a whole attack. */
  private roll(p: number, salt: number, k: number) {
    const v = Math.sin((salt + 1) * 12.9898 * k + this.index * 78.233) * 43758.5453;
    return v - Math.floor(v) < p;
  }

  private threat(m: Match, me: Fighter, op: Fighter, dist: number): "high" | "low" | "air" | null {
    const mv = op.move;
    if (mv && op.state === "attack" && op.movePhase !== "recovery") {
      const reach = (mv.hitbox ? mv.hitbox.x + mv.hitbox.w / 2 : 0) + 20;
      if (mv.projectile || mv.volley || dist < reach) {
        if (!op.grounded && mv.kind === "air") return "air";
        return mv.low ? "low" : "high";
      }
    }
    if (!op.grounded && op.vy < 0 && dist < 140 && op.state === "air") return "air";
    for (const p of m.projectiles) {
      if (p.dead || p.owner === me.index) continue;
      const coming = Math.sign(me.x - p.x) === Math.sign(p.vx) || p.fromSky;
      if (coming && Math.abs(me.x - p.x) < 260) return p.spec.ground ? "low" : "high";
    }
    return null;
  }

  private keysFor(slot: string): (keyof InputFrame)[] {
    switch (slot) {
      case "lp":
        return ["lp"];
      case "hp":
      case "launcher":
        return ["hp"];
      case "kick":
      case "low":
        return ["kick"];
      case "s1":
      case "s2":
      case "s3":
        return ["special"];
      case "ult":
        return ["ult"];
      default:
        return ["lp"];
    }
  }

  private holdFor(slot: string, toward: keyof InputFrame): Partial<InputFrame> {
    if (slot === "low" || slot === "launcher" || slot === "s2") return { down: true };
    if (slot === "s3") return { [toward]: true } as Partial<InputFrame>;
    return {};
  }

  private decide(m: Match, me: Fighter, op: Fighter, dist: number, toward: keyof InputFrame, away: keyof InputFrame): Plan {
    const t = me.clock;
    const r = this.rng;
    const p = this.p;
    const hurt = me.health / me.def.maxHealth;
    const opHurt = op.health / op.def.maxHealth;

    // Ultimate when it's likely to land
    if (me.meter >= 100 && dist < 260 && (op.state === "hit" || op.state === "dizzy" || op.state === "trapped" || r.chance(p.special))) {
      return { until: t + 2, hold: {}, tap: ["ult"] };
    }
    // Punish helpless opponents
    if ((op.state === "dizzy" || op.state === "trapped") && dist < 120) {
      return { until: t + 2, hold: {}, tap: [r.pick(["lp", "hp", "kick"] as const)] };
    }
    if (op.state === "dizzy" || op.state === "trapped") return { until: t + 10, hold: { [toward]: true } as Partial<InputFrame> };

    // Ranged specials
    const s1 = me.def.moves.s1;
    if ((s1.projectile || s1.volley) && dist > 220 && !me.cooldowns.s1 && r.chance(p.special * 2.2)) {
      return { until: t + 2, hold: {}, tap: ["special"] };
    }
    if (dist > 160 && !me.cooldowns.s3 && r.chance(p.special)) {
      return { until: t + 3, hold: { [toward]: true } as Partial<InputFrame>, tap: ["special"] };
    }

    // Close range: attack, throw or special
    if (dist < 95) {
      const roll = r.next();
      if (op.state === "block" || op.state === "crouchBlock" || op.state === "blockstun") {
        if (roll < 0.35 + p.aggression * 0.2) return { until: t + 2, hold: {}, tap: ["lp", "kick"] };
      }
      if (roll < p.special * 0.8 && !me.cooldowns.s2) return { until: t + 3, hold: { down: true }, tap: ["special"] };
      if (roll < 0.45) return { until: t + 2, hold: {}, tap: ["lp"] };
      if (roll < 0.62) return { until: t + 2, hold: {}, tap: ["kick"] };
      if (roll < 0.75) return { until: t + 2, hold: { down: true }, tap: ["kick"] };
      if (roll < 0.85) return { until: t + 2, hold: {}, tap: ["hp"] };
      if (roll < 0.85 + (1 - p.aggression) * 0.3) return { until: t + 14, hold: { block: true } };
      return { until: t + 16, hold: { [away]: true } as Partial<InputFrame> };
    }

    // Low on health and careful: back off and block
    if (hurt < 0.25 && hurt < opHurt && r.chance(0.35 * (1 - p.aggression))) {
      return { until: t + 22, hold: { [away]: true } as Partial<InputFrame> };
    }

    // Jump-in now and then
    if (dist < 280 && r.chance(0.12 + p.aggression * 0.08)) {
      this.pendingTaps.push({ at: t + 18, keys: ["kick"] });
      return { until: t + 4, hold: { up: true, [toward]: true } as Partial<InputFrame> };
    }

    // Approach
    if (r.chance(0.35 + p.aggression * 0.6)) {
      return { until: t + 16 + r.int(0, 14), hold: { [toward]: true } as Partial<InputFrame> };
    }
    return { until: t + 12, hold: r.chance(0.5) ? { block: true } : {} };
  }
}
