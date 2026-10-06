/* ------------------------------------------------------------------ */
/*  Input manager: keyboard + gamepad + touch → InputFrame per player   */
/*                                                                      */
/*  Gameplay never listens to key events directly. Sources write into   */
/*  this manager; the game loop reads one snapshot per simulation step. */
/* ------------------------------------------------------------------ */

import { ACTIONS, type Action, type InputFrame, emptyInput } from "../engine/types";
import { BTN, connectedPads, padState } from "./gamepad";

export type Bindings = Record<Action, string[]>;

/** KeyboardEvent.code values (layout independent). */
export const DEFAULT_BINDINGS: [Bindings, Bindings] = [
  {
    left: ["KeyA"],
    right: ["KeyD"],
    up: ["KeyW", "Space"],
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
    ult: ["Numpad6", "Backslash"],
  },
];

export const ACTION_LABEL: Record<Action, string> = {
  left: "Left",
  right: "Right",
  up: "Jump",
  down: "Crouch",
  lp: "Light punch",
  hp: "Heavy punch",
  kick: "Kick",
  special: "Special",
  block: "Block",
  ult: "Ultimate",
};

export function keyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  const map: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Space: "Space",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    Backslash: "\\",
    Enter: "Enter",
    ShiftLeft: "L-Shift",
    ShiftRight: "R-Shift",
  };
  return map[code] ?? code;
}

/** Standard gamepad layout → actions (fight-pad style). */
const PAD: Partial<Record<Action, number[]>> = {
  lp: [BTN.X],
  hp: [BTN.Y],
  kick: [BTN.B],
  special: [BTN.RB],
  block: [BTN.LT, BTN.RT],
  up: [BTN.A, BTN.UP],
  down: [BTN.DOWN],
  left: [BTN.LEFT],
  right: [BTN.RIGHT],
};

export class InputManager {
  private keys = new Set<string>();
  private touch: [Set<Action>, Set<Action>] = [new Set(), new Set()];
  private bindings: [Bindings, Bindings];
  /** When true, player 1 may also use player 2's keys (single-player). */
  shareKeys = false;
  private listening = false;
  private gameKeys = new Set<string>();

  constructor(bindings: [Bindings, Bindings] = DEFAULT_BINDINGS) {
    this.bindings = bindings;
    this.rebuild();
  }

  setBindings(b: [Bindings, Bindings]) {
    this.bindings = b;
    this.rebuild();
  }

  private rebuild() {
    this.gameKeys = new Set(this.bindings.flatMap((b) => Object.values(b).flat()));
  }

  private onDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    this.keys.add(e.code);
    if (this.gameKeys.has(e.code)) e.preventDefault();
  };
  private onUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
    this.touch[0].clear();
    this.touch[1].clear();
  };

  attach() {
    if (this.listening || typeof window === "undefined") return;
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    this.listening = true;
  }

  detach() {
    if (!this.listening) return;
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
    this.listening = false;
    this.keys.clear();
  }

  /** Touch / on-screen buttons */
  setTouch(player: 0 | 1, action: Action, down: boolean) {
    if (down) this.touch[player].add(action);
    else this.touch[player].delete(action);
  }

  /** One snapshot for a player. */
  read(player: 0 | 1): InputFrame {
    const out = emptyInput();
    const maps = player === 0 && this.shareKeys ? this.bindings : [this.bindings[player]];
    for (const a of ACTIONS) {
      if (maps.some((b) => b[a].some((k) => this.keys.has(k)))) out[a] = true;
      if (this.touch[player].has(a)) out[a] = true;
    }
    this.readPad(player, out);
    return out;
  }

  private readPad(player: 0 | 1, out: InputFrame) {
    const pads = connectedPads();
    // Single player (vs CPU): every connected controller drives player 1, so a
    // second/virtual device sitting in slot 0 can never "steal" the real pad.
    const mine = player === 0 && this.shareKeys ? pads : pads[player] ? [pads[player]] : [];
    for (const pad of mine) {
      const st = padState(pad);
      for (const a of ACTIONS) {
        const idx = PAD[a];
        if (idx?.some((i) => st.b[i])) out[a] = true;
      }
      // Ultimate is a deliberate two-trigger chord, never an accidental
      // single-trigger press while guarding.
      if (st.b[BTN.LT] && st.b[BTN.RT]) {
        out.ult = true;
        out.block = false;
      }
      if (st.lx < -0.5) out.left = true;
      if (st.lx > 0.5) out.right = true;
      if (st.ly < -0.6) out.up = true;
      if (st.ly > 0.6) out.down = true;
    }
  }

  /** Is a button held on any connected pad (Start → pause etc.) */
  padButton(i: number) {
    return connectedPads().some((p) => padState(p).b[i]);
  }

  /** Is a pad connected for this player slot */
  hasPad(player: 0 | 1) {
    return connectedPads().length > player;
  }

  /** Is a raw key down (menus/pause) */
  isDown(code: string) {
    return this.keys.has(code);
  }
}
