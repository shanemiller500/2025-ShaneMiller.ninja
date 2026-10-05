"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Swords } from "lucide-react";

import type { FighterDef } from "../engine/types";
import {
  ROUND_NAMES,
  playerBout,
  type Bout,
  type Bracket,
} from "../game/tournament";
import { ArcadeButton, Backdrop, P_COLORS, cn } from "./kit";

function Slot({
  def,
  win,
  lose,
  you,
}: {
  def: FighterDef;
  win: boolean;
  lose: boolean;
  you: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition",
        win ? "bg-amber-300/15 ring-1 ring-amber-300/50" : "bg-white/[0.04]",
        lose && "opacity-35 grayscale",
      )}
    >
      <img
        src={def.portrait.xs}
        alt=""
        className="h-9 w-9 shrink-0 rounded-md object-cover object-top"
      />
      <span
        className="min-w-0 flex-1 truncate text-sm font-semibold"
        style={you ? { color: P_COLORS[0] } : undefined}
      >
        {def.name}
      </span>
      {you && (
        <span className="rounded-sm bg-cyan-300 px-1 text-[9px] font-black text-slate-950">
          YOU
        </span>
      )}
      {win && <Crown className="h-4 w-4 shrink-0 text-amber-300" />}
    </div>
  );
}

function BoutCard({
  bout,
  playerId,
  live,
}: {
  bout: Bout;
  playerId: number;
  live: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-1 rounded-xl p-2 ring-1",
        live
          ? "bg-amber-300/[0.06] ring-amber-300/60 shadow-[0_0_40px_-12px_rgba(252,211,77,0.7)]"
          : "bg-black/30 ring-white/10",
      )}
    >
      {[bout.a, bout.b].map((d) => (
        <Slot
          key={d.id}
          def={d}
          you={d.id === playerId}
          win={bout.winner?.id === d.id}
          lose={!!bout.winner && bout.winner.id !== d.id}
        />
      ))}
    </div>
  );
}

export function TournamentScreen({
  bracket,
  onFight,
  onBack,
  onNew,
}: {
  bracket: Bracket;
  onFight: (opp: FighterDef) => void;
  onBack: () => void;
  onNew: () => void;
}) {
  const bout = playerBout(bracket);
  const opp =
    bout && bracket.result === null
      ? bout.a.id === bracket.playerId
        ? bout.b
        : bout.a
      : null;
  const champion = bracket.rounds[2]?.[0]?.winner ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onBack();
      if ((e.code === "Enter" || e.code === "KeyJ") && opp) onFight(opp);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opp, onFight, onBack]);

  return (
    <div className="absolute inset-0 isolate overflow-hidden text-white">
      <Backdrop tint="#eab308" />
      <div className="fw-thin-scroll h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-8">
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Menu
          </button>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-amber-300">
            Tournament
          </p>
          <h1 className="fw-display fw-outline text-5xl font-[650] uppercase">
            {bracket.result === true
              ? "Champion!"
              : bracket.result === false
                ? "Eliminated"
                : ROUND_NAMES[bracket.current]}
          </h1>

          <div className="mt-8 grid flex-1 items-center gap-6 md:grid-cols-3">
            {[0, 1, 2].map((r) => {
              const round = bracket.rounds[r];
              return (
                <div key={r} className="flex h-full flex-col gap-4">
                  <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-white/45">
                    {ROUND_NAMES[r]}
                  </p>
                  <div className="flex flex-1 flex-col justify-around gap-4">
                    {round
                      ? round.map((b, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: r * 0.15 + i * 0.05 }}
                          >
                            <BoutCard
                              bout={b}
                              playerId={bracket.playerId}
                              live={
                                b.player && !b.winner && bracket.result === null
                              }
                            />
                          </motion.div>
                        ))
                      : Array.from({ length: 4 >> r }).map((_, i) => (
                          <div
                            key={i}
                            className="h-[92px] rounded-xl border border-dashed border-white/10"
                          />
                        ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
            {champion && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-4 rounded-2xl bg-amber-300/10 px-6 py-4 ring-1 ring-amber-300/50"
              >
                <img
                  src={champion.portrait.sm}
                  alt=""
                  className="h-16 w-12 rounded-lg object-cover object-top"
                />
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">
                    Champion
                  </p>
                  <p className="fw-display text-3xl font-[650] uppercase">
                    {champion.name}
                  </p>
                </div>
                <Crown className="h-8 w-8 text-amber-300" />
              </motion.div>
            )}
            {opp ? (
              <ArcadeButton size="xl" onClick={() => onFight(opp)} autoFocus>
                <Swords className="h-7 w-7" /> Fight {opp.name}
              </ArcadeButton>
            ) : (
              <div className="flex gap-3">
                <ArcadeButton size="lg" onClick={onNew}>
                  New tournament
                </ArcadeButton>
                <ArcadeButton size="lg" tone="ghost" onClick={onBack}>
                  Main menu
                </ArcadeButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
