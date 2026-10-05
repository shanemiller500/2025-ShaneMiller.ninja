"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Flame, Shield, Skull, Swords, Timer, Trash2, Trophy, Zap } from "lucide-react";

import type { Roster } from "../data/roster";
import { loadStats, resetStats, type Stats } from "../data/storage";
import { ArcadeButton, Backdrop, ScreenTitle } from "./kit";

function Tile({ icon: Icon, label, value, sub, color }: { icon: typeof Trophy; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl bg-white/[0.05] p-5 ring-1 ring-white/10 backdrop-blur">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
      <Icon className="h-5 w-5" style={{ color }} />
      <p className="fw-display mt-3 text-4xl font-[650] leading-none text-white">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/50">{label}</p>
      {sub && <p className="mt-0.5 truncate text-[13px] text-white/70">{sub}</p>}
    </motion.div>
  );
}

export function StatsScreen({ roster, onBack }: { roster: Roster; onBack: () => void }) {
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === "Escape" && onBack();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const rows = useMemo(
    () =>
      Object.entries(stats.fighters)
        .map(([id, r]) => ({ id: Number(id), ...r, def: roster.byId.get(Number(id)) }))
        .sort((a, b) => b.wins - a.wins || b.picks - a.picks),
    [stats, roster]
  );
  const winRate = stats.wins + stats.losses ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0;

  return (
    <div data-pad-menu className="absolute inset-0 isolate overflow-hidden text-white">
      <Backdrop tint="#f59e0b" />
      <div className="fw-thin-scroll h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <ScreenTitle
            kicker="Saved on this device"
            title="Leaderboard"
            right={
              confirm ? (
                <div className="flex gap-2">
                  <ArcadeButton
                    tone="danger"
                    size="sm"
                    onClick={() => {
                      resetStats();
                      setStats(loadStats());
                      setConfirm(false);
                    }}
                  >
                    Erase everything
                  </ArcadeButton>
                  <ArcadeButton tone="ghost" size="sm" onClick={() => setConfirm(false)}>
                    Cancel
                  </ArcadeButton>
                </div>
              ) : (
                <ArcadeButton tone="ghost" size="sm" onClick={() => setConfirm(true)} disabled={!stats.matches}>
                  <Trash2 className="h-4 w-4" /> Reset
                </ArcadeButton>
              )
            }
          />

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile icon={Swords} label="Matches" value={stats.matches} sub={`${stats.wins}W · ${stats.losses}L · ${stats.draws}D`} color="#38bdf8" />
            <Tile icon={Trophy} label="Win rate" value={`${winRate}%`} color="#fbbf24" />
            <Tile icon={Skull} label="Knockouts" value={stats.knockouts} sub={stats.perfects ? `${stats.perfects} perfect rounds` : undefined} color="#f43f5e" />
            <Tile icon={Flame} label="Biggest combo" value={stats.biggestCombo ? `${stats.biggestCombo} hits` : "—"} sub={stats.biggestComboBy || undefined} color="#fb923c" />
            <Tile icon={Timer} label="Fastest K.O." value={stats.fastestKo !== null ? `${stats.fastestKo}s` : "—"} sub={stats.fastestKoBy || undefined} color="#a78bfa" />
            <Tile icon={Shield} label="Survival best" value={stats.survivalBest} sub="opponents in a row" color="#34d399" />
            <Tile icon={Crown} label="Tournaments" value={stats.tournamentWins} sub="championships" color="#facc15" />
            <Tile icon={Zap} label="Fighters used" value={rows.length} sub={`of ${roster.fighters.length}`} color="#22d3ee" />
          </div>

          <h2 className="fw-display mt-10 text-2xl font-[650] uppercase">Fighter records</h2>
          {rows.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white/[0.04] p-8 text-center text-white/55 ring-1 ring-white/10">No fights yet — go win some!</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.06] font-mono text-[11px] uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Fighter</th>
                    <th className="px-4 py-3 text-right">Picks</th>
                    <th className="px-4 py-3 text-right">Wins</th>
                    <th className="px-4 py-3 text-right">Losses</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">K.O.s</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">Win %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] bg-black/20">
                  {rows.map((r, i) => (
                    <tr key={r.id} className="hover:bg-white/[0.04]">
                      <td className="px-4 py-2.5 font-mono text-white/45">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-3">
                          {r.def && <img src={r.def.portrait.xs} alt="" className="h-9 w-9 rounded-md object-cover object-top" />}
                          <span className="font-semibold">{r.name}</span>
                          {i === 0 && <Crown className="h-4 w-4 text-amber-300" />}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.picks}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-300">{r.wins}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-rose-300">{r.losses}</td>
                      <td className="hidden px-4 py-2.5 text-right font-mono sm:table-cell">{r.kos}</td>
                      <td className="hidden px-4 py-2.5 text-right font-mono sm:table-cell">{r.wins + r.losses ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
