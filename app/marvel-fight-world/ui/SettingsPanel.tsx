"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Difficulty } from "../engine/ai";
import { ACTION_LABEL, DEFAULT_BINDINGS, keyLabel, type Bindings, type InputManager } from "../engine/input";
import type { Action } from "../engine/types";
import { ACTIONS } from "../engine/types";
import type { Settings } from "../data/storage";
import { ArcadeButton } from "./shared";

export default function SettingsPanel({
  settings,
  input,
  onChange,
  onResetStats,
  onBack,
}: {
  settings: Settings;
  input: InputManager;
  onChange: (s: Settings) => void;
  onResetStats: () => void;
  onBack: () => void;
}) {
  const [listening, setListening] = useState<{ p: 0 | 1; a: Action } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  // Capture the next key press for remapping
  useEffect(() => {
    if (!listening) return;
    input.attach();
    input.onAnyKey = (code) => {
      if (code === "Escape") {
        setListening(null);
        return true;
      }
      const b = settings.bindings.map((x) => ({ ...x })) as [Bindings, Bindings];
      // A key can only do one thing: remove it from every other action
      for (const pb of b) for (const a of ACTIONS) pb[a] = pb[a].filter((c) => c !== code);
      b[listening.p][listening.a] = [code];
      onChange({ ...settings, bindings: b });
      setListening(null);
      return true;
    };
    return () => {
      input.onAnyKey = null;
    };
  }, [listening, input, settings, onChange]);

  const row = (label: string, children: ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-2">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
  const choice = <T extends string | number | boolean>(cur: T, val: T, label: string, onPick: (v: T) => void) => (
    <button
      key={String(val)}
      onClick={() => onPick(val)}
      className={`border-2 border-black px-3 py-1 text-xs font-black uppercase ${cur === val ? "bg-yellow-400 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mfw-scroll absolute inset-0 overflow-y-auto p-3 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-3">
          <ArcadeButton tone="ghost" onClick={onBack}>
            ← Menu
          </ArcadeButton>
          <h1 className="mfw-title text-3xl sm:text-5xl">Settings</h1>
        </div>

        <div className="mfw-panel p-4">
          {row(
            "CPU difficulty",
            (["easy", "normal", "hard", "insane"] as Difficulty[]).map((d) => choice(settings.difficulty, d, d, (v) => set("difficulty", v)))
          )}
          {row(
            "Rounds to win",
            ([1, 2, 3] as const).map((r) => choice(settings.rounds, r, String(r), (v) => set("rounds", v)))
          )}
          {row(
            "Impact effects (blood)",
            (["off", "light", "arcade"] as const).map((b) => choice(settings.blood, b, b, (v) => set("blood", v)))
          )}
          {row(
            "Touch controls",
            (["auto", "on", "off"] as const).map((b) => choice(settings.touchControls, b, b, (v) => set("touchControls", v)))
          )}
          {row(
            "Show hitboxes (training)",
            [choice(settings.showHitboxes, false, "off", (v) => set("showHitboxes", v)), choice(settings.showHitboxes, true, "on", (v) => set("showHitboxes", v))]
          )}
          {row(
            `Sound effects — ${Math.round(settings.sfx * 100)}%`,
            <input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={(e) => set("sfx", Number(e.target.value))} className="w-48 accent-yellow-400" />
          )}
          {row(
            `Music — ${Math.round(settings.music * 100)}%`,
            <input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={(e) => set("music", Number(e.target.value))} className="w-48 accent-yellow-400" />
          )}
        </div>

        <div className="mfw-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-widest text-yellow-300">Controls</h2>
            <ArcadeButton tone="ghost" onClick={() => set("bindings", DEFAULT_BINDINGS)}>
              Reset controls
            </ArcadeButton>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {([0, 1] as const).map((p) => (
              <div key={p}>
                <div className="mb-1 text-xs font-black uppercase tracking-widest text-white/50">Player {p + 1}</div>
                {ACTIONS.map((a) => {
                  const on = listening?.p === p && listening.a === a;
                  return (
                    <div key={a} className="flex items-center justify-between border-b border-white/5 py-1 text-sm">
                      <span className="text-white/70">{ACTION_LABEL[a]}</span>
                      <button
                        onClick={() => setListening({ p, a })}
                        className={`min-w-[5rem] border-2 border-black px-2 py-0.5 font-mono text-xs font-bold ${on ? "animate-pulse bg-yellow-400 text-black" : "bg-white/10 hover:bg-white/20"}`}
                      >
                        {on ? "press key…" : settings.bindings[p][a].map(keyLabel).join(" / ") || "—"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/50">Gamepads work automatically (pad 1 → Player 1, pad 2 → Player 2): D-pad/stick to move, X light, Y heavy, A kick, B special, LB/LT block, RB/RT ultimate.</p>
        </div>

        <div className="mfw-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm font-bold">Reset all local stats and the leaderboard</span>
          {confirmReset ? (
            <div className="flex gap-2">
              <ArcadeButton
                tone="danger"
                onClick={() => {
                  onResetStats();
                  setConfirmReset(false);
                }}
              >
                Yes, wipe it
              </ArcadeButton>
              <ArcadeButton tone="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </ArcadeButton>
            </div>
          ) : (
            <ArcadeButton tone="danger" onClick={() => setConfirmReset(true)}>
              Reset stats
            </ArcadeButton>
          )}
        </div>
        <p className="pb-6 text-[11px] text-white/40">Settings are saved in this browser.</p>
      </div>
    </div>
  );
}
