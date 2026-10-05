"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { audio } from "../audio/audio";
import type { Difficulty } from "../engine/ai";
import { ACTIONS, type Action } from "../engine/types";
import { DEFAULT_SETTINGS, type BloodLevel, type Settings } from "../data/storage";
import { ACTION_LABEL, DEFAULT_BINDINGS, keyLabel } from "../input/input";
import { ArcadeButton, Backdrop, Keycap, P_COLORS, ScreenTitle, cn } from "./kit";

function Choice<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/10">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => {
            onChange(v);
            audio.ui("select");
          }}
          className={cn("rounded-lg px-3.5 py-1.5 text-sm font-bold uppercase tracking-wide transition", v === value ? "bg-amber-300 text-slate-950 shadow-[0_0_20px_-4px_rgba(252,211,77,0.8)]" : "text-white/60 hover:bg-white/10 hover:text-white")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] py-4 last:border-0">
      <div>
        <p className="font-semibold text-white">{label}</p>
        {hint && <p className="text-[13px] text-white/50">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex w-64 items-center gap-3">
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="w-full accent-amber-300" />
      <span className="w-10 text-right font-mono text-sm text-white/70">{Math.round(value * 100)}</span>
    </div>
  );
}

export function SettingsScreen({ settings, onChange, onBack }: { settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  const [listening, setListening] = useState<[0 | 1, Action] | null>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  // Key capture for remapping
  useEffect(() => {
    if (!listening) {
      const onKey = (e: KeyboardEvent) => {
        if (e.code === "Escape") onBack();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const [p, action] = listening;
      if (e.code !== "Escape") {
        // A key can only do one thing per player: steal it from other actions
        const b = settings.bindings.map((x) => ({ ...x })) as Settings["bindings"];
        for (const a of ACTIONS) b[p][a] = b[p][a].filter((c) => c !== e.code);
        b[p][action] = [e.code];
        onChange({ ...settings, bindings: b });
        audio.ui("confirm");
      }
      setListening(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, settings, onChange, onBack]);

  return (
    <div data-pad-menu className="absolute inset-0 isolate overflow-hidden text-white">
      <Backdrop tint="#0ea5e9" />
      <div className="fw-thin-scroll h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <ScreenTitle
            kicker="Options"
            title="Settings"
            right={
              <ArcadeButton tone="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_SETTINGS, bindings: DEFAULT_BINDINGS })}>
                <RotateCcw className="h-4 w-4" /> Defaults
              </ArcadeButton>
            }
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white/[0.04] px-6 py-2 ring-1 ring-white/10 backdrop-blur">
              <h2 className="fw-display pt-4 text-xl font-[650] uppercase text-amber-300">Gameplay</h2>
              <Row label="CPU difficulty" hint="Reaction time, blocking and combo skill">
                <Choice<Difficulty> value={settings.difficulty} onChange={(v) => set("difficulty", v)} options={[["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"], ["insane", "Insane"]]} />
              </Row>
              <Row label="Rounds to win">
                <Choice<number> value={settings.roundsToWin} onChange={(v) => set("roundsToWin", v as 1 | 2)} options={[[1, "1"], [2, "2 (best of 3)"]]} />
              </Row>
              <Row label="Blood" hint="Stylized comic splashes only">
                <Choice<BloodLevel> value={settings.blood} onChange={(v) => set("blood", v)} options={[["off", "Off"], ["light", "Light"], ["arcade", "Arcade"]]} />
              </Row>
              <Row label="Screen shake">
                <Choice<number> value={settings.screenShake ? 1 : 0} onChange={(v) => set("screenShake", v === 1)} options={[[1, "On"], [0, "Off"]]} />
              </Row>
              <Row label="Show hitboxes" hint="Training overlay: hurtboxes & active hitboxes">
                <Choice<number> value={settings.showHitboxes ? 1 : 0} onChange={(v) => set("showHitboxes", v === 1)} options={[[1, "On"], [0, "Off"]]} />
              </Row>
            </section>

            <section className="rounded-2xl bg-white/[0.04] px-6 py-2 ring-1 ring-white/10 backdrop-blur">
              <h2 className="fw-display pt-4 text-xl font-[650] uppercase text-amber-300">Audio</h2>
              <Row label="Sound effects">
                <Slider
                  value={settings.sfxVolume}
                  onChange={(v) => {
                    set("sfxVolume", v);
                    audio.setVolumes(v, settings.musicVolume);
                    audio.play("jab", 0.8);
                  }}
                />
              </Row>
              <Row label="Music">
                <Slider value={settings.musicVolume} onChange={(v) => set("musicVolume", v)} />
              </Row>
              <Row label="Announcer" hint="Uses your browser's built-in voice">
                <Choice<number> value={settings.announcer ? 1 : 0} onChange={(v) => set("announcer", v === 1)} options={[[1, "On"], [0, "Off"]]} />
              </Row>
              <p className="py-4 text-[13px] text-white/45">All sounds are synthesized live in your browser — no recorded audio is used.</p>
            </section>
          </div>

          <section className="mt-6 rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="fw-display text-xl font-[650] uppercase text-amber-300">Controls</h2>
                <p className="text-[13px] text-white/50">Click a key, then press the new one (Esc cancels). Gamepads work automatically; touch controls appear on phones.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              {([0, 1] as const).map((p) => (
                <div key={p}>
                  <p className="fw-display mb-2 text-lg font-[650] uppercase" style={{ color: P_COLORS[p] }}>
                    Player {p + 1}
                  </p>
                  <div className="grid gap-1.5">
                    {ACTIONS.map((a) => {
                      const active = listening?.[0] === p && listening[1] === a;
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setListening([p, a])}
                          className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition", active ? "bg-amber-300/15 ring-2 ring-amber-300" : "bg-black/20 ring-1 ring-white/10 hover:bg-white/10")}
                        >
                          <span className="text-white/80">{ACTION_LABEL[a]}</span>
                          {active ? (
                            <span className="animate-pulse font-mono text-xs font-bold uppercase text-amber-300">Press a key…</span>
                          ) : (
                            <span className="flex gap-1">
                              {settings.bindings[p][a].length ? settings.bindings[p][a].map((c) => <Keycap key={c}>{keyLabel(c)}</Keycap>) : <span className="text-xs text-rose-300">unbound</span>}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
