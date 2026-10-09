"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ArrowLeft, Crown, Eye, FastForward, Swords } from "lucide-react";
import type { FighterDef } from "../engine/types";
import { pendingCpuBouts, playerBout, rating, roundName, type Bout, type Bracket } from "../game/tournament";
import { ArcadeButton, Backdrop } from "./kit";

function BoutCard({ bout, playerId, onInspect }: { bout: Bout; playerId: number; onInspect: () => void }) {
  return <button type="button" onClick={onInspect} className={`w-full rounded-xl border p-2 text-left transition hover:border-amber-300/70 ${bout.player && !bout.winner ? "border-amber-300/60 bg-amber-300/10" : "border-white/10 bg-black/45"}`}>
    {[bout.a, bout.b].map((d, i) => <div key={d.id} className={`flex items-center gap-2 rounded p-1 ${bout.winner && bout.winner.id !== d.id ? "opacity-40" : ""}`}>
      <img src={d.portrait.sm} alt="" className="h-9 w-8 rounded object-cover object-top" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{d.name}{d.id === playerId ? " · YOU" : ""}</span>
      <span className="font-mono text-[10px] text-white/60">#{i ? bout.seedB : bout.seedA} · {rating(d)}</span>
      {bout.winner?.id === d.id && <Crown className="h-3.5 w-3.5 text-amber-300" />}
    </div>)}
    {bout.winner && <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">{bout.ko ? "KO · " : ""}{bout.result ?? "Winner decided"}</p>}
  </button>;
}

export function TournamentScreen({ bracket, availableSizes, onFight, onWatch, onSimulate, onSimulateAll, onContinue, onBack, onNew }: {
  bracket: Bracket;
  availableSizes: (8 | 16 | 32 | 64)[];
  onFight: (opp: FighterDef) => void;
  onWatch: (index: number, speed: 1 | 2 | 4) => void;
  onSimulate: (index: number) => void;
  onSimulateAll: () => void;
  onContinue: () => void;
  onBack: () => void;
  onNew: (size: 8 | 16 | 32 | 64, random: boolean) => void;
}) {
  const [selected, setSelected] = useState<{ round: number; index: number } | null>(null);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const chosen = selected && bracket.rounds[selected.round]?.[selected.index];
  const cpuPending = pendingCpuBouts(bracket);
  const player = playerBout(bracket);
  const opp = player && (player.a.id === bracket.playerId ? player.b : player.a);
  const current = bracket.rounds[bracket.current];
  const ready = !!current?.every((b) => b.winner);
  const final = current?.length === 1 && ready;
  const champion = final ? current[0].winner : null;
  const column = (round: number, side: 0 | 1) => {
    const bouts = bracket.rounds[round];
    const count = bracket.size >> (round + 1);
    const half = Math.max(1, count / 2);
    return <div key={`${round}-${side}`} className="min-w-48 flex-1 space-y-2">
      <p className="text-center font-mono text-[10px] font-bold uppercase tracking-wider text-white/55">{roundName(bracket.size, round)}</p>
      {Array.from({ length: half }, (_, i) => {
        const index = i + side * half;
        const b = bouts?.[index];
        return b ? <BoutCard key={index} bout={b} playerId={bracket.playerId} onInspect={() => setSelected({ round, index })} /> : <div key={index} className="h-24 rounded-xl border border-dashed border-white/10" />;
      })}
    </div>;
  };
  const totalRounds = Math.log2(bracket.size);
  return <div data-pad-menu className="absolute inset-0 overflow-y-auto text-white">
    <Backdrop tint="#eab308" />
    <div className="relative mx-auto max-w-[1800px] p-5 md:p-8">
      <button type="button" data-pad-back onClick={onBack} className="mb-3 flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Menu</button>
      <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-amber-300">{bracket.size} fighter tournament · {roundName(bracket.size, bracket.current)}</p>
      <h1 className="fw-display text-5xl uppercase">{champion ? `${champion.name} wins` : bracket.result === false ? "Eliminated" : "The Bracket"}</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {opp && <ArcadeButton autoFocus onClick={() => onFight(opp)}><Swords className="h-4 w-4" /> Fight {opp.name}</ArcadeButton>}
        {cpuPending.length > 0 && <ArcadeButton tone="ghost" onClick={onSimulateAll}><FastForward className="h-4 w-4" /> Simulate remaining CPU fights ({cpuPending.length})</ArcadeButton>}
        {ready && !final && <ArcadeButton onClick={onContinue}>Continue Tournament</ArcadeButton>}
        {final && <ArcadeButton onClick={() => onNew(bracket.size as 8 | 16 | 32 | 64, false)}>New Tournament</ArcadeButton>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55"><span>New bracket:</span>{availableSizes.map((size) => <button type="button" key={size} onClick={() => onNew(size, false)} className="rounded border border-white/15 px-2 py-1 hover:border-amber-300/60 hover:text-white">{size} seeded</button>)}<button type="button" onClick={() => onNew(bracket.size as 8 | 16 | 32 | 64, true)} className="rounded border border-white/15 px-2 py-1 hover:border-amber-300/60 hover:text-white">{bracket.size} random</button></div>
      <div className="mt-7 overflow-x-auto pb-5">
        <div className="flex min-w-[950px] items-center gap-3">
          <div className="flex flex-1 items-center gap-3">{Array.from({ length: totalRounds - 1 }, (_, r) => column(r, 0))}</div>
          <div className="w-52 shrink-0">{bracket.rounds[totalRounds - 1]?.[0] ? <BoutCard bout={bracket.rounds[totalRounds - 1][0]} playerId={bracket.playerId} onInspect={() => setSelected({ round: totalRounds - 1, index: 0 })} /> : <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-8 text-center font-mono text-xs text-amber-200">FINAL</div>}</div>
          <div className="flex flex-1 flex-row-reverse items-center gap-3">{Array.from({ length: totalRounds - 1 }, (_, r) => column(r, 1))}</div>
        </div>
      </div>
      {chosen && <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 p-4" onClick={() => setSelected(null)}>
        <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-[#10131c] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <p className="font-mono text-xs uppercase text-amber-300">{roundName(bracket.size, selected!.round)} · match {selected!.index + 1}</p>
          <div className="my-4 grid grid-cols-2 gap-3">{[chosen.a, chosen.b].map((d) => <div key={d.id}><img src={d.portrait.md} alt="" className="h-36 w-full rounded-lg object-cover object-top" /><strong className="mt-2 block">{d.name}</strong><span className="text-xs text-white/60">Rating {rating(d)} · {d.archetype}</span></div>)}</div>
          <p className="mb-3 text-sm text-white/65">{chosen.winner ? `${chosen.winner.name} wins ${chosen.ko ? "by KO" : ""} · ${chosen.result ?? ""}` : "Match pending"}</p>
          {!chosen.winner && !chosen.player && selected!.round === bracket.current && <div className="flex flex-wrap gap-2">
            <select aria-label="Watch speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value) as 1 | 2 | 4)} className="rounded bg-white/10 p-2 text-white"><option value={1}>Watch</option><option value={2}>2x</option><option value={4}>4x</option></select>
            <ArcadeButton onClick={() => onWatch(selected!.index, speed)}><Eye className="h-4 w-4" /> Watch</ArcadeButton>
            <ArcadeButton tone="ghost" onClick={() => { onSimulate(selected!.index); setSelected(null); }}>Instant Result</ArcadeButton>
          </div>}
          <button type="button" data-pad-back className="mt-4 text-sm text-white/60" onClick={() => setSelected(null)}>Close</button>
        </div>
      </div>}
    </div>
  </div>;
}
