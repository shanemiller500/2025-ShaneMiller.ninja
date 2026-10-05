/* ------------------------------------------------------------------ */
/*  Match: the fixed-step fight simulation (60 Hz, DOM-free)            */
/*                                                                      */
/*  step(inputs) advances one frame. Everything a renderer, audio layer */
/*  or UI needs is either readable state or pushed onto `events`.       */
/* ------------------------------------------------------------------ */

import { Fighter, GRAVITY, MAX_JUGGLE, STAGE_HALF } from "./fighter";
import { Rng } from "./rng";
import type { FighterDef, InputFrame, MatchEvent, MoveData, MoveSlot, ProjectileSpec } from "./types";
import { emptyInput } from "./types";

export interface Projectile {
  id: number;
  owner: 0 | 1;
  move: MoveData;
  slot: MoveSlot;
  spec: ProjectileSpec;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  life: number;
  age: number;
  hitsLeft: number;
  dir: 1 | -1;
  returning: boolean;
  fromSky: boolean;
  hitCooldown: number;
  dead: boolean;
}

export interface Prop {
  id: number;
  kind: string;
  x: number;
  w: number;
  h: number;
  hp: number;
  broken: boolean;
}

export type Phase = "intro" | "fight" | "ko" | "roundEnd" | "over";

export interface PropSpec {
  kind: string;
  x: number;
  w: number;
  h: number;
  hp?: number;
}

export interface MatchOptions {
  p1: FighterDef;
  p2: FighterDef;
  roundsToWin?: number;
  roundSeconds?: number;
  /** Per-player outgoing damage multiplier (kid-friendly CPU tuning) */
  damageMul?: [number, number];
  props?: PropSpec[];
  seed?: number;
  /** Starting health as a fraction of max (survival mode carries damage over) */
  startHealth?: [number, number];
}

const START_X = 260;
const INTRO_FRAMES = 100;
const KO_FRAMES = 120;
const ROUND_END_FRAMES = 160;

type Rect = { x: number; y: number; w: number; h: number };
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Match {
  readonly fighters: [Fighter, Fighter];
  readonly roundsToWin: number;
  readonly roundSeconds: number;
  readonly damageMul: [number, number];
  readonly rng: Rng;

  projectiles: Projectile[] = [];
  props: Prop[];
  events: MatchEvent[] = [];

  phase: Phase = "intro";
  phaseTime = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  timer: number;
  private timerFrames = 0;
  frame = 0;
  hitstop = 0;
  superFreeze = 0;
  superOwner: 0 | 1 | null = null;
  roundWinner: 0 | 1 | null = null;
  winner: 0 | 1 | null = null;
  roundStartFrame = 0;
  /** Seconds the fastest K.O. took (for stats) */
  fastestKo: number | null = null;
  kos: [number, number] = [0, 0];
  perfects: [number, number] = [0, 0];
  private inputs: [InputFrame, InputFrame] = [emptyInput(), emptyInput()];
  private nextId = 1;
  private propTemplate: PropSpec[];
  private lastTextAt: Record<string, number> = {};
  private startHealth: [number, number];

  constructor(opts: MatchOptions) {
    this.fighters = [new Fighter(opts.p1, 0, -START_X), new Fighter(opts.p2, 1, START_X)];
    this.roundsToWin = opts.roundsToWin ?? 2;
    this.roundSeconds = opts.roundSeconds ?? 99;
    this.damageMul = opts.damageMul ?? [1, 1];
    this.rng = new Rng(opts.seed);
    this.timer = this.roundSeconds;
    this.propTemplate = opts.props ?? [];
    this.props = this.makeProps();
    this.startHealth = opts.startHealth ?? [1, 1];
    this.applyStartHealth();
    this.emit({ type: "round", round: 1 });
  }

  private applyStartHealth() {
    this.fighters.forEach((f, i) => (f.health = Math.max(1, Math.round(f.def.maxHealth * this.startHealth[i]))));
  }

  private makeProps(): Prop[] {
    return this.propTemplate.map((p) => ({ id: this.nextId++, kind: p.kind, x: p.x, w: p.w, h: p.h, hp: p.hp ?? 2, broken: false }));
  }

  /** Simulation speed the host loop should run at (K.O. slow motion). */
  get timeScale() {
    return this.phase === "ko" && this.phaseTime < 70 && this.roundWinner !== null && !this.fighters[this.roundWinner === 0 ? 1 : 0].alive ? 0.3 : 1;
  }

  emit(e: MatchEvent) {
    this.events.push(e);
  }

  private text(text: string, player?: number, big = false, throttle = 0) {
    const key = `${text}:${player ?? "-"}`;
    if (throttle && this.frame - (this.lastTextAt[key] ?? -999) < throttle) return;
    this.lastTextAt[key] = this.frame;
    this.emit({ type: "text", text, player, big });
  }

  /** Restart the whole match with the same fighters. */
  rematch() {
    this.wins = [0, 0];
    this.round = 1;
    this.winner = null;
    this.fastestKo = null;
    this.kos = [0, 0];
    this.perfects = [0, 0];
    this.startHealth = [1, 1];
    for (const f of this.fighters) {
      f.meter = 0;
      f.maxCombo = 0;
      f.damageDealt = 0;
      f.hitsLanded = 0;
      f.specialsUsed = 0;
      f.ultsUsed = 0;
    }
    this.startRound();
  }

  private startRound() {
    const [a, b] = this.fighters;
    a.resetRound(-START_X);
    b.resetRound(START_X);
    if (this.round === 1) this.applyStartHealth();
    this.projectiles = [];
    this.props = this.makeProps();
    this.phase = "intro";
    this.phaseTime = 0;
    this.timer = this.roundSeconds;
    this.timerFrames = 0;
    this.roundWinner = null;
    this.hitstop = 0;
    this.superFreeze = 0;
    this.roundStartFrame = this.frame;
    this.emit({ type: "round", round: this.round });
  }

  /* ================================================================ */
  /*  Frame step                                                       */
  /* ================================================================ */
  step(inputs: [InputFrame, InputFrame]) {
    this.frame++;
    if (this.superFreeze > 0) {
      this.superFreeze--;
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    this.phaseTime++;

    const live = this.phase === "fight";
    const ins: [InputFrame, InputFrame] = live ? inputs : [emptyInput(), emptyInput()];
    this.inputs = ins;

    if (this.phase === "intro") {
      if (this.phaseTime === 62) {
        this.emit({ type: "fight" });
        this.text("FIGHT!", undefined, true);
      }
      if (this.phaseTime >= INTRO_FRAMES) this.phase = "fight";
    } else if (this.phase === "fight") {
      if (++this.timerFrames >= 60) {
        this.timerFrames = 0;
        this.timer = Math.max(0, this.timer - 1);
        if (this.timer === 0) this.timeOver();
      }
    } else if (this.phase === "ko") {
      if (this.phaseTime >= KO_FRAMES) this.endRound();
    } else if (this.phase === "roundEnd") {
      const w = this.roundWinner;
      if (w !== null) {
        const f = this.fighters[w];
        if (f.grounded && f.state !== "victory" && f.state !== "attack") f.setState("victory");
      }
      if (this.phaseTime >= ROUND_END_FRAMES) this.nextRound();
    }

    const [a, b] = this.fighters;
    this.updateFighter(a, b, ins[0]);
    this.updateFighter(b, a, ins[1]);
    this.physics(a);
    this.physics(b);
    this.pushApart(a, b);
    this.face(a, b);
    this.face(b, a);

    if (this.phase === "fight" || this.phase === "ko") {
      this.meleeHits(a, b);
      this.meleeHits(b, a);
    }
    this.updateProjectiles();
    this.updateProps();
  }

  /* ================================================================ */
  /*  Per-fighter logic                                                */
  /* ================================================================ */
  private updateFighter(f: Fighter, opp: Fighter, input: InputFrame) {
    f.clock++;
    f.stateTime++;
    f.sinceHurt++;
    for (const k of Object.keys(f.cooldowns) as MoveSlot[]) if (f.cooldowns[k]! > 0) f.cooldowns[k]!--;
    if (f.rage > 0) f.rage--;
    if (f.shield > 0) f.shield--;
    if (f.invuln > 0) f.invuln--;
    if (f.state !== "run") f.stamina = Math.min(100, f.stamina + 0.35);
    if (f.state !== "block" && f.state !== "crouchBlock" && f.state !== "blockstun") f.guard = Math.min(100, f.guard + 0.3);
    if (f.sinceHurt > 90 && f.state !== "dizzy") f.stun = Math.max(0, f.stun - 0.25);

    // Healing factor
    if (f.def.passive.id === "regen" && f.alive && f.sinceHurt > 150 && f.health < f.def.maxHealth && this.phase === "fight") {
      f.health = Math.min(f.def.maxHealth, f.health + f.def.maxHealth * 0.00035);
    }

    // Edge-detected presses → buffer
    const pressed = (k: keyof InputFrame) => input[k] && !f.prev[k];
    for (const k of ["lp", "hp", "kick", "special", "ult"] as const) if (pressed(k)) f.lastPress[k] = f.clock;
    if (pressed("up")) f.lastPress.up = f.clock;
    const fwdKey = f.facing === 1 ? "right" : "left";
    const backKey = f.facing === 1 ? "left" : "right";
    let runIntent = f.state === "run" && input[fwdKey];
    let backdash = false;
    if (pressed(fwdKey)) {
      if (f.clock - f.tapForward <= 12) runIntent = true;
      f.tapForward = f.clock;
    }
    if (pressed(backKey)) {
      if (f.clock - f.tapBack <= 12) backdash = true;
      f.tapBack = f.clock;
    }
    if (pressed("block")) f.blockPressedAt = f.clock;

    switch (f.state) {
      case "hit":
      case "blockstun":
        if (--f.stunFrames <= 0 && f.grounded) f.setState(input.down ? "crouch" : "idle");
        break;
      case "trapped":
        f.vx = 0;
        if (--f.stunFrames <= 0) f.setState("idle");
        break;
      case "dizzy":
        if (--f.stunFrames <= 0) {
          f.stun = 0;
          f.setState("idle");
        }
        break;
      case "knockdown":
        f.invuln = Math.max(f.invuln, 2);
        if (f.stateTime >= 34 && f.alive) f.setState("getup");
        break;
      case "getup":
        f.invuln = Math.max(f.invuln, 2);
        if (f.stateTime >= 18) {
          f.setState("idle");
          f.invuln = 8;
        }
        break;
      case "dodge": {
        const len = f.def.passive.id === "spiderSense" ? 16 : 20;
        if (f.stateTime >= len) f.setState("idle");
        break;
      }
      case "jumpSquat":
        if (f.stateTime >= 3) this.leaveGround(f, input);
        break;
      case "attack":
        this.tryCommands(f, input);
        if (f.state === "attack") this.advanceMove(f, opp, input);
        break;
      case "launched":
      case "thrown":
      case "victory":
      case "defeated":
        break;
      default:
        if (!this.tryCommands(f, input)) this.movement(f, input, pressed, runIntent, backdash);
    }
    f.prev = { ...input };
  }

  /** Read buffered buttons and start a move if allowed. Returns true if a move started. */
  private tryCommands(f: Fighter, input: InputFrame): boolean {
    const fwd = f.facing === 1 ? input.right : input.left;
    const order: MoveSlot[] = [];
    if (f.pressedRecently("ult") && f.meter >= 100) order.push("ult");
    if (f.pressedRecently("special")) order.push(input.down ? "s2" : fwd ? "s3" : "s1");
    const throwInput =
      (f.pressedRecently("lp") && f.pressedRecently("kick")) || (f.pressedRecently("lp") && input.kick) || (f.pressedRecently("kick") && input.lp);
    if (!f.grounded) {
      if (f.pressedRecently("lp") || f.pressedRecently("hp") || f.pressedRecently("kick")) order.push("air");
    } else {
      if (throwInput) order.push("throw");
      if (f.pressedRecently("hp")) order.push(input.down ? "launcher" : "hp");
      if (f.pressedRecently("kick")) order.push(input.down ? "low" : "kick");
      if (f.pressedRecently("lp")) order.push("lp");
    }
    for (const slot of order) if (this.startMove(f, slot)) return true;
    return false;
  }

  private startMove(f: Fighter, slot: MoveSlot): boolean {
    const m = f.def.moves[slot];
    if (slot === "ult" && f.meter < 100) return false;
    if ((f.cooldowns[slot] ?? 0) > 0) return false;
    if (slot === "throw" && !f.grounded) return false;
    if (slot === "air" && f.grounded) return false;
    if (!f.grounded && slot !== "air" && m.kind !== "special" && m.kind !== "ultimate") return false;
    if (f.state === "attack") {
      if (!f.canCancelInto(slot)) return false;
    } else if (!f.free) return false;

    // Consume the buttons that made this command
    if (slot === "ult") f.consume("ult");
    else if (m.kind === "special") f.consume("special");
    else if (slot === "throw") {
      f.consume("lp");
      f.consume("kick");
    } else if (slot === "hp" || slot === "launcher") f.consume("hp");
    else if (slot === "kick" || slot === "low") f.consume("kick");
    else if (slot === "lp") f.consume("lp");
    else if (slot === "air") {
      f.consume("lp");
      f.consume("hp");
      f.consume("kick");
    }

    f.lightChain = slot === "lp" ? (f.slot === "lp" ? f.lightChain + 1 : 1) : 0;
    const wasRunning = f.state === "run";
    f.endMove();
    f.move = m;
    f.slot = slot;
    f.setState("attack");
    if (f.grounded && m.kind !== "special" && m.kind !== "ultimate") f.vx = wasRunning ? f.vx * 0.5 : 0;
    if (slot === "air") f.airAttackUsed = true;
    if (m.cooldown) f.cooldowns[slot] = Math.round(m.cooldown * f.def.cooldownMul);
    if (m.kind === "special") f.specialsUsed++;
    if (m.heal) {
      f.health = Math.min(f.def.maxHealth, f.health + f.def.maxHealth * m.heal);
      this.emit({ type: "heal", player: f.index });
    }
    if (m.buff) {
      if (m.buff.kind === "rage") f.rage = m.buff.frames;
      else f.shield = m.buff.frames;
      this.text(m.name.toUpperCase(), f.index, false);
    }
    if (m.cost) {
      f.meter = Math.max(0, f.meter - m.cost);
      f.ultsUsed++;
      f.invuln = m.startup + 6;
      this.superFreeze = 40;
      this.superOwner = f.index;
      this.emit({ type: "super", player: f.index, move: m.name });
      this.emit({ type: "sfx", key: "super" });
    }
    return true;
  }

  private advanceMove(f: Fighter, opp: Fighter, input: InputFrame) {
    const m = f.move!;
    const t = f.moveTime;

    if (m.lunge) {
      const from = m.lunge.from ?? 0;
      const frames = m.lunge.frames ?? m.active;
      if (t >= from && t < from + frames) {
        f.vx = f.facing * m.lunge.vx;
        if (m.lunge.vy && t === from) f.vy = m.lunge.vy;
      }
    }
    if (m.invuln && t >= m.invuln[0] && t <= m.invuln[1]) f.invuln = Math.max(f.invuln, 1);

    if (t === m.startup) {
      this.emit({ type: "sfx", key: m.kind === "light" || m.kind === "kick" || m.kind === "air" ? "whoosh" : m.sfx, volume: 0.7 });
      if (m.teleport) this.teleport(f, opp, m.teleport);
      if (m.projectile && !f.projectileFired) {
        f.projectileFired = true;
        this.spawnProjectile(f, opp, m, f.slot!, m.projectile, false);
      }
      if (m.grabRange) this.resolveThrow(f, opp, m);
    }

    if (m.volley && f.movePhase === "active") {
      const since = t - m.startup;
      if (since % m.volley.every === 0 && f.volleyFired < m.volley.count) {
        f.volleyFired++;
        this.spawnProjectile(f, opp, m, f.slot!, m.volley.spec, m.volley.from === "sky");
      }
    }

    if (f.rehitTimer > 0) f.rehitTimer--;
    f.moveTime++;

    if (f.moveTime >= m.startup + m.active + m.recovery) {
      f.endMove();
      f.setState(f.grounded ? (input.down ? "crouch" : "idle") : "air");
    }
  }

  private movement(f: Fighter, input: InputFrame, pressed: (k: keyof InputFrame) => boolean, runIntent: boolean, backdash: boolean) {
    const d = f.def;
    const fwd = f.facing === 1 ? input.right : input.left;
    const back = f.facing === 1 ? input.left : input.right;

    if (!f.grounded) {
      // Air jump / hover / drift
      if (pressed("up") && f.airJumpsLeft > 0) {
        f.airJumpsLeft--;
        f.vy = d.jump * 0.85;
        f.vx = input.right ? d.walk * 1.1 : input.left ? -d.walk * 1.1 : f.vx * 0.5;
        this.emit({ type: "sfx", key: "jump", volume: 0.6 });
      } else if (d.passive.id === "flight" && input.up && f.vy < 0 && f.hoverFrames < 110) {
        f.hoverFrames++;
        f.vy = Math.max(f.vy, -0.7);
      }
      if (input.right) f.vx = Math.min(d.walk * 1.2, f.vx + 0.25);
      if (input.left) f.vx = Math.max(-d.walk * 1.2, f.vx - 0.25);
      f.setState("air");
      return;
    }

    // Dodge: block + direction, or double-tap back
    const dodgeDir = input.block && pressed(f.facing === 1 ? "right" : "left") ? 1 : input.block && pressed(f.facing === 1 ? "left" : "right") ? -1 : backdash ? -1 : 0;
    if (dodgeDir !== 0 && f.stamina >= 22) {
      f.stamina -= 22;
      f.setState("dodge");
      f.vx = f.facing * dodgeDir * d.walk * 2.4;
      f.invuln = d.passive.id === "spiderSense" ? 18 : 12;
      this.emit({ type: "sfx", key: "dodge", volume: 0.6 });
      return;
    }

    if (input.up && (pressed("up") || f.stateTime > 4)) {
      f.setState("jumpSquat");
      return;
    }
    if (input.block) {
      f.setState(input.down ? "crouchBlock" : "block");
      f.vx *= 0.5;
      return;
    }
    if (input.down) {
      f.setState("crouch");
      return;
    }
    if (fwd) {
      if (runIntent && f.stamina > 5) {
        f.setState("run");
        f.vx = f.facing * d.run;
        f.stamina = Math.max(0, f.stamina - 0.25);
      } else {
        f.setState("walk");
        f.vx = f.facing * d.walk;
      }
      return;
    }
    if (back) {
      f.setState("walk");
      f.vx = -f.facing * d.walk * 0.8;
      return;
    }
    f.setState("idle");
  }

  private leaveGround(f: Fighter, input: InputFrame) {
    const d = f.def;
    f.vy = d.jump;
    const run = Math.abs(f.vx) > d.walk * 1.3;
    const h = input.right ? 1 : input.left ? -1 : 0;
    f.vx = h * (run ? d.run * 0.85 : d.walk * 1.15);
    f.y = 0.1;
    f.airJumpsLeft = d.airJumps;
    f.hoverFrames = 0;
    f.airAttackUsed = false;
    f.setState("air");
    this.emit({ type: "sfx", key: "jump", volume: 0.6 });
  }

  /* ================================================================ */
  /*  Physics                                                          */
  /* ================================================================ */
  private physics(f: Fighter) {
    const airborne = f.y > 0 || f.vy > 0;
    if (airborne) {
      f.vy -= f.state === "launched" ? GRAVITY * 0.92 : GRAVITY;
      f.y += f.vy;
      if (f.y <= 0) {
        f.y = 0;
        this.land(f);
      }
    }
    f.x += f.vx;

    const lunge = f.move?.lunge;
    const lunging = !!lunge && f.moveTime >= (lunge.from ?? 0) && f.moveTime < (lunge.from ?? 0) + (lunge.frames ?? f.move!.active);
    if (f.grounded && f.state !== "walk" && f.state !== "run" && f.state !== "dodge" && !lunging) {
      f.vx *= 0.8;
      if (Math.abs(f.vx) < 0.1) f.vx = 0;
    }

    const lim = STAGE_HALF - f.def.width / 2;
    if (f.x < -lim || f.x > lim) {
      f.x = clamp(f.x, -lim, lim);
      if ((f.state === "launched" || f.state === "hit" || f.state === "thrown") && Math.abs(f.vx) > 8) {
        f.vx = -f.vx * 0.35;
        this.emit({ type: "shake", amount: 6 });
        this.emit({ type: "dust", x: f.x, y: f.y + 60 });
        this.emit({ type: "sfx", key: "land" });
      } else f.vx = 0;
    }
  }

  private land(f: Fighter) {
    f.vy = 0;
    f.airJumpsLeft = f.def.airJumps;
    f.hoverFrames = 0;
    f.airAttackUsed = false;
    switch (f.state) {
      case "air":
        f.setState("idle");
        this.emit({ type: "sfx", key: "land", volume: 0.35 });
        break;
      case "attack":
        if (f.move?.kind === "air") {
          f.endMove();
          f.setState("idle");
        }
        break;
      case "launched":
      case "thrown":
        f.juggle = 0;
        f.vx *= 0.4;
        this.emit({ type: "dust", x: f.x, y: 0 });
        this.emit({ type: "sfx", key: "land" });
        if (!f.alive) {
          f.setState("defeated");
          this.emit({ type: "shake", amount: 10 });
        } else {
          f.setState("knockdown");
          f.invuln = 40;
          this.emit({ type: "shake", amount: 4 });
        }
        break;
      case "hit":
        f.stunFrames = Math.max(f.stunFrames, 6);
        break;
    }
  }

  private pushApart(a: Fighter, b: Fighter) {
    const skip = ["knockdown", "defeated", "dodge"];
    if (skip.includes(a.state) || skip.includes(b.state)) return;
    const minDist = (a.def.width + b.def.width) * 0.42;
    const dx = b.x - a.x;
    const vOverlap = a.y < b.y + b.def.height * 0.8 && b.y < a.y + a.def.height * 0.8;
    if (Math.abs(dx) < minDist && vOverlap) {
      const s = dx === 0 ? 1 : Math.sign(dx);
      const push = (minDist - Math.abs(dx)) / 2;
      a.x -= s * push;
      b.x += s * push;
      for (const f of [a, b]) {
        const lim = STAGE_HALF - f.def.width / 2;
        f.x = clamp(f.x, -lim, lim);
      }
      // If pinned against a wall, the other one gets pushed out instead
      if (Math.abs(b.x - a.x) < minDist - 0.5) {
        if (Math.abs(a.x) > Math.abs(b.x)) b.x = a.x + s * minDist;
        else a.x = b.x - s * minDist;
      }
    }
  }

  private face(f: Fighter, opp: Fighter) {
    const turnable = ["idle", "walk", "crouch", "block", "crouchBlock", "jumpSquat", "run", "victory"].includes(f.state);
    if (turnable && f.grounded && Math.abs(opp.x - f.x) > 4) f.facing = opp.x > f.x ? 1 : -1;
  }

  private teleport(f: Fighter, opp: Fighter, where: "behind" | "away") {
    const lim = STAGE_HALF - f.def.width / 2;
    if (where === "behind") {
      const side = f.x < opp.x ? 1 : -1;
      let nx = opp.x + side * (opp.def.width / 2 + f.def.width / 2 + 24);
      if (Math.abs(nx) > lim) nx = opp.x - side * (opp.def.width / 2 + f.def.width / 2 + 24);
      f.x = clamp(nx, -lim, lim);
    } else {
      f.x = clamp(opp.x > 0 ? -lim + 40 : lim - 40, -lim, lim);
    }
    f.facing = opp.x > f.x ? 1 : -1;
    this.emit({ type: "hit", x: f.x, y: f.y + 90, fx: f.move?.fx ?? "magic", power: 0.5, attacker: f.index, blocked: true, counter: false, damage: 0 });
  }

  /* ================================================================ */
  /*  Hits                                                             */
  /* ================================================================ */
  private canBeHit(d: Fighter) {
    if (d.invuln > 0) return false;
    if (d.state === "knockdown" || d.state === "getup" || d.state === "defeated" || d.state === "dodge") return false;
    if (d.state === "launched" && d.juggle >= MAX_JUGGLE) return false;
    return true;
  }

  private meleeHits(a: Fighter, d: Fighter) {
    const m = a.move;
    // Throws resolve on their own; counter stances only fire when struck
    if (!m || m.grabRange || m.counter) return;
    const hb = a.hitbox();
    if (!hb) return;
    if (m.rehit ? a.rehitTimer > 0 : a.moveContact) return;
    if (!this.canBeHit(d)) return;
    if (!overlap(hb, d.hurtbox())) return;
    const px = (Math.max(hb.x, d.x - d.def.width / 2) + Math.min(hb.x + hb.w, d.x + d.def.width / 2)) / 2;
    const py = clamp(hb.y + hb.h / 2, d.y + 20, d.y + d.def.height - 10);
    this.resolveHit(a, d, m, a.slot!, px, py, null);
    if (m.rehit) a.rehitTimer = m.rehit;
  }

  private resolveThrow(a: Fighter, d: Fighter, m: MoveData) {
    const reach = (m.grabRange ?? 100) + (a.def.width + d.def.width) / 2;
    const ok = d.grounded && Math.abs(d.x - a.x) <= reach && this.canBeHit(d) && d.state !== "launched" && d.state !== "hit";
    if (!ok) return;
    this.text("THROW!", a.index, false);
    this.resolveHit(a, d, m, a.slot!, (a.x + d.x) / 2, d.y + 110, null);
  }

  /** The core: blocking, parries, counters, armor, damage, reactions, combos. */
  private resolveHit(a: Fighter, d: Fighter, m: MoveData, slot: MoveSlot, px: number, py: number, proj: ProjectileSpec | null) {
    const dIn = this.inputs[d.index];
    const dir: 1 | -1 = proj ? (px < d.x ? 1 : -1) : a.x < d.x ? 1 : -1;

    // Counter stance riposte (melee only)
    if (!proj && d.move?.counter && d.movePhase === "active" && m.kind !== "throw" && m.kind !== "ultimate") {
      const counterMove = d.move;
      d.moveTime = counterMove.startup + counterMove.active;
      a.moveContact = true;
      this.text("COUNTER!", d.index, true);
      this.emit({ type: "sfx", key: "block" });
      this.applyDamage(d, a, counterMove, d.slot!, a.x, a.y + 110, null, true, (a.x > d.x ? 1 : -1) as 1 | -1);
      return;
    }

    // Blocking
    const crouching = dIn.down || d.state === "crouchBlock";
    const guarding = !m.unblockable && m.kind !== "throw" && d.isGuarding(dIn, proj ? px : a.x);
    const lowBeatsStand = m.low && !crouching;
    const overheadBeatsCrouch = m.overhead && crouching;
    if (guarding && !lowBeatsStand && !overheadBeatsCrouch) {
      // Parry: block pressed just before the hit
      if (d.def.passive.id === "counter" && !proj && d.clock - d.blockPressedAt <= 8) {
        this.text("PARRY!", d.index, true);
        this.emit({ type: "sfx", key: "block" });
        this.emit({ type: "hit", x: px, y: py, fx: "shield", power: 0.8, attacker: a.index, blocked: true, counter: true, damage: 0 });
        d.meter = Math.min(100, d.meter + 8);
        d.blockPressedAt = -999;
        a.endMove();
        a.setState("hit");
        a.stunFrames = 18;
        this.hitstop = 6;
        return;
      }
      const chip = m.kind === "special" || m.kind === "ultimate" ? Math.round(this.computeDamage(a, d, m, 1, false, 1) * 0.15) : 0;
      if (chip > 0) d.health = Math.max(1, d.health - chip);
      d.guard -= m.guard * (d.def.passive.id === "armor" ? 0.7 : 1);
      d.endMove();
      d.setState("blockstun");
      d.stunFrames = m.blockstun;
      d.vx = (dir * (m.knockback.x * 0.7)) / d.def.weight;
      a.moveContact = true;
      a.combo = 0;
      a.meter = Math.min(100, a.meter + m.meter * 0.5 * this.gainMul(a));
      d.meter = Math.min(100, d.meter + 3 * this.gainMul(d));
      this.emit({ type: "hit", x: px, y: py, fx: "shield", power: 0.4, attacker: a.index, blocked: true, counter: false, damage: chip });
      this.emit({ type: "sfx", key: "block", volume: 0.8 });
      this.text("BLOCKED", d.index, false, 40);
      this.hitstop = 4;
      if (d.guard <= 0) {
        d.guard = 30;
        d.setState("dizzy");
        d.stunFrames = 70;
        this.text("GUARD BREAK!", d.index, true);
        this.emit({ type: "sfx", key: "guardBreak" });
        this.emit({ type: "shake", amount: 8 });
      }
      return;
    }

    this.applyDamage(a, d, m, slot, px, py, proj, false, dir);
  }

  private gainMul(f: Fighter) {
    return f.def.passive.id === "meterGain" ? 1.35 : 1;
  }

  /** Balanced damage: base move damage scaled by stats, combo decay, rage, defense. */
  computeDamage(a: Fighter, d: Fighter, m: MoveData, comboHits: number, counter: boolean, bonus: number) {
    const mul = m.kind === "special" || m.kind === "ultimate" ? a.def.powerMul : a.def.physMul;
    const rageOn = a.rage > 0 || (a.def.passive.id === "rage" && a.health < a.def.maxHealth * 0.35);
    const floor = m.kind === "ultimate" ? 0.6 : 0.35;
    const scale = Math.max(floor, 1 - 0.1 * (comboHits - 1));
    const dmg =
      m.damage * mul * scale * bonus * (counter ? 1.2 : 1) * (rageOn ? 1.25 : 1) * d.def.defense * (d.shield > 0 ? 0.35 : 1) * this.damageMul[a.index];
    return Math.max(1, Math.round(dmg));
  }

  private applyDamage(a: Fighter, d: Fighter, m: MoveData, slot: MoveSlot, px: number, py: number, proj: ProjectileSpec | null, forced: boolean, dir: 1 | -1) {
    const counterHit = !forced && d.state === "attack" && d.movePhase !== "recovery";
    const comboing = ["hit", "launched", "dizzy", "trapped", "thrown"].includes(d.state);
    a.combo = comboing ? a.combo + 1 : 1;
    if (!comboing) a.comboSlots = [];
    a.comboSlots.push(slot);

    // Named combos (match the tail of the landed sequence)
    let bonus = 1;
    let label: string | undefined;
    for (const c of a.def.combos) {
      const tail = a.comboSlots.slice(-c.seq.length);
      if (tail.length === c.seq.length && tail.every((s, i) => s === c.seq[i])) {
        bonus = c.bonus;
        label = c.name;
      }
    }

    const dmg = this.computeDamage(a, d, m, a.combo, counterHit || forced, bonus);
    d.health = Math.max(0, d.health - dmg);
    d.sinceHurt = 0;
    a.damageDealt += dmg;
    a.hitsLanded++;
    a.comboDamage = comboing ? a.comboDamage + dmg : dmg;
    a.maxCombo = Math.max(a.maxCombo, a.combo);
    if (d.state !== "dizzy") d.stun += dmg * 0.1 + m.hitstun * 0.25;
    a.meter = Math.min(100, a.meter + m.meter * this.gainMul(a));
    d.meter = Math.min(100, d.meter + dmg * 0.05 * this.gainMul(d));
    a.moveContact = true;
    a.moveHit = true;

    const ko = d.health <= 0;
    const power = Math.min(1.6, dmg / 60);
    this.emit({ type: "hit", x: px, y: py, fx: m.fx, power, attacker: a.index, blocked: false, counter: counterHit, damage: dmg });
    this.emit({ type: "sfx", key: m.kind === "light" ? "jab" : m.sfx === "whoosh" ? "heavy" : m.sfx === "super" ? "heavy" : m.sfx, volume: Math.min(1, 0.55 + power * 0.4) });
    if (dmg >= 60 || m.kind === "ultimate") this.emit({ type: "shake", amount: Math.min(14, dmg / 9) });
    if (counterHit) this.text("COUNTER", a.index, false);
    if (a.combo >= 2) {
      this.emit({ type: "combo", player: a.index, hits: a.combo, label });
      if (label) this.text(label.toUpperCase(), a.index, false);
    }

    // Super armor: take the damage, ignore the flinch
    const armored =
      !ko &&
      d.state === "attack" &&
      !!d.move &&
      d.movePhase !== "recovery" &&
      m.kind !== "throw" &&
      m.kind !== "ultimate" &&
      m.damage < 80 &&
      (!!d.move.armor || (d.def.passive.id === "armor" && d.move.kind === "heavy" && (m.kind === "light" || m.kind === "kick")));
    if (armored) {
      this.text("ARMOR", d.index, false, 30);
      this.hitstop = 3;
      return;
    }

    // Reaction
    const airborne = !d.grounded || d.state === "launched";
    d.endMove();
    const kbX = (m.knockback.x / d.def.weight) * dir;
    const kbY = m.knockback.y / Math.sqrt(d.def.weight);
    if (ko || m.launch || m.knockdown || airborne) {
      d.setState(m.grabRange ? "thrown" : "launched");
      d.vy = ko ? 13 : Math.max(kbY, m.launch ? 13 : airborne ? 7 : 6);
      d.vx = ko ? dir * 11 : kbX * (airborne ? 0.8 : 1);
      if (airborne) d.juggle++;
      d.y = Math.max(d.y, 0.1);
    } else {
      d.setState("hit");
      d.stunFrames = m.hitstun + (counterHit ? 8 : 0);
      d.vx = kbX;
    }

    if (proj?.trap && !ko && d.grounded) {
      d.setState("trapped");
      d.stunFrames = proj.trap;
      d.vx = 0;
      this.text("TRAPPED!", d.index, false);
    }
    if (proj?.pull && !ko) {
      const owner = this.fighters[a.index];
      d.vx = Math.sign(owner.x - d.x) * 13;
      if (d.state === "hit") d.stunFrames += 12;
    }

    if (d.stun >= 100 && !ko && d.grounded && d.state === "hit") {
      d.stun = 0;
      d.setState("dizzy");
      d.stunFrames = 90;
      this.text("DIZZY!", d.index, true);
    }

    this.hitstop = m.kind === "ultimate" ? 3 : clamp(Math.round(3 + dmg / 14), 3, 11);
    if (ko) this.ko(a, d);
  }

  private ko(a: Fighter, d: Fighter) {
    if (this.phase !== "fight") return;
    this.phase = "ko";
    this.phaseTime = 0;
    this.roundWinner = a.index;
    this.kos[a.index]++;
    this.hitstop = 16;
    const seconds = (this.frame - this.roundStartFrame) / 60;
    this.fastestKo = this.fastestKo === null ? seconds : Math.min(this.fastestKo, seconds);
    this.emit({ type: "ko", winner: a.index, loser: d.index });
    this.emit({ type: "sfx", key: "ko" });
    this.emit({ type: "shake", amount: 22 });
    this.text("K.O.", undefined, true);
  }

  private timeOver() {
    if (this.phase !== "fight") return;
    const [a, b] = this.fighters;
    const ra = a.health / a.def.maxHealth;
    const rb = b.health / b.def.maxHealth;
    this.roundWinner = Math.abs(ra - rb) < 0.001 ? null : ra > rb ? 0 : 1;
    this.text("TIME!", undefined, true);
    this.phase = "ko";
    this.phaseTime = 70;
  }

  private endRound() {
    const w = this.roundWinner;
    const [a, b] = this.fighters;
    const timeOver = a.alive && b.alive;
    let perfect = false;
    if (w !== null) {
      this.wins[w]++;
      const wf = this.fighters[w];
      perfect = wf.health >= wf.def.maxHealth;
      if (perfect) {
        this.perfects[w]++;
        this.text("PERFECT!", w, true);
      }
    } else {
      this.text("DRAW", undefined, true);
    }
    this.emit({ type: "roundOver", winner: w, perfect, timeOver });
    this.phase = "roundEnd";
    this.phaseTime = 0;
  }

  private nextRound() {
    const champ = this.wins[0] >= this.roundsToWin ? 0 : this.wins[1] >= this.roundsToWin ? 1 : null;
    if (champ !== null) {
      this.phase = "over";
      this.phaseTime = 0;
      this.winner = champ;
      this.emit({ type: "matchOver", winner: champ });
      return;
    }
    this.round++;
    this.startRound();
  }

  /* ================================================================ */
  /*  Projectiles                                                      */
  /* ================================================================ */
  private spawnProjectile(f: Fighter, opp: Fighter, m: MoveData, slot: MoveSlot, spec: ProjectileSpec, fromSky: boolean) {
    const dir = f.facing;
    const off = spec.offset ?? { x: 50, y: 100 };
    const x = fromSky ? opp.x + this.rng.range(-50, 50) : f.x + dir * off.x * Math.max(0.9, f.def.look.bulk);
    const y = fromSky ? 640 : spec.ground ? spec.h / 2 : f.y + off.y * f.def.look.height;
    this.projectiles.push({
      id: this.nextId++,
      owner: f.index,
      move: m,
      slot,
      spec,
      x,
      y,
      vx: fromSky ? 0 : dir * spec.speed,
      vy: spec.vy ?? 0,
      w: spec.w,
      h: spec.h,
      life: spec.life,
      age: 0,
      hitsLeft: spec.hits ?? 1,
      dir,
      returning: false,
      fromSky,
      hitCooldown: 0,
      dead: false,
    });
    this.emit({ type: "sfx", key: m.sfx === "super" ? (fromSky ? "lightning" : "energy") : m.sfx, volume: 0.6 });
  }

  private updateProjectiles() {
    const frozen = this.phase === "intro" || this.phase === "roundEnd" || this.phase === "over";
    for (const p of this.projectiles) {
      if (p.dead || frozen) continue;
      p.age++;
      const owner = this.fighters[p.owner];
      const target = this.fighters[p.owner === 0 ? 1 : 0];
      const s = p.spec;

      if (s.homing) {
        p.vx += Math.sign(target.x - p.x) * s.homing * 1.2;
        p.vx = clamp(p.vx, -s.speed * 1.3, s.speed * 1.3);
        p.vy += Math.sign(target.y + target.def.height * 0.55 - p.y) * s.homing * 0.8;
        p.vy = clamp(p.vy, -6, 6);
      }
      if (s.gravity) p.vy -= s.gravity;
      if (s.returns && !p.returning && p.age > p.life * 0.45) {
        p.returning = true;
        p.hitCooldown = 0;
        p.hitsLeft = Math.max(p.hitsLeft, 1);
      }
      if (p.returning) {
        p.vx = Math.sign(owner.x - p.x) * s.speed;
        p.vy = (owner.y + owner.def.height * 0.6 - p.y) * 0.1;
        if (Math.abs(owner.x - p.x) < 36) p.dead = true;
      }
      p.x += p.vx;
      p.y += p.vy;
      if (s.ground) p.y = p.h / 2;
      if (p.hitCooldown > 0) p.hitCooldown--;

      if (!p.returning && p.age >= p.life && !s.returns) p.dead = true;
      if (p.returning && p.age >= p.life * 2.5) p.dead = true;
      if (Math.abs(p.x) > STAGE_HALF + 240) p.dead = true;
      if (p.fromSky && p.y - p.h / 2 <= 0) {
        p.dead = true;
        this.emit({ type: "hit", x: p.x, y: 6, fx: s.fx, power: 0.9, attacker: p.owner, blocked: true, counter: false, damage: 0 });
        this.emit({ type: "dust", x: p.x, y: 0 });
        this.emit({ type: "shake", amount: 4 });
      }
      if (p.dead) continue;

      // Hit the opponent
      if ((this.phase === "fight" || this.phase === "ko") && p.hitCooldown <= 0 && this.canBeHit(target)) {
        const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
        if (overlap(box, target.hurtbox())) {
          this.resolveHit(owner, target, p.move, p.slot, p.x, p.y, s);
          p.hitsLeft--;
          p.hitCooldown = 14;
          if (p.hitsLeft <= 0 && !s.returns) p.dead = true;
          if (s.returns && !p.returning) p.returning = true;
          if (p.fromSky) p.dead = true;
        }
      }
    }

    // Projectile clashes
    const live = this.projectiles.filter((p) => !p.dead && !p.fromSky);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (a.owner === b.owner || a.dead || b.dead) continue;
        if (overlap({ x: a.x - a.w / 2, y: a.y - a.h / 2, w: a.w, h: a.h }, { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h })) {
          a.dead = b.dead = true;
          this.emit({ type: "hit", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, fx: "energy", power: 1, attacker: a.owner, blocked: true, counter: false, damage: 0 });
          this.emit({ type: "sfx", key: "explosion", volume: 0.7 });
        }
      }
    }
    if (this.projectiles.length > 40 || this.frame % 30 === 0) this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  /* ================================================================ */
  /*  Destructible props: smash fighters into them                    */
  /* ================================================================ */
  private updateProps() {
    for (const prop of this.props) {
      if (prop.broken) continue;
      for (const f of this.fighters) {
        const fast = Math.abs(f.vx) > 7 && (f.state === "launched" || f.state === "hit" || f.state === "thrown");
        if (fast && Math.abs(f.x - prop.x) < prop.w / 2 + f.def.width / 2 && f.y < prop.h) {
          prop.hp--;
          f.vx *= 0.6;
          if (prop.hp <= 0) {
            prop.broken = true;
            this.emit({ type: "propBreak", x: prop.x, y: prop.h / 2, w: prop.w, h: prop.h });
            this.emit({ type: "sfx", key: "explosion", volume: 0.8 });
            this.emit({ type: "shake", amount: 9 });
          } else this.emit({ type: "dust", x: prop.x, y: prop.h / 2 });
        }
      }
    }
  }
}
