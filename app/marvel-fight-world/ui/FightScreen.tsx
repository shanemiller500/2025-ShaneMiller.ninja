"use client";

/* ------------------------------------------------------------------ */
/*  FightScreen: owns the game loop for one match                       */
/*                                                                      */
/*  requestAnimationFrame → fixed 60 Hz simulation steps (with K.O.     */
/*  slow motion) → canvas render. The HUD is plain DOM updated through  */
/*  refs, so React does not re-render during combat.                    */
/* ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { FightAI, DIFFICULTY, type Difficulty } from "../engine/ai";
import type { InputManager } from "../engine/input";
import { ACTION_LABEL, keyLabel } from "../engine/input";
import { Match } from "../engine/match";
import { specialList } from "../engine/fighters";
import type { FighterDef, InputFrame } from "../engine/types";
import { ACTIONS } from "../engine/types";
import { playMusic, sfx, stinger, stopMusic } from "../audio/audio";
import type { ArenaDef } from "../render/arenas";
import { FightRenderer } from "../render/renderer";
import type { Settings } from "../data/storage";
import { ArcadeButton, Portrait } from "./shared";
import TouchControls from "./TouchControls";
import css from "./fight-world.module.css";

export interface FightSetup {
  p1: FighterDef;
  p2: FighterDef;
  cpu: [boolean, boolean];
  arena: ArenaDef;
  difficulty: Difficulty;
  rounds: number;
  /** Survival: starting health fractions */
  startHealth?: [number, number];
  /** Banner shown during the intro, e.g. "SURVIVAL — FIGHT 3" */
  label?: string;
}

export interface FightOutcome {
  winner: 0 | 1 | null;
  kos: [number, number];
  perfects: [number, number];
  maxCombo: [number, number];
  fastestKo: number | null;
  healthLeft: [number, number];
}

interface Props {
  setup: FightSetup;
  input: InputManager;
  settings: Settings;
  /** Changing this restarts the match (rematch) */
  matchKey: number;
  onEnd: (o: FightOutcome) => void;
  onQuit: () => void;
  /** Hide pause menu interactions while an overlay owns the screen */
  overlay?: boolean;
}

const STEP = 1 / 60;

const SLOT_LABEL: Record<string, string> = {
  lp: "Light",
  hp: "Heavy",
  kick: "Kick",
  low: "↓Kick",
  launcher: "↓Heavy",
  air: "Jump attack",
  throw: "Throw",
  s1: "Special",
  s2: "↓Special",
  s3: "→Special",
  ult: "Ultimate",
};

export default function FightScreen({ setup, input, settings, matchKey, onEnd, onQuit, overlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const matchRef = useRef<Match | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  pausedRef.current = paused;

  // Pause toggle (Escape / P) — a menu key, so it lives outside the simulation input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlayRef.current) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        setPaused((p) => !p);
        stinger("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    const cpuMul = DIFFICULTY[setup.difficulty].damage;
    const match = new Match({
      p1: setup.p1,
      p2: setup.p2,
      roundsToWin: setup.rounds,
      damageMul: [setup.cpu[0] ? cpuMul : 1, setup.cpu[1] ? cpuMul : 1],
      props: setup.arena.props,
      startHealth: setup.startHealth,
      seed: (Date.now() & 0xffff) + matchKey,
    });
    matchRef.current = match;
    const ais: [FightAI | null, FightAI | null] = [
      setup.cpu[0] ? new FightAI(0, setup.difficulty, matchKey * 13 + 1) : null,
      setup.cpu[1] ? new FightAI(1, setup.difficulty, matchKey * 13 + 2) : null,
    ];
    const renderer = new FightRenderer(setup.arena);
    renderer.blood = settings.blood;
    renderer.showBoxes = settings.showHitboxes;
    input.attach();
    playMusic("fight", setup.arena.tempo);

    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // HUD easing state
    const trail = [1, 1];
    const shown = [1, 1];
    const hold = [0, 0];
    let lastTimer = -1;
    let reported = false;
    let acc = 0;
    let last = performance.now();
    let raf = 0;

    const humanInput = (i: 0 | 1): InputFrame => (ais[i] ? ais[i]!.update(match) : input.read(i));

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        acc += dt * match.timeScale;
        let steps = 0;
        while (acc >= STEP && steps < 6) {
          match.step([humanInput(0), humanInput(1)]);
          for (const e of match.events) {
            if (e.type === "sfx") sfx(e.key, e.volume);
            else if (e.type === "fight") stinger("fight");
            else if (e.type === "round") stinger("round");
            else if (e.type === "matchOver") stinger("win");
          }
          renderer.consume(match.events, match);
          match.events.length = 0;
          renderer.tick();
          acc -= STEP;
          steps++;
        }
        if (steps === 6) acc = 0;
      }
      if (W > 0 && H > 0) renderer.draw(g, match, W, H);

      // HUD (direct DOM writes)
      const h = hud.current;
      match.fighters.forEach((f, i) => {
        const frac = Math.max(0, f.health / f.def.maxHealth);
        shown[i] += (frac - shown[i]) * 0.35;
        if (frac < trail[i]) {
          if (hold[i] <= 0) trail[i] = Math.max(frac, trail[i] - 0.008);
          else hold[i]--;
        } else {
          trail[i] = frac;
        }
        if (Math.abs(frac - shown[i]) > 0.002) hold[i] = 30;
        const fill = h[`fill${i}`];
        const tr = h[`trail${i}`];
        if (fill) {
          fill.style.width = `${shown[i] * 100}%`;
          fill.className = `${css.hudFill} ${frac < 0.3 ? css.hudFillLow : ""}`;
        }
        if (tr) tr.style.width = `${trail[i] * 100}%`;
        const mf = h[`meter${i}`];
        if (mf) {
          mf.style.width = `${f.meter}%`;
          mf.className = `${css.meterFill} ${f.meter >= 100 ? css.meterFull : ""}`;
        }
        const ml = h[`meterLabel${i}`];
        if (ml) ml.textContent = f.meter >= 100 ? "ULTIMATE READY!" : `SUPER ${Math.floor(f.meter)}%`;
        const gd = h[`guard${i}`];
        if (gd) gd.style.width = `${f.guard}%`;
        const pip = h[`wins${i}`];
        if (pip) pip.textContent = "★".repeat(match.wins[i]) + "☆".repeat(Math.max(0, match.roundsToWin - match.wins[i]));
      });
      if (match.timer !== lastTimer && h.timer) {
        lastTimer = match.timer;
        h.timer.textContent = String(match.timer).padStart(2, "0");
      }

      if (match.phase === "over" && !reported && match.phaseTime > 70) {
        reported = true;
        const [a, b] = match.fighters;
        onEndRef.current({
          winner: match.winner,
          kos: [...match.kos] as [number, number],
          perfects: [...match.perfects] as [number, number],
          maxCombo: [a.maxCombo, b.maxCombo],
          fastestKo: match.fastestKo,
          healthLeft: [a.health / a.def.maxHealth, b.health / b.def.maxHealth],
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stopMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey, setup]);

  const ref = (k: string) => (el: HTMLElement | null) => {
    hud.current[k] = el;
  };

  const side = (i: 0 | 1) => {
    const f = i === 0 ? setup.p1 : setup.p2;
    const right = i === 1;
    return (
      <div className={`flex min-w-0 flex-1 items-start gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <div className="relative h-14 w-11 shrink-0 overflow-hidden border-2 border-black sm:h-[72px] sm:w-[56px]" style={{ background: f.look.primary }}>
          <Portrait src={f.portrait.sm} alt={f.name} className="h-full w-full" color={f.look.primary} eager />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-baseline gap-2 ${right ? "flex-row-reverse" : ""}`}>
            <span className="mfw-title truncate text-lg sm:text-2xl" style={{ color: "#f8fafc" }}>
              {f.name}
            </span>
            <span ref={ref(`wins${i}`)} className="text-sm text-yellow-300" />
            <span className="text-[10px] font-black tracking-widest text-white/60">{setup.cpu[i] ? "CPU" : i === 0 ? "P1" : "P2"}</span>
          </div>
          <div className={css.hudBar} style={{ transform: right ? "scaleX(-1) skewX(-14deg)" : "skewX(-14deg)" }}>
            <div ref={ref(`trail${i}`)} className={css.hudTrail} style={{ left: 0, width: "100%" }} />
            <div ref={ref(`fill${i}`)} className={css.hudFill} style={{ left: 0, width: "100%" }} />
          </div>
          <div className={`mt-1 flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
            <div className={`${css.meter} w-2/3`} style={{ transform: right ? "scaleX(-1) skewX(-14deg)" : "skewX(-14deg)" }}>
              <div ref={ref(`meter${i}`)} className={css.meterFill} style={{ left: 0, width: "0%" }} />
            </div>
            <span ref={ref(`meterLabel${i}`)} className="whitespace-nowrap text-[10px] font-black tracking-wider text-cyan-200" />
          </div>
          <div className="mt-1 h-1 w-1/3 bg-white/10" style={{ marginLeft: right ? "auto" : 0 }}>
            <div ref={ref(`guard${i}`)} className="h-full bg-sky-300/70" style={{ width: "100%", marginLeft: right ? "auto" : 0 }} />
          </div>
        </div>
      </div>
    );
  };

  const anyHuman = !setup.cpu[0] || !setup.cpu[1];
  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 px-3 pt-3 sm:px-6">
        {side(0)}
        <div className="flex shrink-0 flex-col items-center">
          <span ref={ref("timer")} className={css.timer}>
            99
          </span>
          {setup.label && <span className="mt-1 whitespace-nowrap text-[10px] font-black tracking-widest text-yellow-300">{setup.label}</span>}
        </div>
        {side(1)}
      </div>

      {!overlay && (
        <button
          onClick={() => setPaused(true)}
          className="absolute bottom-3 right-3 z-10 border-2 border-white/30 bg-black/40 px-3 py-1 text-xs font-black uppercase tracking-widest text-white/80 hover:bg-black/70"
        >
          Pause (Esc)
        </button>
      )}

      {anyHuman && !overlay && <TouchControls input={input} mode={settings.touchControls} player={setup.cpu[0] ? 1 : 0} />}

      {paused && !overlay && (
        <PauseMenu
          setup={setup}
          settings={settings}
          onResume={() => setPaused(false)}
          onRestart={() => {
            matchRef.current?.rematch();
            setPaused(false);
          }}
          onQuit={onQuit}
        />
      )}
    </div>
  );
}

function PauseMenu({ setup, settings, onResume, onRestart, onQuit }: { setup: FightSetup; settings: Settings; onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  const [tab, setTab] = useState<"menu" | "moves">("menu");
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="mfw-panel mfw-scroll max-h-full w-full max-w-3xl overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="mfw-title text-4xl">Paused</h2>
          <div className="flex gap-2">
            <ArcadeButton tone={tab === "menu" ? "gold" : "ghost"} onClick={() => setTab("menu")}>
              Menu
            </ArcadeButton>
            <ArcadeButton tone={tab === "moves" ? "gold" : "ghost"} onClick={() => setTab("moves")}>
              Move list
            </ArcadeButton>
          </div>
        </div>
        {tab === "menu" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <ArcadeButton big onClick={onResume}>
              Resume
            </ArcadeButton>
            <ArcadeButton big tone="ghost" onClick={onRestart}>
              Restart match
            </ArcadeButton>
            <ArcadeButton big tone="danger" onClick={onQuit}>
              Quit fight
            </ArcadeButton>
          </div>
        ) : (
          <MoveList setup={setup} settings={settings} />
        )}
      </div>
    </div>
  );
}

export function MoveList({ setup, settings }: { setup: Pick<FightSetup, "p1" | "p2" | "cpu">; settings: Settings }) {
  const players = ([0, 1] as const).filter((i) => !setup.cpu[i]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(players.length ? players : [0 as const]).map((i) => {
        const f = i === 0 ? setup.p1 : setup.p2;
        const b = settings.bindings[i];
        const k = (a: (typeof ACTIONS)[number]) => keyLabel(b[a][0] ?? "?");
        return (
          <div key={i} className="space-y-3">
            <div className="text-sm font-black uppercase tracking-widest text-yellow-300">
              {i === 0 ? "Player 1" : "Player 2"} — {f.name}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {ACTIONS.map((a) => (
                <div key={a} className="flex justify-between gap-2 border-b border-white/5 py-0.5">
                  <span className="text-white/60">{ACTION_LABEL[a]}</span>
                  <kbd className="font-mono font-bold">{k(a)}</kbd>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-black uppercase tracking-wider text-white/50">Specials</div>
              {specialList(f).map(({ input, move }) => (
                <div key={move.id} className="flex justify-between gap-2">
                  <span className="font-bold">{move.name}</span>
                  <span className="text-white/60">{input.replace("Special", k("special")).replace("Ultimate", k("ult")).replace("↓", k("down")).replace("→", k("right"))}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs text-white/70">
              <div className="font-black uppercase tracking-wider text-white/50">Techniques</div>
              <p>
                {k("down")} + {k("hp")}: Uppercut (launcher) · {k("down")} + {k("kick")}: Sweep (hits low) · {k("lp")} + {k("kick")}: Throw (beats block)
              </p>
              <p>
                Jump attacks hit overhead. Hold {k("block")} or hold back to block; crouch-block stops sweeps. Double-tap forward to run, double-tap back or {k("block")} + direction to dodge.
              </p>
              <p>Chain light → kick → heavy → special for combos. Fill the super bar, then press {k("ult")}.</p>
              {f.combos.map((c) => (
                <p key={c.name}>
                  <span className="font-bold text-yellow-200">{c.name}:</span> {c.seq.map((s) => SLOT_LABEL[s] ?? s).join(" → ")}
                </p>
              ))}
              <p>
                <span className="font-bold text-yellow-200">Passive — {f.passive.name}:</span> {f.passive.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

