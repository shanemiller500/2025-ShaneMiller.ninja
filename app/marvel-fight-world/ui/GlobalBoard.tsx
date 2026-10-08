"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Flame, Loader2, RefreshCw, Skull, Swords, Trophy, UserRound, WifiOff } from "lucide-react";

import type { LeaderRow, LeaderSort } from "../data/cloud";
import type { Roster } from "../data/roster";
import { cleanName, validName } from "../data/storage";
import { ArcadeButton, cn } from "./kit";

const loadCloud = () => import("../data/cloud");

const SORTS: { id: LeaderSort; label: string; icon: typeof Trophy }[] = [
  { id: "score", label: "Points", icon: Trophy },
  { id: "bestStreak", label: "Win streak", icon: Flame },
  { id: "wins", label: "Wins", icon: Swords },
  { id: "kos", label: "K.O.s", icon: Skull },
];

const MEDAL = ["#fbbf24", "#cbd5e1", "#d97706"];

function FighterBadge({ roster, f, size = "md" }: { roster: Roster; f: { id: number; name: string } | null; size?: "sm" | "md" | "lg" }) {
  if (!f) return <span className="text-white/35">—</span>;
  const def = roster.byId.get(f.id);
  const px = size === "lg" ? "h-24 w-20" : size === "md" ? "h-10 w-9" : "h-7 w-6";
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {def ? <img src={size === "lg" ? def.portrait.sm : def.portrait.xs} alt="" className={cn(px, "shrink-0 rounded-md object-cover object-top ring-1 ring-white/15")} /> : <span className={cn(px, "shrink-0 rounded-md bg-white/10")} />}
      {size !== "lg" && <span className="truncate">{f.name}</span>}
    </span>
  );
}

function statOf(r: LeaderRow, s: LeaderSort) {
  return s === "score" ? `${r.score.toLocaleString()} pts` : s === "bestStreak" ? `${r.bestStreak} 🔥` : s === "wins" ? `${r.wins} wins` : `${r.kos} K.O.s`;
}

export function GlobalBoard({
  roster,
  name,
  signedIn,
  cloudOn,
  publicUpdatedAt,
  syncError,
  onJoin,
  onName,
}: {
  roster: Roster;
  name: string;
  signedIn: boolean;
  cloudOn: boolean;
  publicUpdatedAt: Date | null;
  syncError: string | null;
  onJoin: () => void;
  onName: (n: string) => Promise<boolean>;
}) {
  const [sort, setSort] = useState<LeaderSort>("score");
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [mine, setMine] = useState<{ row: LeaderRow; rank: number } | null>(null);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(name);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    if (!cloudOn) return;
    setError(null);
    setRows(null);
    setMine(null);
    try {
      const m = await loadCloud();
      const [top, ownRank] = await Promise.all([m.loadLeaderboard(sort, 50), m.myLeaderboardRank(sort).then((row) => ({ row, error: false }), () => ({ row: null, error: true }))]);
      setRows(top);
      setMine(ownRank.row);
      setMyUid(m.currentUid());
      if (ownRank.error) setError("The leaderboard loaded, but your rank could not be checked. Try refreshing.");
    } catch {
      setError("The leaderboard could not be loaded. Check your connection or Firebase access, then try again.");
      setRows([]);
    }
  }, [sort, cloudOn, signedIn, publicUpdatedAt]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setDraft(name), [name]);

  if (!cloudOn) {
    return (
      <div className="mt-8 rounded-2xl bg-white/[0.04] p-8 text-center text-white/60 ring-1 ring-white/10">
        <WifiOff className="mx-auto mb-2 h-6 w-6" /> The global leaderboard isn&apos;t available on this build.
      </div>
    );
  }

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];

  return (
    <div className="mt-6">
      {/* Join / name card */}
      {!signedIn ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-300/15 to-cyan-300/10 p-5 ring-1 ring-amber-300/30">
          <Trophy className="h-8 w-8 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="fw-display text-2xl font-[650] uppercase">Join the leaderboard</p>
            <p className="text-sm text-white/65">Pick a fighter name and save with your email. Every CPU fight earns points; win streaks, K.O.s, combos and tough opponents earn more.</p>
          </div>
          <ArcadeButton tone="gold" onClick={onJoin}>
            <UserRound className="h-4 w-4" /> Join with name & email
          </ArcadeButton>
        </motion.div>
      ) : !name ? (
        <form
          className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-300/10 p-5 ring-1 ring-amber-300/30"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!validName(draft) || publishing) return;
            setPublishing(true);
            try {
              if (!(await onName(cleanName(draft)))) setError("Your cloud save is still being set up. Your name will publish automatically when it is ready.");
            } finally {
              setPublishing(false);
            }
          }}
        >
          <UserRound className="h-6 w-6 text-amber-300" />
          <p className="font-semibold">Pick your leaderboard name:</p>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={20} placeholder="Fighter name" className="min-w-[180px] flex-1 rounded-lg bg-black/30 px-3 py-2 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-amber-300" />
          <ArcadeButton tone="gold" size="sm" type="submit" disabled={!validName(draft) || publishing}>
            {publishing ? "Saving…" : "Save name"}
          </ArcadeButton>
        </form>
      ) : null}

      {/* Sort tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold uppercase tracking-wide transition", sort === s.id ? "bg-amber-300 text-slate-950" : "bg-white/[0.06] text-white/65 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")}
          >
            <s.icon className="h-4 w-4" /> {s.label}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white/55 hover:bg-white/10 hover:text-white">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-400/30">{error}</p>}
      {signedIn && syncError && <p className="mt-4 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-400/30">{syncError}</p>}
      {rows === null ? (
        <div className="grid place-items-center py-16 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 && !error ? (
        <p className="mt-6 rounded-2xl bg-white/[0.04] p-8 text-center text-white/55 ring-1 ring-white/10">No one on the board yet — win a fight and claim #1!</p>
      ) : (
        <>
          {/* Podium */}
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {podium.map((r, i) => (
              <motion.div
                key={r.uid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={cn("relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 ring-1", r.uid === myUid ? "ring-2 ring-cyan-300" : "ring-white/10", i === 0 ? "bg-amber-300/[0.12] md:order-2 md:-translate-y-3" : i === 1 ? "bg-white/[0.06] md:order-1" : "bg-orange-400/[0.08] md:order-3")}
              >
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-30 blur-2xl" style={{ background: MEDAL[i] }} />
                <FighterBadge roster={roster} f={r.mainFighter} size="lg" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-mono text-xs font-black" style={{ color: MEDAL[i] }}>
                    <Crown className="h-4 w-4" /> #{i + 1}
                  </p>
                  <p className="fw-display truncate text-2xl font-[650] uppercase leading-tight">{r.name}</p>
                  <p className="text-[13px] text-white/60">fights as {r.mainFighter?.name ?? "—"}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-white">{statOf(r, sort)}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Table */}
          {rest.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-white/[0.06] font-mono text-[11px] uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Fights as</th>
                    <th className="px-4 py-3">Best streak</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3 text-right">W / M</th>
                    <th className="px-4 py-3 text-right">K.O.s</th>
                    <th className="px-4 py-3 text-right">Combo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] bg-black/20">
                  {rest.map((r, i) => (
                    <tr key={r.uid} className={cn("hover:bg-white/[0.04]", r.uid === myUid && "bg-cyan-300/[0.08]")}>
                      <td className="px-4 py-2.5 font-mono text-white/45">{i + 4}</td>
                      <td className="px-4 py-2.5 font-semibold">
                        {r.name} {r.uid === myUid && <span className="ml-1 rounded-sm bg-cyan-300 px-1 text-[9px] font-black text-slate-950">YOU</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <FighterBadge roster={roster} f={r.mainFighter} />
                      </td>
                      <td className="px-4 py-2.5">
                        {r.bestStreak > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Flame className="h-4 w-4 text-orange-400" />
                            <b className="tabular-nums">{r.bestStreak}</b>
                            <span className="text-white/45">with {r.streakFighter?.name ?? "—"}</span>
                          </span>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-200">{r.score.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {r.wins}/{r.matches}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.kos}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.bestCombo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Your standing */}
          {mine && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-cyan-300/[0.08] p-4 ring-1 ring-cyan-300/40">
              <span className="fw-display text-4xl font-[650] text-cyan-200">#{mine.rank}</span>
              <FighterBadge roster={roster} f={mine.row.mainFighter} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">You · {mine.row.name}</p>
                <p className="text-[13px] text-white/60">
                  {mine.row.score.toLocaleString()} pts · best streak {mine.row.bestStreak}
                  {mine.row.streakFighter ? ` with ${mine.row.streakFighter.name}` : ""} · current streak {mine.row.streak} 🔥
                </p>
              </div>
            </motion.div>
          )}
        </>
      )}

      <div className="mt-6 rounded-xl bg-white/[0.03] p-4 text-[13px] text-white/55 ring-1 ring-white/10">
        <p className="mb-1 font-bold uppercase tracking-wider text-white/70">How points work</p>
        Win vs CPU: 100 × difficulty (Easy 0.6 · Normal 1 · Hard 1.5 · Insane 2.2) · K.O. +25 · Perfect round +75 · Combo hits ×8 · Ultimates +20 · Health left, speed K.O. and underdog bonuses · Win streak bonus grows with every straight win · Tournament title +500. Local versus fights don&apos;t score.
      </div>
    </div>
  );
}
