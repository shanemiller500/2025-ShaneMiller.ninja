"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

import { audio } from "../audio/audio";
import type { Roster } from "../data/roster";
import { loadImage } from "../data/roster";
import { applyPortraitPalette } from "../render/palette";
import { DEFAULT_SETTINGS, type Settings } from "../data/storage";
import { GameSession } from "../game/session";
import { ARENAS } from "../render/arenas";
import { cn } from "./kit";

export type MenuChoice = "cpu" | "versus" | "random" | "survival" | "tournament" | "world" | "roster" | "stats" | "settings" | "cloud";

const MENU: { id: MenuChoice; label: string; desc: string }[] = [
  { id: "cpu", label: "Quick Fight", desc: "Pick a fighter, pick an opponent, fight the CPU." },
  { id: "versus", label: "Local Versus", desc: "Two players, one keyboard (or two controllers)." },
  { id: "random", label: "Random Fight", desc: "Random fighters, random arena — go!" },
  { id: "survival", label: "Survival", desc: "Beat opponents back-to-back. How far can you get?" },
  { id: "tournament", label: "Tournament", desc: "Eight fighters, one bracket, one champion." },
  { id: "world", label: "Fight World", desc: "Explore the city and challenge anyone you meet." },
  { id: "roster", label: "Character Files", desc: "Browse all 272 fighters, bios and galleries." },
  { id: "stats", label: "Leaderboard", desc: "Your wins, combos and records." },
  { id: "settings", label: "Settings", desc: "Controls, difficulty, sound and blood level." },
  { id: "cloud", label: "Save Progress", desc: "Save to your email and load it on any device." },
];

/** Attract mode: CPU vs CPU demo fight behind the menu. */
function AttractFight({ roster }: { roster: Roster }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let session: GameSession | null = null;
    let alive = true;
    const pool = roster.featured.length >= 2 ? roster.featured : roster.fighters;
    const a = pool[Math.floor(Math.random() * pool.length)];
    let b = pool[Math.floor(Math.random() * pool.length)];
    if (b.id === a.id) b = pool[(pool.indexOf(a) + 1) % pool.length];
    const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)];
    Promise.all([loadImage(a.portrait.md), loadImage(b.portrait.md)]).then(([ia, ib]) => {
      applyPortraitPalette(a, ia);
      applyPortraitPalette(b, ib);
      if (!alive || !ref.current) return;
      session = new GameSession(
        ref.current,
        {
          p1: a,
          p2: b,
          arena,
          controllers: ["cpu", "cpu"],
          difficulty: Math.random() > 0.5 ? "hard" : "insane",
          settings: { ...DEFAULT_SETTINGS, roundsToWin: 1, blood: "light" },
          silent: true,
          hideHud: true,
          onMatchOver: () => window.setTimeout(() => alive && setRound((r) => r + 1), 2500),
        },
        [ia, ib]
      );
      session.resize();
      session.start();
    });
    const onResize = () => session?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      session?.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [roster, round]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export function TitleScreen({ roster, onChoose, corner, paused = false, onLeave }: { roster: Roster; settings: Settings; onChoose: (c: MenuChoice) => void; corner?: ReactNode; paused?: boolean; onLeave?: () => void }) {
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a dialog is open (typing an email etc.): the menu stays out of the way
      if (paused || (e.target as HTMLElement | null)?.closest?.("input, textarea, [role=dialog]")) return;
      if (["ArrowDown", "KeyS"].includes(e.code)) {
        e.preventDefault();
        setSel((s) => (s + 1) % MENU.length);
        audio.unlock();
        audio.ui("move");
      } else if (["ArrowUp", "KeyW"].includes(e.code)) {
        e.preventDefault();
        setSel((s) => (s - 1 + MENU.length) % MENU.length);
        audio.unlock();
        audio.ui("move");
      } else if (e.code === "Enter" || e.code === "KeyJ" || e.code === "Space") {
        e.preventDefault();
        audio.unlock();
        audio.ui("confirm");
        onChoose(MENU[sel].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, onChoose, paused]);

  return (
    <div className="absolute inset-0 isolate overflow-hidden bg-black text-white">
      <AttractFight roster={roster} />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      <Link
        href="/projects"
        onClick={(e) => {
          // give unsaved progress a chance to be saved first
          if (onLeave) {
            e.preventDefault();
            onLeave();
          }
        }}
        className="group absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-xl bg-black/45 px-3.5 py-2 text-sm font-semibold text-white/75 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" /> Back to projects
      </Link>
      {corner}

      <div className="relative flex h-full flex-col justify-center px-[6vw] py-10">
        <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.45em] text-amber-300">Fan-made arcade brawler · {roster.fighters.length} fighters</p>
          <h1 className="fw-display mt-2 select-none text-[clamp(4rem,11vw,10rem)] font-[650] uppercase leading-[0.85]" style={{ WebkitTextStroke: "6px #05060a", paintOrder: "stroke fill" }}>
            <span className="bg-gradient-to-b from-white via-amber-200 to-orange-500 bg-clip-text text-transparent [filter:drop-shadow(0_0_30px_rgba(251,146,60,0.55))]">Fight</span>
            <br />
            <span className="bg-gradient-to-b from-cyan-200 via-sky-400 to-indigo-600 bg-clip-text text-transparent [filter:drop-shadow(0_0_30px_rgba(56,189,248,0.55))]">World</span>
          </h1>
        </motion.div>

        <nav className="mt-10 flex max-w-md flex-col gap-1.5" aria-label="Main menu">
          {MENU.map((m, i) => (
            <motion.button
              key={m.id}
              type="button"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.04 }}
              onMouseEnter={() => {
                setSel(i);
                audio.ui("move");
              }}
              onClick={() => {
                audio.unlock();
                audio.ui("confirm");
                onChoose(m.id);
              }}
              className={cn(
                "group relative -skew-x-12 overflow-hidden rounded-md px-5 py-2 text-left transition",
                i === sel ? "bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 shadow-[0_0_40px_-8px_rgba(251,191,36,0.9)]" : "text-white/80 hover:text-white"
              )}
            >
              <span className="flex skew-x-12 items-baseline gap-3">
                <span className="fw-display whitespace-nowrap text-2xl font-[650] uppercase">{m.label}</span>
                {i === sel && <span className="hidden text-[13px] font-semibold sm:inline">{m.desc}</span>}
              </span>
            </motion.button>
          ))}
        </nav>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-widest text-white/40">↑ ↓ to choose · Enter to select</p>
      </div>

      <p className="absolute inset-x-0 bottom-3 px-6 text-center text-[11px] text-white/40">
        Unofficial fan project — not affiliated with or endorsed by Marvel. Character data from the open-source akabab/superhero-api and the Marvel Database fan wiki.
      </p>
    </div>
  );
}
