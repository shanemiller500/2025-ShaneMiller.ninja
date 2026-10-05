"use client";

import type { FighterDef } from "../engine/types";
import { ArcadeButton, Portrait } from "./shared";

export interface TournamentState {
  /** Round 0 has 8 entrants, round 1 has 4, round 2 has 2, round 3 is the champion */
  rounds: FighterDef[][];
  playerId: number;
  eliminated: boolean;
}

export default function Bracket({ t, onPlay, onExit }: { t: TournamentState; onPlay: () => void; onExit: () => void }) {
  const current = t.rounds.length - 1;
  const champion = t.rounds[current].length === 1 ? t.rounds[current][0] : null;
  const playerIn = t.rounds[current].some((f) => f.id === t.playerId);
  const labels = ["Quarter-finals", "Semi-finals", "Final", "Champion"];
  const next = playerIn && !champion ? opponentOf(t) : null;

  return (
    <div className="mfw-scroll absolute inset-0 overflow-y-auto p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <ArcadeButton tone="ghost" onClick={onExit}>
            ← Menu
          </ArcadeButton>
          <h1 className="mfw-title text-3xl sm:text-5xl">Tournament</h1>
          <span className="text-xs font-black uppercase tracking-widest text-white/50">{champion ? "Complete" : labels[current]}</span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="flex flex-col justify-around gap-2">
              <div className="text-center text-[10px] font-black uppercase tracking-widest text-white/50">{labels[r]}</div>
              {(t.rounds[r] ?? Array.from({ length: 8 >> r }, () => null)).map((f, i) => {
                const lost = !!f && !!t.rounds[r + 1] && !t.rounds[r + 1].some((w) => w.id === f.id);
                const me = f?.id === t.playerId;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 border-2 p-1 ${me ? "border-red-500 bg-red-500/20" : "border-black bg-white/5"} ${lost ? "opacity-35" : ""} ${i % 2 === 0 && r < 3 ? "mt-1" : ""}`}
                  >
                    {f ? (
                      <>
                        <Portrait src={f.portrait.xs} alt={f.name} className="h-9 w-7 shrink-0" color={f.look.primary} />
                        <span className="truncate text-[11px] font-black uppercase sm:text-sm">{f.name}</span>
                      </>
                    ) : (
                      <span className="h-9 text-[11px] text-white/30">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mfw-panel flex flex-wrap items-center justify-between gap-3 p-4">
          {champion ? (
            <div className="mfw-title text-2xl sm:text-4xl">{champion.id === t.playerId ? "🏆 You are the champion!" : `${champion.name} wins the tournament`}</div>
          ) : t.eliminated ? (
            <div className="text-sm font-bold">You were knocked out — the rest of the bracket played out on its own.</div>
          ) : next ? (
            <>
              <div className="text-sm font-bold">
                Next up: <span className="text-yellow-300">{next.name}</span>
              </div>
              <ArcadeButton tone="gold" big onClick={onPlay}>
                Fight!
              </ArcadeButton>
            </>
          ) : null}
          {(champion || t.eliminated) && (
            <ArcadeButton tone="ghost" onClick={onExit}>
              Back to menu
            </ArcadeButton>
          )}
        </div>
      </div>
    </div>
  );
}

/** The player's opponent in the current round. */
export function opponentOf(t: TournamentState): FighterDef | null {
  const round = t.rounds[t.rounds.length - 1];
  const i = round.findIndex((f) => f.id === t.playerId);
  if (i < 0) return null;
  return round[i % 2 === 0 ? i + 1 : i - 1] ?? null;
}
