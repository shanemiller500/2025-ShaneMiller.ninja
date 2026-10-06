/* ------------------------------------------------------------------ */
/*  GameSession: owns one match + its loop.                             */
/*                                                                      */
/*  Fixed 60 Hz simulation on requestAnimationFrame (accumulator), the  */
/*  renderer draws once per animation frame. React never re-renders per */
/*  frame — it only hears about pause/match-over via callbacks.         */
/* ------------------------------------------------------------------ */

import { audio } from "../audio/audio";
import { AIController, AI_PROFILES, type Difficulty } from "../engine/ai";
import { Match } from "../engine/match";
import type { FighterDef, InputFrame, MatchEvent } from "../engine/types";
import { emptyInput } from "../engine/types";
import { InputManager, keyLabel } from "../input/input";
import { BTN, PAD_LABELS } from "../input/gamepad";
import type { Settings } from "../data/storage";
import type { ArenaDef } from "../render/arenas";
import { Renderer } from "../render/renderer";

export type Controller = "human" | "cpu";

export interface SessionConfig {
  p1: FighterDef;
  p2: FighterDef;
  arena: ArenaDef;
  controllers: [Controller, Controller];
  difficulty: Difficulty;
  settings: Settings;
  /** Survival etc: start a fighter below full health (0..1) */
  startHealth?: [number, number];
  onMatchOver: (summary: MatchSummary) => void;
  onPauseRequest?: () => void;
  /** Attract mode: no audio, no announcer, no keyboard */
  silent?: boolean;
  hideHud?: boolean;
}

export interface FighterSummary {
  name: string;
  id: number;
  maxCombo: number;
  damage: number;
  hits: number;
  specials: number;
  ults: number;
  roundWins: number;
  kos: number;
  perfects: number;
  /** Health remaining at the final bell (0..1) */
  healthLeft: number;
}

export interface MatchSummary {
  winner: 0 | 1 | null;
  fighters: [FighterSummary, FighterSummary];
  fastestKo: number | null;
  seconds: number;
}

const STEP = 1 / 60;

export class GameSession {
  readonly match: Match;
  readonly renderer: Renderer;
  readonly input: InputManager;
  private ai: [AIController | null, AIController | null];
  private raf = 0;
  private last = 0;
  private acc = 0;
  private paused = false;
  private destroyed = false;
  private kos: [number, number] = [0, 0];
  private perfects: [number, number] = [0, 0];
  private startedAt = 0;
  private pauseKeyHeld = false;
  private padPresence: [boolean, boolean] = [false, false];

  constructor(canvas: HTMLCanvasElement, private cfg: SessionConfig, portraits: [HTMLImageElement | null, HTMLImageElement | null]) {
    const s = cfg.settings;
    const cpuMul = AI_PROFILES[cfg.difficulty].damage;
    this.match = new Match({
      p1: cfg.p1,
      p2: cfg.p2,
      roundsToWin: s.roundsToWin,
      damageMul: [cfg.controllers[0] === "cpu" ? cpuMul : 1, cfg.controllers[1] === "cpu" ? cpuMul : 1],
      props: cfg.arena.props,
      seed: (Date.now() & 0xffff) + 1,
    });
    if (cfg.startHealth) {
      cfg.startHealth.forEach((h, i) => (this.match.fighters[i].health = Math.max(1, Math.round(this.match.fighters[i].def.maxHealth * h))));
    }
    this.input = new InputManager(s.bindings);
    this.input.shareKeys = cfg.controllers[1] === "cpu";
    this.ai = [
      cfg.controllers[0] === "cpu" ? new AIController(cfg.difficulty, 101) : null,
      cfg.controllers[1] === "cpu" ? new AIController(cfg.difficulty, 202) : null,
    ];

    const hint = (p: 0 | 1) => this.hint(p);
    const labels: [string, string] = [
      cfg.controllers[0] === "cpu" ? "CPU" : "P1",
      cfg.controllers[1] === "cpu" ? "CPU" : cfg.controllers[0] === "cpu" ? "P1" : "P2",
    ];
    this.renderer = new Renderer(canvas, cfg.arena, portraits, labels, [hint(0), cfg.controllers[1] === "cpu" ? ["", "", "", ""] : hint(1)], {
      screenShake: s.screenShake,
      blood: s.blood,
      showHitboxes: s.showHitboxes,
      hideHud: cfg.hideHud,
    });
    audio.announcer = s.announcer;
    audio.setVolumes(s.sfxVolume, s.musicVolume);
    this.padPresence = [this.input.hasPad(0), this.input.hasPad(1)];
  }

  private hint(p: 0 | 1) {
    const slot: 0 | 1 = p === 1 && this.cfg.controllers[0] === "cpu" ? 0 : p;
    if (this.input.hasPad(slot)) return [PAD_LABELS.special, `↓${PAD_LABELS.special}`, `F+${PAD_LABELS.special}`, PAD_LABELS.ult];
    const b = this.cfg.settings.bindings[slot];
    const sp = keyLabel(b.special[0] ?? "");
    return [sp, `↓${sp}`, `F+${sp}`, keyLabel(b.ult[0] ?? "")];
  }

  private refreshHints() {
    this.renderer.hud.hints = [this.cfg.controllers[0] === "cpu" ? ["", "", "", ""] : this.hint(0), this.cfg.controllers[1] === "cpu" ? ["", "", "", ""] : this.hint(1)];
  }

  start() {
    if (!this.cfg.silent) {
      this.input.attach();
      audio.unlock();
      if (!this.paused) audio.startMusic(this.cfg.arena.music);
    }
    this.startedAt = performance.now();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    if (!this.cfg.silent) {
      audio.stopMusic();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) audio.stopMusic();
    else {
      audio.startMusic(this.cfg.arena.music);
      this.last = performance.now();
    }
  }

  applySettings(s: Settings) {
    this.cfg.settings = s;
    this.input.setBindings(s.bindings);
    this.refreshHints();
    this.renderer.settings.screenShake = s.screenShake;
    this.renderer.settings.blood = s.blood;
    this.renderer.settings.showHitboxes = s.showHitboxes;
    audio.announcer = s.announcer;
    audio.setVolumes(s.sfxVolume, s.musicVolume);
  }

  get isPaused() {
    return this.paused;
  }

  rematch() {
    this.match.rematch();
    this.ai.forEach((a) => a?.reset());
    this.renderer.reset();
    this.kos = [0, 0];
    this.perfects = [0, 0];
    this.startedAt = performance.now();
    this.paused = false;
    audio.startMusic(this.cfg.arena.music);
  }

  resize() {
    this.renderer.resize();
  }

  private read(p: 0 | 1): InputFrame {
    const ai = this.ai[p];
    if (ai) {
      const me = this.match.fighters[p];
      const opp = this.match.fighters[p === 0 ? 1 : 0];
      return ai.tick(me, opp, this.match);
    }
    // In "CPU vs player" (controllers ["cpu","human"]), the human uses player-1 keys
    if (p === 1 && this.cfg.controllers[0] === "cpu") return this.input.read(0);
    return this.input.read(p);
  }

  private loop = (ts: number) => {
    if (this.destroyed) return;
    const dt = Math.max(0, Math.min(0.1, (ts - this.last) / 1000));
    this.last = ts;
    const pads: [boolean, boolean] = [this.input.hasPad(0), this.input.hasPad(1)];
    if (pads[0] !== this.padPresence[0] || pads[1] !== this.padPresence[1]) {
      this.padPresence = pads;
      this.refreshHints();
    }

    // Pause key (Escape / P / Start)
    const pauseDown = this.input.isDown("Escape") || this.input.isDown("KeyP") || this.input.padButton(BTN.START);
    if (pauseDown && !this.pauseKeyHeld && this.match.phase !== "over") this.cfg.onPauseRequest?.();
    this.pauseKeyHeld = pauseDown;

    if (!this.paused) {
      this.acc += dt * this.match.timeScale;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.match.step([this.read(0), this.read(1)]);
        this.handleEvents(this.match.events);
        this.match.events.length = 0;
        this.acc -= STEP;
        steps++;
      }
      if (steps === 5) this.acc = 0;
      this.renderer.frame(this.match, dt);
    } else {
      this.renderer.frame(this.match, 0);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private handleEvents(events: MatchEvent[]) {
    if (!events.length) return;
    this.renderer.consume(events, this.match);
    if (this.cfg.silent) {
      for (const e of events) if (e.type === "matchOver") this.cfg.onMatchOver(this.summary(e.winner as 0 | 1 | null));
      return;
    }
    for (const e of events) {
      switch (e.type) {
        case "sfx":
          audio.play(e.key, e.volume ?? 1);
          break;
        case "round":
          audio.say(this.match.round === 1 && e.round === 1 ? "Round one" : `Round ${e.round}`);
          break;
        case "fight":
          audio.say("Fight!");
          break;
        case "ko":
          this.kos[e.winner]++;
          audio.say("K. O.");
          break;
        case "roundOver":
          if (e.winner !== null && e.perfect) {
            this.perfects[e.winner]++;
            audio.say("Perfect!");
          }
          break;
        case "matchOver": {
          const w = e.winner as 0 | 1 | null;
          if (w !== null) audio.say(`${this.match.fighters[w].def.name} wins`);
          audio.stopMusic();
          this.cfg.onMatchOver(this.summary(w));
          break;
        }
      }
    }
  }

  private summary(winner: 0 | 1 | null): MatchSummary {
    const m = this.match;
    const f = (i: 0 | 1): FighterSummary => {
      const x = m.fighters[i];
      return {
        name: x.def.name,
        id: x.def.id,
        maxCombo: x.maxCombo,
        damage: Math.round(x.damageDealt),
        hits: x.hitsLanded,
        specials: x.specialsUsed,
        ults: x.ultsUsed,
        roundWins: m.wins[i],
        kos: this.kos[i],
        perfects: this.perfects[i],
        healthLeft: Math.max(0, x.health / x.def.maxHealth),
      };
    };
    return { winner, fighters: [f(0), f(1)], fastestKo: m.fastestKo, seconds: (performance.now() - this.startedAt) / 1000 };
  }

  /** Neutral input helper for menus/demos */
  static neutral = emptyInput;
}
