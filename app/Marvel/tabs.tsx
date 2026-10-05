"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Crown, Search, Shuffle, X } from "lucide-react";

import { Segmented } from "@/components/ui/segmented";
import { HeroCard, HeroPicker, Portrait, Radar, RadarHowTo } from "./components";
import { ALIGNMENT, STATS, STAT_LABEL, alignmentOf, type Alignment, type Hero, type StatKey } from "./lib/roster";

const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

const PAGE = 40;

/* ------------------------------------------------------------------ */
/*  Shared bits                                                        */
/* ------------------------------------------------------------------ */
export function TabLoading() {
  return (
    <div className="p-3 sm:p-5">
      <div className="mb-4 h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
      {message}
      <button type="button" onClick={onRetry} className="ml-3 font-medium underline underline-offset-2">
        Try again
      </button>
    </div>
  );
}

function Readout({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn("bg-white p-4 text-left dark:bg-[#1f1f23]", onClick && "transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]")}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2">{children}</div>
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/*  Roster                                                             */
/* ------------------------------------------------------------------ */
type AlignFilter = "all" | Alignment;
type SortKey = "total" | "name" | StatKey;

export function RosterTab({ roster, onSelect }: { roster: Hero[]; onSelect: (h: Hero) => void }) {
  const [q, setQ] = useState("");
  const [align, setAlign] = useState<AlignFilter>("all");
  const [sort, setSort] = useState<SortKey>("total");
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(() => {
    const c = { good: 0, bad: 0, neutral: 0 };
    roster.forEach((h) => c[alignmentOf(h)]++);
    return c;
  }, [roster]);

  const avg = roster.length ? Math.round(roster.reduce((s, h) => s + h.total, 0) / roster.length) : 0;
  const strongest = roster[0];
  const smartest = useMemo(() => [...roster].sort((a, b) => b.powerstats.intelligence - a.powerstats.intelligence)[0], [roster]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = roster.filter(
      (h) =>
        (align === "all" || alignmentOf(h) === align) &&
        (!s || `${h.name} ${h.biography.fullName} ${h.connections.groupAffiliation}`.toLowerCase().includes(s))
    );
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort !== "total") list = [...list].sort((a, b) => b.powerstats[sort] - a.powerstats[sort]);
    return list;
  }, [roster, q, align, sort]);

  useEffect(() => setLimit(PAGE), [q, align, sort]);

  const heroShare = roster.length ? (counts.good / roster.length) * 100 : 0;
  const villainShare = roster.length ? (counts.bad / roster.length) * 100 : 0;

  return (
    <div className="p-3 sm:p-5">
      {/* Readout */}
      <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-200/70 dark:border-white/[0.08] dark:bg-white/[0.06] sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Readout label={`Roster · ${roster.length} characters`}>
          <div className="flex h-2 overflow-hidden rounded-full bg-amber-400/80">
            <motion.span className="h-full bg-sky-400" initial={{ width: 0 }} animate={{ width: `${heroShare}%` }} transition={{ duration: 0.8 }} />
            <motion.span className="h-full bg-rose-500" initial={{ width: 0 }} animate={{ width: `${villainShare}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
          </div>
          <div className="mt-2 flex gap-3 font-mono text-[11px] tabular-nums">
            <span className="text-sky-600 dark:text-sky-400">{counts.good} heroes</span>
            <span className="text-rose-500 dark:text-rose-400">{counts.bad} villains</span>
            <span className="text-amber-600 dark:text-amber-400">{counts.neutral} neutral</span>
          </div>
        </Readout>
        <Readout label="Avg power">
          <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">{avg}</span>
          <span className="font-mono text-[11px] text-slate-400"> / 600</span>
        </Readout>
        <Readout label="Most powerful" onClick={strongest ? () => onSelect(strongest) : undefined}>
          <span className="block truncate font-mono text-base font-semibold text-indigo-600 dark:text-indigo-300">{strongest?.name ?? "—"}</span>
        </Readout>
        <Readout label="Biggest brain" onClick={smartest ? () => onSelect(smartest) : undefined}>
          <span className="block truncate font-mono text-base font-semibold text-violet-600 dark:text-violet-300">{smartest?.name ?? "—"}</span>
        </Readout>
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-60">
          <span className="sr-only">Search characters</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, alias or team"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <Segmented
          id="marvelAlign"
          ariaLabel="Alignment"
          value={align}
          onChange={setAlign}
          options={[
            { key: "all", label: "All" },
            { key: "good", label: "Heroes" },
            { key: "bad", label: "Villains" },
            { key: "neutral", label: "Neutral" },
          ]}
        />
        <Segmented
          id="marvelSort"
          ariaLabel="Sort"
          className="sm:ml-auto"
          value={sort}
          onChange={setSort}
          options={[
            { key: "total", label: "Power" },
            { key: "intelligence", label: "INT" },
            { key: "strength", label: "STR" },
            { key: "speed", label: "SPD" },
            { key: "name", label: "A–Z" },
          ]}
        />
      </div>

      <p className="mb-3 mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {shown.length} of {roster.length} · hover a card for stats, click for the full file
      </p>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No characters match &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.slice(0, limit).map((h, i) => (
            <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i % PAGE, 20) * 0.02 }}>
              <HeroCard hero={h} rank={sort === "total" && align === "all" && !q ? i + 1 : undefined} onSelect={onSelect} />
            </motion.div>
          ))}
        </div>
      )}

      {limit < shown.length && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/20"
          >
            Show {Math.min(PAGE, shown.length - limit)} more
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Compare                                                            */
/* ------------------------------------------------------------------ */
const A_HEX = "#6366f1";
const B_HEX = "#f43f5e";

export function CompareTab({
  roster,
  pair,
  setPair,
  onSelect,
}: {
  roster: Hero[];
  pair: [Hero | null, Hero | null];
  setPair: (p: [Hero | null, Hero | null]) => void;
  onSelect: (h: Hero) => void;
}) {
  const [a, b] = pair;
  const [hl, setHl] = useState<StatKey | null>(null);

  const random = () => {
    const pool = roster.slice(0, 120);
    const x = pool[Math.floor(Math.random() * pool.length)];
    let y = pool[Math.floor(Math.random() * pool.length)];
    while (y.id === x.id) y = pool[Math.floor(Math.random() * pool.length)];
    setPair([x, y]);
  };

  const result = useMemo(() => {
    if (!a || !b) return null;
    let aw = 0, bw = 0;
    STATS.forEach((k) => {
      if (a.powerstats[k] > b.powerstats[k]) aw++;
      else if (b.powerstats[k] > a.powerstats[k]) bw++;
    });
    const winner = a.total === b.total ? null : a.total > b.total ? a : b;
    return { aw, bw, winner, margin: Math.abs(a.total - b.total) };
  }, [a, b]);

  return (
    <div className="p-3 sm:p-5">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <HeroPicker roster={roster} value={a} onChange={(h) => setPair([h, b])} accent={A_HEX} label="Corner one" />
        <div className="flex justify-center gap-1 pb-2">
          <button type="button" onClick={() => setPair([b, a])} title="Swap" aria-label="Swap" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-white">
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={random} title="Random matchup" aria-label="Random matchup" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-white">
            <Shuffle className="h-4 w-4" />
          </button>
        </div>
        <HeroPicker roster={roster} value={b} onChange={(h) => setPair([a, h])} accent={B_HEX} label="Corner two" />
      </div>

      {a && b && result ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* radar + verdict */}
          <div className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/[0.08]">
            <div className="mx-auto max-w-[300px]">
              <Radar heroes={[a, b]} highlight={hl} onHighlight={setHl} />
            </div>
            <div className="mt-2 flex justify-center gap-4 font-mono text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: A_HEX }} />{a.name}</span>
              <span className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: B_HEX }} />{b.name}</span>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
              <RadarHowTo compare />
            </div>
          </div>

          <div className="space-y-4">
            {/* verdict */}
            <motion.div
              key={`${a.id}-${b.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative isolate flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200/70 p-4 dark:border-white/[0.08]"
            >
              <div aria-hidden className="absolute -left-10 -top-10 -z-10 h-32 w-48 rounded-full opacity-20 blur-3xl" style={{ background: result.winner === a ? A_HEX : result.winner === b ? B_HEX : "#94a3b8" }} />
              {result.winner ? (
                <button type="button" onClick={() => onSelect(result.winner!)} className="shrink-0">
                  <Portrait hero={result.winner} size="sm" className="h-16 w-16 rounded-2xl" />
                </button>
              ) : null}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <Crown className="h-3 w-3 text-amber-500" /> Verdict on paper
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  {result.winner ? `${result.winner.name} edges it by ${result.margin}` : "Dead even on total power"}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Stats won · {a.name} {result.aw} — {result.bw} {b.name}
                </p>
              </div>
            </motion.div>

            {/* head to head */}
            <div className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/[0.08]">
              {[...STATS, "total" as const].map((k) => {
                const av = k === "total" ? a.total : a.powerstats[k];
                const bv = k === "total" ? b.total : b.powerstats[k];
                const max = k === "total" ? 600 : 100;
                return (
                  <div
                    key={k}
                    onMouseEnter={() => setHl(k === "total" ? null : k)}
                    onMouseLeave={() => setHl(null)}
                    className={cn(
                      "grid grid-cols-[1fr_88px_1fr] items-center gap-3 rounded-lg px-1 py-1.5 transition-colors",
                      k !== "total" && hl === k && "bg-indigo-50 dark:bg-indigo-400/10",
                      k === "total" && "mt-2 border-t border-slate-100 pt-3 dark:border-white/[0.06]"
                    )}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <span className={cn("font-mono text-[12px] tabular-nums", av >= bv ? "font-semibold text-slate-900 dark:text-white" : "text-slate-400")}>{av}</span>
                      <span className="relative h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                        <motion.span className="absolute inset-y-0 right-0 rounded-full" style={{ background: A_HEX, opacity: av >= bv ? 1 : 0.45 }} initial={{ width: 0 }} animate={{ width: `${(av / max) * 100}%` }} transition={{ duration: 0.6 }} />
                      </span>
                    </div>
                    <span className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">{k === "total" ? "Total" : STAT_LABEL[k]}</span>
                    <div className="flex items-center gap-2">
                      <span className="relative h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                        <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: B_HEX, opacity: bv >= av ? 1 : 0.45 }} initial={{ width: 0 }} animate={{ width: `${(bv / max) * 100}%` }} transition={{ duration: 0.6 }} />
                      </span>
                      <span className={cn("font-mono text-[12px] tabular-nums", bv >= av ? "font-semibold text-slate-900 dark:text-white" : "text-slate-400")}>{bv}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          Pick two characters to see who wins on paper.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaderboard                                                        */
/* ------------------------------------------------------------------ */
export function LeaderboardTab({ roster, onSelect }: { roster: Hero[]; onSelect: (h: Hero) => void }) {
  const [stat, setStat] = useState<"total" | StatKey>("total");
  const [align, setAlign] = useState<AlignFilter>("all");

  const top = useMemo(() => {
    const val = (h: Hero) => (stat === "total" ? h.total : h.powerstats[stat]);
    return roster
      .filter((h) => align === "all" || alignmentOf(h) === align)
      .sort((x, y) => val(y) - val(x) || x.name.localeCompare(y.name))
      .slice(0, 15)
      .map((h) => ({ h, v: val(h) }));
  }, [roster, stat, align]);

  const max = stat === "total" ? 600 : 100;

  return (
    <div className="p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          id="marvelBoardStat"
          ariaLabel="Ranking stat"
          value={stat}
          onChange={setStat}
          options={[{ key: "total", label: "Total" }, ...STATS.map((k) => ({ key: k, label: STAT_LABEL[k].slice(0, 3).toUpperCase(), title: STAT_LABEL[k] }))]}
        />
        <Segmented
          id="marvelBoardAlign"
          ariaLabel="Alignment"
          className="sm:ml-auto"
          value={align}
          onChange={setAlign}
          options={[
            { key: "all", label: "All" },
            { key: "good", label: "Heroes" },
            { key: "bad", label: "Villains" },
          ]}
        />
      </div>

      <ol className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70 dark:divide-white/[0.05] dark:border-white/[0.08]">
        {top.map(({ h, v }, i) => {
          const a = ALIGNMENT[alignmentOf(h)];
          return (
            <motion.li key={`${stat}-${align}-${h.id}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <button type="button" onClick={() => onSelect(h)} className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] sm:px-4">
                <span className={cn("w-6 shrink-0 text-right font-mono text-[12px] tabular-nums", i < 3 ? "font-semibold text-amber-500" : "text-slate-400")}>{i + 1}</span>
                <Portrait hero={h} size="xs" className="h-10 w-10 shrink-0 rounded-xl" />
                <span className="w-32 min-w-0 shrink-0 sm:w-48">
                  <span className="block truncate text-[13px] font-semibold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">{h.name}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider" style={{ color: a.hex }}>{a.label}</span>
                </span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(v / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: i * 0.03 }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">{v}</span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
