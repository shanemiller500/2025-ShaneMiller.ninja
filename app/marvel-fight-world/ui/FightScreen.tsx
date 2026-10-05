"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { audio } from "../audio/audio";
import type { Difficulty } from "../engine/ai";
import type { Action, FighterDef } from "../engine/types";
import { loadImage } from "../data/roster";
import { applyPortraitPalette } from "../render/palette";
import type { Settings } from "../data/storage";
import { GameSession, type Controller, type MatchSummary } from "../game/session";
import type { ArenaDef } from "../render/arenas";
import { ArcadeButton, P_COLORS, cn } from "./kit";
import { ControlsCard } from "./ControlsCard";
import { suspendPadBridge } from "../input/gamepad";

export type FightExit = "rematch" | "changeFighter" | "newArena" | "quit" | "continue";

interface Props {
  p1: FighterDef;
  p2: FighterDef;
  arena: ArenaDef;
  controllers: [Controller, Controller];
  difficulty: Difficulty;
  settings: Settings;
  startHealth?: [number, number];
  /** Small caption over the fight (e.g. "SURVIVAL · OPPONENT 4") */
  banner?: string;
  /** Called once per finished match (stats, survival/tournament progress) */
  onMatchOver?: (s: MatchSummary) => void;
  /** Replace the default result buttons (survival/tournament/world) */
  resultActions?: (s: MatchSummary) => { label: string; action: FightExit; tone?: "primary" | "ghost" | "danger" }[];
  onExit: (action: FightExit, summary: MatchSummary | null) => void;
}

export function FightScreen(props: Props) {
  const { p1, p2, arena, controllers, difficulty, settings, startHealth, banner } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [phase, setPhase] = useState<"vs" | "fight">("vs");
  const [paused, setPaused] = useState(false);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [touch, setTouch] = useState(false);
  const cbRef = useRef(props);
  cbRef.current = props;

  useEffect(() => {
    setTouch(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches);
  }, []);

  // While this screen is up the GameSession reads the controller directly;
  // the UI bridge only drives the pause / results overlays.
  useEffect(() => suspendPadBridge(), []);

  // VS splash, then boot the session once portraits are ready
  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    audio.unlock();
    audio.play("super", 0.6);
    Promise.all([loadImage(p1.portrait.md), loadImage(p2.portrait.md)]).then(([a, b]) => {
      // Generic fighters wear their real colours, sampled from their art
      applyPortraitPalette(p1, a);
      applyPortraitPalette(p2, b);
      const wait = Math.max(0, 1900 - (performance.now() - t0));
      window.setTimeout(() => {
        if (!alive || !canvasRef.current) return;
        setPhase("fight");
        const session = new GameSession(
          canvasRef.current,
          {
            p1,
            p2,
            arena,
            controllers,
            difficulty,
            settings,
            startHealth,
            onMatchOver: (s) => {
              setSummary(s);
              cbRef.current.onMatchOver?.(s);
            },
            onPauseRequest: () => setPaused((p) => !p),
          },
          [a, b]
        );
        sessionRef.current = session;
        requestAnimationFrame(() => {
          session.resize();
          session.start();
        });
      }, wait);
    });
    return () => {
      alive = false;
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the canvas sized to the screen
  useEffect(() => {
    const onResize = () => sessionRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    sessionRef.current?.setPaused(paused || !!summary);
  }, [paused, summary]);

  const exit = useCallback((action: FightExit) => {
    audio.ui("confirm");
    if (action === "rematch") {
      setSummary(null);
      setPaused(false);
      sessionRef.current?.rematch();
      return;
    }
    cbRef.current.onExit(action, summary);
  }, [summary]);

  const press = (action: Action, down: boolean) => sessionRef.current?.input.setTouch(controllers[0] === "human" ? 0 : 1, action, down);

  const human = controllers.indexOf("human") as 0 | 1 | -1;
  const youWon = summary && human !== -1 && controllers[1] === "cpu" ? summary.winner === human : null;
  const actions = summary
    ? cbRef.current.resultActions?.(summary) ?? [
        { label: "Rematch", action: "rematch" as FightExit, tone: "primary" as const },
        { label: "Change fighter", action: "changeFighter" as FightExit },
        { label: "New arena", action: "newArena" as FightExit },
        { label: "Main menu", action: "quit" as FightExit },
      ]
    : [];

  return (
    <div className="absolute inset-0 bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {banner && phase === "fight" && !summary && (
        <div className="pointer-events-none absolute left-1/2 top-[17vh] -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 font-mono text-xs font-bold uppercase tracking-[0.25em] text-amber-300 ring-1 ring-amber-300/40 backdrop-blur">
          {banner}
        </div>
      )}

      {phase === "fight" && !summary && !paused && (
        <button
          type="button"
          onClick={() => setPaused(true)}
          className="absolute bottom-[3.5vh] left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white/70 ring-1 ring-white/15 backdrop-blur transition hover:text-white"
        >
          Esc · Pause
        </button>
      )}

      {/* VS splash */}
      <AnimatePresence>{phase === "vs" && <VersusSplash p1={p1} p2={p2} arena={arena} controllers={controllers} />}</AnimatePresence>

      {/* Touch controls */}
      {touch && phase === "fight" && !summary && !paused && <TouchPad onPress={press} />}

      {/* Pause */}
      <AnimatePresence>
        {paused && !summary && (
          <motion.div data-pad-menu initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md">
            <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[320px_1fr]">
              <div className="flex flex-col gap-3">
                <h2 className="fw-display fw-outline mb-2 text-6xl font-[650] uppercase text-white">Paused</h2>
                <ArcadeButton size="lg" data-pad-back autoFocus onClick={() => setPaused(false)}>Resume</ArcadeButton>
                <ArcadeButton size="md" tone="ghost" onClick={() => exit("rematch")}>Restart match</ArcadeButton>
                <ArcadeButton size="md" tone="ghost" onClick={() => exit("changeFighter")}>Change fighter</ArcadeButton>
                <ArcadeButton size="md" tone="ghost" onClick={() => exit("quit")}>Quit to menu</ArcadeButton>
              </div>
              <ControlsCard settings={settings} versus={controllers[0] === "human" && controllers[1] === "human"} p1={p1} p2={p2} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {summary && (
          <motion.div data-pad-menu initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="absolute inset-0 z-20 overflow-y-auto bg-gradient-to-b from-black/40 via-black/75 to-black/95 backdrop-blur-[2px]">
            <Results summary={summary} p1={p1} p2={p2} youWon={youWon} actions={actions} onAction={exit} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── VS splash ─────────────────────────────────────────────────────── */
function VersusSplash({ p1, p2, arena, controllers }: { p1: FighterDef; p2: FighterDef; arena: ArenaDef; controllers: [Controller, Controller] }) {
  const side = (d: FighterDef, i: 0 | 1) => (
    <motion.div
      initial={{ x: i === 0 ? "-100%" : "100%" }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.05 + i * 0.12 }}
      className="relative h-full flex-1 overflow-hidden"
      style={{ clipPath: i === 0 ? "polygon(0 0, 100% 0, 88% 100%, 0 100%)" : "polygon(12% 0, 100% 0, 100% 100%, 0 100%)" }}
    >
      <img src={d.portrait.lg} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover object-top" />
      <div className="absolute inset-0" style={{ background: `linear-gradient(${i === 0 ? "90deg" : "270deg"}, ${P_COLORS[i]}66, transparent 60%), linear-gradient(to top, #000 0%, transparent 55%)` }} />
      <div className={cn("absolute bottom-[12%] px-[6%]", i === 0 ? "left-0 text-left" : "right-0 text-right")}>
        <p className="font-mono text-sm font-bold uppercase tracking-[0.3em]" style={{ color: P_COLORS[i] }}>
          {controllers[i] === "cpu" ? "CPU" : `Player ${i + 1}`}
        </p>
        <p className="fw-display fw-outline text-6xl font-[650] uppercase text-white xl:text-8xl">{d.name}</p>
        <p className="mt-1 text-lg text-white/70">{d.realName}</p>
      </div>
    </motion.div>
  );
  return (
    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.35 }} className="absolute inset-0 z-30 flex bg-black">
      {side(p1, 0)}
      {side(p2, 1)}
      <motion.div
        initial={{ scale: 3, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: -6 }}
        transition={{ delay: 0.45, type: "spring", stiffness: 260, damping: 14 }}
        className="fw-display pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12rem] font-[650] leading-none text-amber-300"
        style={{ WebkitTextStroke: "8px #05060a", paintOrder: "stroke fill", textShadow: "0 0 60px rgba(251,191,36,0.8)" }}
      >
        VS
      </motion.div>
      <motion.p initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-sm font-bold uppercase tracking-[0.4em] text-white/70">
        {arena.name}
      </motion.p>
    </motion.div>
  );
}

/* ── Results ───────────────────────────────────────────────────────── */
function Results({
  summary,
  p1,
  p2,
  youWon,
  actions,
  onAction,
}: {
  summary: MatchSummary;
  p1: FighterDef;
  p2: FighterDef;
  youWon: boolean | null;
  actions: { label: string; action: FightExit; tone?: "primary" | "ghost" | "danger" }[];
  onAction: (a: FightExit) => void;
}) {
  const w = summary.winner;
  const winner = w === null ? null : w === 0 ? p1 : p2;
  const title = w === null ? "DRAW" : youWon === false ? "DEFEATED" : `${winner!.name} WINS`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "KeyJ") onAction(actions[0]?.action ?? "rematch");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, onAction]);

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex items-center gap-8">
        {winner && (
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.5 }} className="relative h-56 w-44 shrink-0 -skew-x-6 overflow-hidden rounded-xl ring-4" style={{ ["--tw-ring-color" as string]: P_COLORS[w!] }}>
            <img src={winner.portrait.md} alt="" className="h-full w-full skew-x-6 scale-110 object-cover object-top" />
          </motion.div>
        )}
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="font-mono text-sm font-bold uppercase tracking-[0.35em] text-amber-300">
            {w === null ? "Time over" : youWon === false ? "Try again!" : "Victory"}
          </motion.p>
          <motion.h2 initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, type: "spring" }} className="fw-display fw-outline text-6xl font-[650] uppercase text-white md:text-7xl">
            {title}
          </motion.h2>
          <p className="mt-2 text-white/60">
            {summary.fighters[0].roundWins} – {summary.fighters[1].roundWins} in rounds · {Math.round(summary.seconds)}s
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
        {([0, 1] as const).map((i) => {
          const f = summary.fighters[i];
          const rows: [string, string | number][] = [
            ["Biggest combo", `${f.maxCombo} hits`],
            ["Damage dealt", f.damage],
            ["Hits landed", f.hits],
            ["Specials", f.specials],
            ["Ultimates", f.ults],
            ["K.O.s", f.kos],
          ];
          return (
            <motion.div key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.75 + i * 0.1 }} className="rounded-2xl bg-white/[0.05] p-5 ring-1 ring-white/10">
              <p className="fw-display text-2xl font-[650] uppercase" style={{ color: P_COLORS[i] }}>
                {f.name}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-white/5 py-1 text-sm">
                    <dt className="text-white/55">{k}</dt>
                    <dd className="font-mono font-bold tabular-nums text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          );
        })}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }} className="flex flex-wrap justify-center gap-3">
        {actions.map((a, i) => (
          <ArcadeButton key={a.label} size={i === 0 ? "lg" : "md"} tone={i === 0 ? a.tone ?? "primary" : a.tone ?? "ghost"} onClick={() => onAction(a.action)} autoFocus={i === 0}>
            {a.label}
          </ArcadeButton>
        ))}
      </motion.div>
      <p className="font-mono text-xs text-white/40">Enter · {actions[0]?.label}</p>
    </div>
  );
}

/* ── Touch controls (pointer: coarse) ──────────────────────────────── */
function TouchPad({ onPress }: { onPress: (a: Action, down: boolean) => void }) {
  const btn = (a: Action, label: string, cls: string) => (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress(a, true);
      }}
      onPointerUp={() => onPress(a, false)}
      onPointerLeave={() => onPress(a, false)}
      onPointerCancel={() => onPress(a, false)}
      className={cn("pointer-events-auto flex select-none items-center justify-center rounded-full font-black text-white ring-2 ring-white/30 backdrop-blur active:scale-95", cls)}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-5">
      <div className="grid grid-cols-3 gap-2">
        <span />
        {btn("up", "▲", "h-16 w-16 bg-white/15")}
        <span />
        {btn("left", "◀", "h-16 w-16 bg-white/15")}
        {btn("down", "▼", "h-16 w-16 bg-white/15")}
        {btn("right", "▶", "h-16 w-16 bg-white/15")}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {btn("lp", "LP", "h-16 w-16 bg-cyan-500/40")}
        {btn("hp", "HP", "h-16 w-16 bg-orange-500/40")}
        {btn("kick", "K", "h-16 w-16 bg-emerald-500/40")}
        {btn("block", "BLK", "h-16 w-16 bg-slate-500/50")}
        {btn("special", "SP", "h-16 w-16 bg-violet-500/50")}
        {btn("ult", "ULT", "h-16 w-16 bg-amber-500/60")}
      </div>
    </div>
  );
}
