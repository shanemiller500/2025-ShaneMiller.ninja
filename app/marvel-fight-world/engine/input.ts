/* ------------------------------------------------------------------ */
/*  Input manager                                                       */
/*                                                                      */
/*  One place that turns keyboard / gamepad / touch into InputFrames.   */
/*  Gameplay never listens to DOM events; the game loop asks for a      */
/*  snapshot each simulation step.                                      */
/* ------------------------------------------------------------------ */

import type { Action, InputFrame } from "./types";
import { ACTIONS, emptyInput } from "./types";

export type Bindings = Record<Action, string[]>;

/** KeyboardEvent.code values. */
export const DEFAULT_BINDINGS: [Bindings, Bindings] = [
  {
    left: ["KeyA"],
    right: ["KeyD"],
    up: ["KeyW"],
    down: ["KeyS"],
    lp: ["KeyJ"],
    hp: ["KeyK"],
    kick: ["KeyL"],
    special: ["KeyU"],
    block: ["KeyI"],
    ult: ["KeyO"],
  },
  {
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    lp: ["Numpad1", "Comma"],
    hp: ["Numpad2", "Period"],
    kick: ["Numpad3", "Slash"],
    special: ["Numpad4", "Semicolon"],
    block: ["Numpad5", "Quote"],
    ult: ["Numpad6", "BracketRight"],
  },
];

export const ACTION_LABEL: Record<Action, string> = {
  left: "Left",
  right: "Right",
  up: "Jump",
  down: "Crouch",
  lp: "Light Punch",
  hp: "Heavy Punch",
  kick: "Kick",
  special: "Special",
  block: "Block",
  ult: "Ultimate",
};

/** Pretty key name for UI ("KeyJ" → "J"). */
export function keyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  const map: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketRight: "]",
    BracketLeft: "[",
    Space: "Space",
    ShiftLeft: "L-Shift",
    ShiftRight: "R-Shift",
  };
  return map[code] ?? code;
}

/** Standard-mapping gamepad buttons per action. */
const PAD: Partial<Record<Action, number[]>> = {
  up: [12],
  down: [13],
  left: [14],
  right: [15],
  lp: [2], // X / Square
  hp: [3], // Y / Triangle
  kick: [0], // A / Cross
  special: [1], // B / Circle
  block: [4, 6], // LB / LT
  ult: [5, 7], // RB / RT
};

export class InputManager {
  private down = new Set<string>();
  private bindings: [Bindings, Bindings];
  /** Virtual (touch) state per player */
  readonly touch: [InputFrame, InputFrame] = [emptyInput(), emptyInput()];
  /** Which gamepad index drives which player (-1 = none) */
  padFor: [number, number] = [0, 1];
  private attached = false;
  /** Fired on any keydown — used by menus ("press any key") and key remapping */
  onAnyKey: ((code: string) => boolean | void) | null = null;

  constructor(bindings: [Bindings, Bindings] = DEFAULT_BINDINGS) {
    this.bindings = bindings;
  }

  setBindings(b: [Bindings, Bindings]) {
    this.bindings = b;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.onAnyKey && this.onAnyKey(e.code) === true) {
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (this.isBound(e.code)) e.preventDefault();
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => this.down.clear();

  attach() {
    if (this.attached || typeof window === "undefined") return;
    this.attached = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.down.clear();
  }

  private isBound(code: string) {
    return this.bindings.some((b) => ACTIONS.some((a) => b[a].includes(code)));
  }

  /** Snapshot for one player: keyboard ∪ gamepad ∪ touch. */
  read(player: 0 | 1): InputFrame {
    const out = emptyInput();
    const b = this.bindings[player];
    for (const a of ACTIONS) out[a] = b[a].some((c) => this.down.has(c)) || this.touch[player][a];
    this.readPad(player, out);
    return out;
  }

  private readPad(player: 0 | 1, out: InputFrame) {
    const idx = this.padFor[player];
    if (idx < 0 || typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pad = navigator.getGamepads()[idx];
    if (!pad) return;
    for (const a of ACTIONS) {
      const btns = PAD[a];
      if (btns?.some((i) => pad.buttons[i]?.pressed)) out[a] = true;
    }
    const [ax, ay] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
    if (ax < -0.5) out.left = true;
    if (ax > 0.5) out.right = true;
    if (ay < -0.6) out.up = true;
    if (ay > 0.6) out.down = true;
  }

  /** Is a key code currently held (menus)? */
  held(code: string) {
    return this.down.has(code);
  }
}
