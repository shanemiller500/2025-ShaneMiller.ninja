/* ------------------------------------------------------------------ */
/*  Runtime fighter: position, state machine, meters and the active move */
/* ------------------------------------------------------------------ */

import type { Box, FighterDef, FighterState, InputFrame, MoveData, MoveSlot } from "./types";
import { emptyInput } from "./types";

export const GRAVITY = 0.95;
export const STAGE_HALF = 780;
export const BUFFER_FRAMES = 6;
export const MAX_JUGGLE = 5;

export const ATTACK_BUTTONS = ["lp", "hp", "kick", "special", "ult"] as const;
type AttackButton = (typeof ATTACK_BUTTONS)[number];

/** Normal-move rank: a move can cancel into a strictly higher rank (or any special). */
const RANK: Partial<Record<MoveSlot, number>> = { lp: 1, kick: 2, low: 2, hp: 3, launcher: 3 };

export class Fighter {
  readonly def: FighterDef;
  readonly index: 0 | 1;

  x: number;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1;

  state: FighterState = "idle";
  stateTime = 0;

  health: number;
  meter = 0;
  guard = 100;
  stun = 0;
  stamina = 100;

  move: MoveData | null = null;
  slot: MoveSlot | null = null;
  moveTime = 0;
  /** Did the current move connect (hit or block)? */
  moveContact = false;
  /** Did the current move actually hit (not blocked)? */
  moveHit = false;
  /** Frames until the current multi-hit move can hit again */
  rehitTimer = 0;
  projectileFired = false;
  volleyFired = 0;
  lightChain = 0;
  airAttackUsed = false;

  /** Frames left in hit/block/stun-type states */
  stunFrames = 0;
  invuln = 0;
  airJumpsLeft = 0;
  juggle = 0;
  hoverFrames = 0;
  cooldowns: Partial<Record<MoveSlot, number>> = {};
  rage = 0;
  shield = 0;
  sinceHurt = 999;
  blockPressedAt = -999;

  /** Combo tracking (as the attacker) */
  combo = 0;
  comboDamage = 0;
  comboSlots: MoveSlot[] = [];

  prev: InputFrame = emptyInput();
  /** Button state used for press buffering (updated even during hit-stop) */
  held: Record<AttackButton | "up", boolean> = { lp: false, hp: false, kick: false, special: false, ult: false, up: false };
  lastPress: Record<AttackButton | "up", number> = { lp: -99, hp: -99, kick: -99, special: -99, ult: -99, up: -99 };
  tapForward = -99;
  tapBack = -99;
  clock = 0;

  /** Match stats */
  maxCombo = 0;
  damageDealt = 0;
  hitsLanded = 0;
  specialsUsed = 0;
  ultsUsed = 0;

  constructor(def: FighterDef, index: 0 | 1, x: number) {
    this.def = def;
    this.index = index;
    this.x = x;
    this.facing = index === 0 ? 1 : -1;
    this.health = def.maxHealth;
    this.airJumpsLeft = def.airJumps;
  }

  /** Reset for a new round (keeps meter like classic fighters) */
  resetRound(x: number) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.index === 0 ? 1 : -1;
    this.health = this.def.maxHealth;
    this.guard = 100;
    this.stun = 0;
    this.stamina = 100;
    this.setState("idle");
    this.endMove();
    this.stunFrames = 0;
    this.invuln = 0;
    this.juggle = 0;
    this.cooldowns = {};
    this.rage = 0;
    this.shield = 0;
    this.combo = 0;
    this.comboSlots = [];
    this.prev = emptyInput();
  }

  get grounded() {
    return this.y <= 0 && this.vy <= 0;
  }

  get alive() {
    return this.health > 0;
  }

  setState(s: FighterState) {
    if (this.state !== s) {
      this.state = s;
      this.stateTime = 0;
    }
  }

  endMove() {
    this.move = null;
    this.slot = null;
    this.moveTime = 0;
    this.moveContact = false;
    this.moveHit = false;
    this.rehitTimer = 0;
    this.projectileFired = false;
    this.volleyFired = 0;
  }

  /** Phase of the current move */
  get movePhase(): "startup" | "active" | "recovery" | null {
    const m = this.move;
    if (!m) return null;
    if (this.moveTime < m.startup) return "startup";
    if (this.moveTime < m.startup + m.active) return "active";
    return "recovery";
  }

  /** Can this fighter start a new action right now? */
  get free() {
    return (
      this.state === "idle" ||
      this.state === "walk" ||
      this.state === "run" ||
      this.state === "crouch" ||
      this.state === "block" ||
      this.state === "crouchBlock" ||
      (this.state === "air" && !this.airAttackUsed)
    );
  }

  /** Can the current move be cancelled into `next`? */
  canCancelInto(next: MoveSlot): boolean {
    const m = this.move;
    if (!m || !this.slot || !this.moveContact) return false;
    const windowEnd = m.startup + m.active + this.def.cancelWindow;
    if (this.moveTime < m.startup || this.moveTime > windowEnd) return false;
    const from = this.slot;
    const toKind = this.def.moves[next].kind;
    if (toKind === "ultimate") return from !== "ult";
    if (m.kind === "special" || m.kind === "ultimate" || m.kind === "throw" || m.kind === "air") return false;
    if (toKind === "special") return true;
    if (from === "lp" && next === "lp") return this.lightChain < 3;
    const a = RANK[from] ?? 9;
    const b = RANK[next] ?? 9;
    return b > a;
  }

  /** Hurtbox in world space */
  hurtbox(): { x: number; y: number; w: number; h: number } {
    const w = this.def.width;
    let h = this.def.height;
    if (this.state === "crouch" || this.state === "crouchBlock" || (this.move && (this.move.low || this.slot === "low"))) h *= 0.62;
    if (this.state === "knockdown") h = 40;
    return { x: this.x - w / 2, y: this.y, w, h };
  }

  /** Active melee hitbox in world space (if any) */
  hitbox(): { x: number; y: number; w: number; h: number } | null {
    const m = this.move;
    if (!m || !m.hitbox || this.movePhase !== "active") return null;
    const b: Box = m.hitbox;
    const scale = this.def.look.height;
    const cx = this.x + this.facing * b.x * Math.max(0.9, this.def.look.bulk * 0.95);
    return { x: cx - b.w / 2, y: this.y + b.y * scale, w: b.w, h: b.h * scale };
  }

  /** Is the fighter guarding against an attacker on `fromSide` (+1 = attacker is to the right)? */
  isGuarding(input: InputFrame, attackerX: number): boolean {
    if (!this.grounded) return false;
    const blockStates: FighterState[] = ["block", "crouchBlock", "blockstun"];
    if (blockStates.includes(this.state)) return true;
    if (this.state !== "idle" && this.state !== "walk" && this.state !== "crouch") return false;
    const away = attackerX > this.x ? input.left : input.right;
    return away;
  }

  pressedRecently(btn: AttackButton) {
    return this.clock - this.lastPress[btn] <= BUFFER_FRAMES;
  }

  consume(btn: AttackButton) {
    this.lastPress[btn] = -99;
  }
}
