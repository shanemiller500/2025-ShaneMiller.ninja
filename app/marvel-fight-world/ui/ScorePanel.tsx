"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Trophy } from "lucide-react";

import type { ScoreBreakdown } from "../data/score";
import { cn } from "./kit";

/** Animated "+1,240 PTS" counter with the points breakdown and win streak. */
export function ScorePanel({ score, name }: { score: ScoreBreakdown; name: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + 700;
    const dur = 1100;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / dur));
      setShown(Math.round(score.total * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score.total]);

  const streakText = score.won === false ? "Streak broken" : score.streak >= 2 ? `${score.streak} win streak` : score.won ? "Streak started" : "Streak kept";

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.65, type: "spring", stiffness: 180, damping: 20 }}
      className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-amber-300/[0.12] via-white/[0.04] to-cyan-300/[0.08] p-5 ring-1 ring-amber-300/30"
    >
      <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">Leaderboard points{name ? ` · ${name}` : ""}</p>
          <p className="fw-display fw-outline mt-1 text-6xl font-[650] tabular-nums leading-none text-white">
            +{shown.toLocaleString()}
            <span className="ml-2 text-2xl text-amber-300">PTS</span>
          </p>
        </div>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {score.lines.map((l, i) => (
            <motion.li key={l.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.07 }} className="flex justify-between gap-3 border-b border-white/5 py-1">
              <span className="text-white/65">{l.label}</span>
              <span className="font-mono font-bold tabular-nums text-amber-200">+{l.points}</span>
            </motion.li>
          ))}
        </ul>
        <div className={cn("flex flex-col items-center rounded-xl px-5 py-3 text-center ring-1", score.won === false ? "bg-white/[0.04] ring-white/10" : "bg-orange-500/15 ring-orange-400/40")}>
          <Flame className={cn("h-8 w-8", score.won === false ? "text-white/30" : "text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.8)]")} />
          <span className="fw-display text-3xl font-[650] tabular-nums leading-none">{score.streak}</span>
          <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-white/60">{streakText}</span>
          {score.newBestStreak && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black uppercase text-slate-950">
              <Trophy className="h-3 w-3" /> New best
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
