/* ------------------------------------------------------------------ */
/*  Gamepad support (Xbox / any "standard"-mapped controller, USB or    */
/*  Bluetooth).                                                         */
/*                                                                      */
/*  - In fights the GameSession reads pads directly (InputManager).     */
/*  - Everywhere else this bridge turns the pad into UI input:          */
/*      · overlays marked [data-pad-menu] get spatial focus navigation  */
/*        (D-pad / stick moves a visible focus ring, A presses,         */
/*        B presses [data-pad-back] or sends Escape)                    */
/*      · plain screens get synthetic keys (arrows, Enter, Escape …)    */
/*        so the existing keyboard handlers just work.                  */
/*                                                                      */
/*  Standard mapping (Xbox names): 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB,      */
/*  6 LT, 7 RT, 8 View, 9 Menu/Start, 10 LS, 11 RS, 12-15 D-pad.        */
/* ------------------------------------------------------------------ */

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export function connectedPads(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  try {
    return Array.from(navigator.getGamepads() ?? []).filter((p): p is Gamepad => !!p && p.connected !== false && p.buttons.length > 0);
  } catch {
    return []; // blocked by a permissions policy
  }
}

/** A pad's buttons in the *standard* layout (17 slots) + left stick, whatever the browser reports. */
export interface PadState {
  b: boolean[];
  lx: number;
  ly: number;
}

const held = (p: Gamepad, i: number) => {
  const b = p.buttons[i];
  return !!b && (b.pressed || b.value > 0.4);
};

/**
 * Xbox controllers paired over Bluetooth can show up *without* the
 * "standard" mapping (Firefox, older Chrome builds, older controller
 * firmware). Their HID layout is A0 B1 X3 Y4 LB6 RB7 View10 Menu11 LS13 RS14,
 * triggers on axes and the D-pad as a single "hat" axis. Normalise all of
 * that so the rest of the game only ever sees the standard layout.
 */
export function padState(p: Gamepad): PadState {
  const b = new Array<boolean>(17).fill(false);
  let lx = p.axes[0] ?? 0;
  let ly = p.axes[1] ?? 0;
  if (p.mapping === "standard") {
    for (let i = 0; i < 17; i++) b[i] = held(p, i);
    return { b, lx, ly };
  }
  const id = p.id.toLowerCase();
  const xboxHid = (id.includes("045e") || id.includes("xbox")) && p.buttons.length >= 15;
  const map: [number, number][] = xboxHid
    ? [
        [BTN.A, 0],
        [BTN.B, 1],
        [BTN.X, 3],
        [BTN.Y, 4],
        [BTN.LB, 6],
        [BTN.RB, 7],
        [BTN.VIEW, 10],
        [BTN.START, 11],
        [10, 13],
        [11, 14],
      ]
    : // Unknown controller: assume the common SNES-style order for the first 12 buttons
      Array.from({ length: Math.min(12, p.buttons.length) }, (_, i) => [i, i] as [number, number]);
  for (const [std, raw] of map) b[std] = held(p, raw);
  // Some HID layouts also report the triggers as buttons 8/9
  if (xboxHid) {
    b[BTN.LT] = held(p, 8);
    b[BTN.RT] = held(p, 9);
  }
  // D-pad as a hat switch (Chrome/Windows HID: axis 9; -1 = up … 1 = up-left, >1 = centred)
  const hat = p.axes.length >= 10 ? p.axes[9] : undefined;
  if (hat !== undefined && Math.abs(hat) <= 1.05) {
    const dir = Math.round(((hat + 1) * 7) / 2) % 8; // 0 up, 1 up-right, 2 right … 7 up-left
    b[BTN.UP] = dir === 7 || dir === 0 || dir === 1;
    b[BTN.RIGHT] = dir >= 1 && dir <= 3;
    b[BTN.DOWN] = dir >= 3 && dir <= 5;
    b[BTN.LEFT] = dir >= 5 && dir <= 7;
  } else if (p.axes.length >= 8 && !xboxHid) {
    // Linux-style D-pad axes 6/7
    b[BTN.LEFT] = p.axes[6] < -0.5;
    b[BTN.RIGHT] = p.axes[6] > 0.5;
    b[BTN.UP] = p.axes[7] < -0.5;
    b[BTN.DOWN] = p.axes[7] > 0.5;
  }
  if (!Number.isFinite(lx)) lx = 0;
  if (!Number.isFinite(ly)) ly = 0;
  return { b, lx, ly };
}

/** Friendly controller name from the browser's id string. */
export function padName(p: Gamepad) {
  const id = p.id.toLowerCase();
  if (id.includes("xbox") || id.includes("xinput") || id.includes("045e")) return "Xbox controller";
  if (id.includes("dualsense") || id.includes("dualshock") || id.includes("054c")) return "PlayStation controller";
  if (id.includes("pro controller") || id.includes("057e")) return "Switch Pro controller";
  return "Controller";
}

/** Gameplay button labels (Xbox layout) used by the HUD and the controls card. */
export const PAD_LABELS = {
  lp: "X",
  hp: "Y",
  kick: "A",
  special: "B",
  block: "LB",
  ult: "RB",
  pause: "☰",
} as const;

/* ── Bridge state ──────────────────────────────────────────────────── */
let suspended = 0;
/** A live fight owns the pad (GameSession reads it directly). */
export function suspendPadBridge() {
  suspended++;
  return () => {
    suspended = Math.max(0, suspended - 1);
  };
}

type Dir = "up" | "down" | "left" | "right";
const DIR_KEY: Record<Dir, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const KEY_NAME: Record<string, string> = { Enter: "Enter", Escape: "Escape", KeyM: "m", KeyV: "v", KeyC: "c", KeyR: "r", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight" };

function sendKey(type: "keydown" | "keyup", code: string, repeat = false) {
  const target = document.body;
  target.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_NAME[code] ?? code, bubbles: true, cancelable: true, repeat }));
}

function activeMenu(): HTMLElement | null {
  const menus = Array.from(document.querySelectorAll<HTMLElement>("[data-pad-menu], [role=dialog]")).filter((m) => m.getClientRects().length > 0);
  return menus[menus.length - 1] ?? null;
}

function focusables(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [data-pad-item]")).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  });
}

/** Focus + mark an item so the pad highlight shows even without :focus-visible. */
function focusEl(el: HTMLElement) {
  document.querySelectorAll("[data-pad-focused]").forEach((n) => n.removeAttribute("data-pad-focused"));
  el.setAttribute("data-pad-focused", "");
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function currentItem(root: HTMLElement, items: HTMLElement[]) {
  const marked = root.querySelector<HTMLElement>("[data-pad-focused]");
  if (marked && items.includes(marked)) return marked;
  const cur = document.activeElement as HTMLElement | null;
  return cur && items.includes(cur) ? cur : null;
}

/** Move focus to the nearest focusable in a direction (spatial navigation). */
function moveFocus(root: HTMLElement, dir: Dir) {
  const items = focusables(root);
  if (!items.length) return;
  const cur = currentItem(root, items);
  if (!cur) {
    focusEl(items[0]);
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const main = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (main <= 4) continue;
    const score = main + cross * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) focusEl(best);
}

/* ── Bridge loop ───────────────────────────────────────────────────── */
export interface PadBridgeOptions {
  onConnect?: (name: string) => void;
  onDisconnect?: () => void;
  /** Fired on any pad activity (used to show focus rings) */
  onActive?: () => void;
}

const REPEAT_DELAY = 360;
const REPEAT_RATE = 115;

export function startPadBridge(opts: PadBridgeOptions = {}) {
  if (typeof window === "undefined") return () => {};
  let raf = 0;
  const prev = new Map<number, boolean>();
  const dirState: Record<Dir, { down: boolean; next: number }> = {
    up: { down: false, next: 0 },
    down: { down: false, next: 0 },
    left: { down: false, next: 0 },
    right: { down: false, next: 0 },
  };
  const heldKeys = new Set<string>();

  const onConnect = (e: GamepadEvent) => opts.onConnect?.(padName(e.gamepad));
  const onDisconnect = () => opts.onDisconnect?.();
  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onDisconnect);
  // Pads already connected before the page loaded show up after the first press
  let announced = false;

  const releaseAll = () => {
    heldKeys.forEach((k) => sendKey("keyup", k));
    heldKeys.clear();
    for (const d of Object.keys(dirState) as Dir[]) dirState[d].down = false;
  };

  const press = (code: string) => {
    sendKey("keydown", code);
    heldKeys.add(code);
  };
  const release = (code: string) => {
    if (heldKeys.delete(code)) sendKey("keyup", code);
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const pads = connectedPads();
    if (!pads.length) return;
    if (!announced) {
      announced = true;
      opts.onConnect?.(padName(pads[0]));
    }
    if (document.hidden || (suspended > 0 && !activeMenu())) {
      if (heldKeys.size) releaseAll();
      // Keep edge state current so buttons held into/out of a fight don't re-fire
      const snap = pads.map(padState);
      for (let i = 0; i < 17; i++) prev.set(i, snap.some((st) => st.b[i]));
      return;
    }

    const states = pads.map(padState);
    const btn = (i: number) => states.some((st) => st.b[i]);
    const edge = (i: number) => {
      const on = btn(i);
      const was = prev.get(i) ?? false;
      prev.set(i, on);
      return on && !was ? "down" : !on && was ? "up" : null;
    };
    const strongest = (k: "lx" | "ly") => states.reduce((v, st) => (Math.abs(st[k]) > Math.abs(v) ? st[k] : v), 0);
    const ax = strongest("lx");
    const ay = strongest("ly");
    const dirs: Record<Dir, boolean> = {
      up: btn(BTN.UP) || ay < -0.55,
      down: btn(BTN.DOWN) || ay > 0.55,
      left: btn(BTN.LEFT) || ax < -0.55,
      right: btn(BTN.RIGHT) || ax > 0.55,
    };
    // Track edges for every button we care about
    const e = {
      a: edge(BTN.A),
      b: edge(BTN.B),
      x: edge(BTN.X),
      y: edge(BTN.Y),
      view: edge(BTN.VIEW),
      start: edge(BTN.START),
    };
    for (const i of [BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT, BTN.LB, BTN.RB, BTN.LT, BTN.RT]) edge(i);

    const any = Object.values(e).some(Boolean) || Object.values(dirs).some(Boolean);
    if (any) opts.onActive?.();

    const menu = activeMenu();

    // Directions (with key-repeat)
    for (const d of Object.keys(dirs) as Dir[]) {
      const s = dirState[d];
      const fire = dirs[d] && (!s.down || now >= s.next);
      if (fire) {
        s.next = now + (s.down ? REPEAT_RATE : REPEAT_DELAY);
        if (menu) moveFocus(menu, d);
        else {
          sendKey("keydown", DIR_KEY[d], s.down);
          heldKeys.add(DIR_KEY[d]);
        }
      }
      if (!dirs[d] && s.down) release(DIR_KEY[d]);
      s.down = dirs[d];
    }

    if (menu) {
      // Overlay with buttons: A presses the focused item, B goes back
      if (e.a === "down" || e.start === "down") {
        const items = focusables(menu);
        const target = currentItem(menu, items) ?? items[0];
        target?.click();
      }
      if (e.b === "down") {
        const back = menu.querySelector<HTMLElement>("[data-pad-back]");
        if (back) back.click();
        else {
          sendKey("keydown", "Escape");
          sendKey("keyup", "Escape");
        }
      }
      // Ensure something is focused so the player can see where they are
      if (any) {
        const items = focusables(menu);
        const c = currentItem(menu, items) ?? items[0];
        if (c && !c.hasAttribute("data-pad-focused")) focusEl(c);
      }
      return;
    }

    // Plain screens: synthetic keys for the existing keyboard handlers
    const map: [keyof typeof e, string][] = [
      ["a", "Enter"],
      ["start", "Enter"],
      ["b", "Escape"],
      ["x", "KeyC"],
      ["y", "KeyV"],
      ["view", "KeyM"],
    ];
    for (const [k, code] of map) {
      if (e[k] === "down") press(code);
      else if (e[k] === "up") release(code);
    }
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    releaseAll();
    window.removeEventListener("gamepadconnected", onConnect);
    window.removeEventListener("gamepaddisconnected", onDisconnect);
  };
}
