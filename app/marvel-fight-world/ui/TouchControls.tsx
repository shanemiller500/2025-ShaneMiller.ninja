"use client";

/* ------------------------------------------------------------------ */
/*  On-screen controls: writes into InputManager.touch, the same input  */
/*  path as keyboard and gamepad.                                       */
/* ------------------------------------------------------------------ */

import { useEffect, useState, type PointerEvent } from "react";
import type { InputManager } from "../engine/input";
import type { Action } from "../engine/types";
import css from "./fight-world.module.css";

const BUTTONS: { a: Action; label: string }[] = [
  { a: "lp", label: "LP" },
  { a: "hp", label: "HP" },
  { a: "kick", label: "K" },
  { a: "block", label: "BLK" },
  { a: "special", label: "SP" },
  { a: "ult", label: "ULT" },
];

export default function TouchControls({ input, mode, player }: { input: InputManager; mode: "auto" | "on" | "off"; player: 0 | 1 }) {
  const [show, setShow] = useState(false);
  const [on, setOn] = useState<Partial<Record<Action, boolean>>>({});

  useEffect(() => {
    if (mode === "off") return setShow(false);
    if (mode === "on") return setShow(true);
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    setShow(!!coarse);
  }, [mode]);

  useEffect(() => {
    const t = input.touch[player];
    return () => {
      for (const k of Object.keys(t) as Action[]) t[k] = false;
    };
  }, [input, player]);

  if (!show) return null;

  const set = (a: Action, v: boolean) => {
    input.touch[player][a] = v;
    setOn((o) => (o[a] === v ? o : { ...o, [a]: v }));
  };
  const bind = (a: Action) => ({
    onPointerDown: (e: PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      set(a, true);
    },
    onPointerUp: () => set(a, false),
    onPointerCancel: () => set(a, false),
    onPointerLeave: () => set(a, false),
    "data-on": !!on[a],
  });

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-4">
      <div className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1">
        <span />
        <button className={`${css.touchBtn} h-14 w-14`} {...bind("up")}>
          ▲
        </button>
        <span />
        <button className={`${css.touchBtn} h-14 w-14`} {...bind("left")}>
          ◀
        </button>
        <span />
        <button className={`${css.touchBtn} h-14 w-14`} {...bind("right")}>
          ▶
        </button>
        <span />
        <button className={`${css.touchBtn} h-14 w-14`} {...bind("down")}>
          ▼
        </button>
        <span />
      </div>
      <div className="pointer-events-auto mb-8 grid grid-cols-3 gap-2">
        {BUTTONS.map((b) => (
          <button key={b.a} className={`${css.touchBtn} h-14 w-14`} {...bind(b.a)}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
