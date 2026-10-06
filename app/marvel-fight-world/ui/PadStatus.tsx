"use client";

/* ------------------------------------------------------------------ */
/*  Always-visible controller status for the title screen. Says in      */
/*  plain words whether the browser is giving this tab a controller,    */
/*  and if not, why — so "the controller does nothing" is never a       */
/*  mystery.                                                            */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { padName, padState } from "../input/gamepad";

type Status =
  | { k: "unsupported" }
  | { k: "blocked"; why: string; openTab?: boolean }
  | { k: "waiting"; embedded: boolean }
  | { k: "connected"; name: string; mapping: string; pressed: string; raw: string };

const NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "LS", "RS", "↑", "↓", "←", "→"];

function probe(): Status {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return { k: "unsupported" };
  if (!window.isSecureContext) return { k: "blocked", why: "Open the game on https:// or http://localhost — browsers turn controllers off on plain http addresses." };
  const policy = (document as Document & { permissionsPolicy?: { allowsFeature: (name: string) => boolean } }).permissionsPolicy;
  if (policy && !policy.allowsFeature("gamepad")) return { k: "blocked", why: "This page's browser permissions policy blocks gamepads. Open the game directly in a browser tab.", openTab: true };
  let pads: (Gamepad | null)[];
  try {
    pads = Array.from(navigator.getGamepads() ?? []);
  } catch {
    return { k: "blocked", why: "This window isn't allowed to use controllers (embedded previews can block them). Open the game in Chrome or Edge directly.", openTab: true };
  }
  const p = pads.find((x): x is Gamepad => !!x && x.connected !== false);
  if (!p) return { k: "waiting", embedded: window.self !== window.top };
  const st = padState(p);
  const pressed = st.b.map((on, i) => (on && NAMES[i] ? NAMES[i] : null)).filter(Boolean).join(" ");
  const stick = Math.abs(st.lx) > 0.5 || Math.abs(st.ly) > 0.5 ? " stick" : "";
  const rawButtons = p.buttons.map((button, i) => button.pressed || button.value > 0.4 ? i : -1).filter((i) => i >= 0);
  const axes = p.axes.map((axis, i) => Math.abs(axis) > 0.4 ? `${i}:${axis.toFixed(2)}` : "").filter(Boolean);
  return { k: "connected", name: padName(p), mapping: p.mapping || "custom layout", pressed: pressed + stick, raw: `buttons ${rawButtons.join(",") || "none"} · axes ${axes.join(",") || "none"}` };
}

export function PadStatus() {
  const [s, setS] = useState<Status>({ k: "waiting", embedded: false });
  const [details, setDetails] = useState(false);
  useEffect(() => {
    const tick = () => setS(probe());
    tick();
    const id = window.setInterval(tick, 150);
    window.addEventListener("gamepadconnected", tick);
    window.addEventListener("gamepaddisconnected", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("gamepadconnected", tick);
      window.removeEventListener("gamepaddisconnected", tick);
    };
  }, []);

  const tone =
    s.k === "connected" ? "text-emerald-200 ring-emerald-400/40 bg-emerald-500/10" : s.k === "waiting" ? "text-white/70 ring-white/15 bg-black/45" : "text-amber-100 ring-amber-300/50 bg-amber-500/10";
  return (
    <div role="status" aria-live="polite" className={`absolute bottom-10 right-5 z-10 max-w-[min(440px,90vw)] rounded-xl px-3.5 py-2 text-[12px] ring-1 backdrop-blur ${tone}`}>
      <p className="flex items-center gap-2 font-semibold">
        <Gamepad2 className="h-4 w-4 shrink-0" />
        {s.k === "connected" ? `${s.name} connected` : s.k === "waiting" ? "Controller: press any button on it" : s.k === "unsupported" ? "This browser has no controller support" : "Controller blocked"}
      </p>
      <p className="mt-0.5 text-[11px] opacity-80">
        {s.k === "connected"
          ? s.pressed
            ? `Pressing: ${s.pressed}`
            : `Ready (${s.mapping}) · D-pad / stick to move · A to select`
          : s.k === "waiting"
            ? s.embedded ? "This preview may hide Bluetooth gamepads. Open the game in a browser tab, click it, then press A." : "Click this page once, then press A. The browser only exposes a paired controller after it receives controller input."
            : s.k === "unsupported"
              ? "Use the latest Chrome, Edge or Firefox."
              : s.why}
      </p>
      {s.k === "connected" && <button type="button" onClick={() => setDetails((v) => !v)} className="mt-1 text-left font-semibold text-emerald-200 underline underline-offset-2">{details ? "Hide input details" : "Show input details"}</button>}
      {s.k === "connected" && details && <p className="mt-1 font-mono text-[10px] opacity-75">{s.raw}</p>}
      {((s.k === "blocked" && s.openTab) || (s.k === "waiting" && s.embedded)) && <a href="/marvel-fight-world" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold text-amber-200 underline underline-offset-2">Open game in a browser tab</a>}
    </div>
  );
}
