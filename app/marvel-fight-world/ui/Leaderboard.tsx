"use client";

import type { FighterDef } from "../engine/types";
import type { Stats } from "../data/storage";
import { ArcadeButton, Portrait } from "./shared";

export default function Leaderboard({ stats, fighters, onBack }: { stats: Stats; fighters: FighterDef[]; onBack: () => void }) {
  const rows = Object.entries(stats.byFighter)
    .map(([name, r]) => ({ name, ...r, rate: r.played ? r.wins / r.played : 0, def: fighters.find((f) => f.name === name) }))
    .sort((a, b) => b.played - a.played || b.wins - a.wins);
  const mostUsed = rows[0];
  const favorite = [...rows].filter((r) => r.played >= 2).sort((a, b) => b.rate - a.rate || b.wins - a.wins)[0] ?? rows[0];
  const decided = stats.wins + stats.losses;
  const tiles: [string, string][] = [
    ["Matches", String(stats.matches)],
    ["Wins", String(stats.wins)],
    ["Losses", String(stats.losses)],
    ["Win rate (vs CPU)", decided ? `${Math.round((stats.wins / decided) * 100)}%` : "—"],
    ["Knockouts", String(stats.kos)],
    ["Perfects", String(stats.perfects)],
    ["Biggest combo", stats.biggestCombo ? `${stats.biggestCombo} hits` : "—"],
    ["Fastest K.O.", stats.fastestKo !== null ? `${stats.fastestKo.toFixed(1)}s` : "—"],
    ["Survival best", stats.survivalBest ? `${stats.survivalBest} wins` : "—"],
    ["Tournaments won", String(stats.tournamentsWon)],
  ];
  return (
    <div className="mfw-scroll absolute inset-0 overflow-y-auto p-3 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center gap-3">
          <ArcadeButton tone="ghost" onClick={onBack}>
            ← Menu
          </ArcadeButton>
          <h1 className="mfw-title text-3xl sm:text-5xl">Hall of Fame</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map(([k, v]) => (
            <div key={k} className="mfw-panel p-3">
              <div className="mfw-title text-3xl">{v}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50">{k}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Most used fighter", mostUsed],
            ["Favorite fighter (best win rate)", favorite],
          ].map(([label, r]) => {
            const row = r as (typeof rows)[number] | undefined;
            return (
              <div key={label as string} className="mfw-panel flex items-center gap-3 p-3">
                {row?.def && <Portrait src={row.def.portrait.sm} alt={row.name} className="h-20 w-16 border-2 border-black" color={row.def.look.primary} />}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/50">{label as string}</div>
                  <div className="mfw-title text-2xl">{row?.name ?? "—"}</div>
                  {row && (
                    <div className="text-xs text-white/60">
                      {row.played} played · {row.wins} wins
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mfw-panel overflow-x-auto p-3">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-white/50">
              <tr>
                <th className="p-2">Fighter</th>
                <th className="p-2 text-right">Played</th>
                <th className="p-2 text-right">Wins</th>
                <th className="p-2 text-right">Losses</th>
                <th className="p-2 text-right">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-white/5">
                  <td className="flex items-center gap-2 p-2 font-bold">
                    {r.def && <Portrait src={r.def.portrait.xs} alt={r.name} className="h-8 w-6" color={r.def.look.primary} />}
                    {r.name}
                  </td>
                  <td className="p-2 text-right tabular-nums">{r.played}</td>
                  <td className="p-2 text-right tabular-nums">{r.wins}</td>
                  <td className="p-2 text-right tabular-nums">{r.played - r.wins}</td>
                  <td className="p-2 text-right tabular-nums">{Math.round(r.rate * 100)}%</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-white/40">
                    No fights yet. Go make some history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="pb-6 text-[11px] text-white/40">Stats are stored only in this browser.</p>
      </div>
    </div>
  );
}
