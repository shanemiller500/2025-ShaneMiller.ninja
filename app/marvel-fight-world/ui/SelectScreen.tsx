"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Dices, Heart, Search, X } from "lucide-react";

import { audio } from "../audio/audio";
import { ARCHETYPE_INFO, specialList } from "../engine/fighters";
import type { FighterDef } from "../engine/types";
import type { Roster } from "../data/roster";
import { AlignmentChip, ArcadeButton, ArchetypeChip, Backdrop, FighterTile, P_COLORS, StatBars, cn } from "./kit";

type Filter = "all" | "featured" | "good" | "bad" | "neutral" | "favorites" | "recent";
type Sort = "power" | "name" | "strength" | "speed" | "intelligence" | "durability" | "power2" | "combat";

const total = (d: FighterDef) => Object.values(d.stats).reduce((a, b) => a + b, 0);

interface Props {
  roster: Roster;
  title: string;
  /** How many players pick (1 = only P1; CPU opponent chosen automatically) */
  picks: 1 | 2;
  p2Label: string;
  favorites: number[];
  recent: number[];
  initial?: [FighterDef | null, FighterDef | null];
  onToggleFavorite: (id: number) => void;
  onView: (def: FighterDef) => void;
  onBack: () => void;
  onConfirm: (p1: FighterDef, p2: FighterDef | null) => void;
  confirmLabel?: string;
}

export function SelectScreen(p: Props) {
  const { roster, picks, favorites, recent } = p;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("power");
  const [chosen, setChosen] = useState<[FighterDef | null, FighterDef | null]>(p.initial ?? [null, null]);
  const [active, setActive] = useState<0 | 1>(p.initial?.[0] ? (picks === 2 && !p.initial?.[1] ? 1 : 0) : 0);
  const [hover, setHover] = useState<FighterDef | null>(null);
  const [cursor, setCursor] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = roster.fighters.filter((d) => {
      if (s && !`${d.name} ${d.realName}`.toLowerCase().includes(s)) return false;
      if (filter === "featured") return d.custom;
      if (filter === "good" || filter === "bad" || filter === "neutral") return d.alignment === filter;
      if (filter === "favorites") return favorites.includes(d.id);
      if (filter === "recent") return recent.includes(d.id);
      return true;
    });
    if (filter === "recent") l = [...l].sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    else if (sort === "name") l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort !== "power") {
      const k = sort === "power2" ? "power" : sort;
      l = [...l].sort((a, b) => b.stats[k] - a.stats[k]);
    } else if (filter !== "all") l = [...l].sort((a, b) => total(b) - total(a));
    return l;
  }, [roster, q, filter, sort, favorites, recent]);

  useEffect(() => setCursor(0), [q, filter, sort]);

  // Measure grid columns for keyboard navigation
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const tile = el.firstElementChild as HTMLElement | null;
      if (tile) setCols(Math.max(1, Math.round(el.clientWidth / (tile.offsetWidth + 8))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [list.length]);

  const needed = picks;
  const done = picks === 1 ? !!chosen[0] : !!chosen[0] && !!chosen[1];

  const pick = useCallback(
    (d: FighterDef) => {
      audio.unlock();
      audio.ui("confirm");
      audio.play("heavy", 0.5);
      setChosen((c) => {
        const next: [FighterDef | null, FighterDef | null] = [...c];
        next[active] = d;
        return next;
      });
      if (needed === 2 && active === 0) setActive(1);
    },
    [active, needed]
  );

  const randomPick = () => pick(list[Math.floor(Math.random() * list.length)] ?? roster.fighters[0]);

  const undo = () => {
    audio.ui("back");
    if (active === 1 && !chosen[1]) {
      setActive(0);
      setChosen([null, chosen[1]]);
    } else {
      setChosen((c) => {
        const n: [FighterDef | null, FighterDef | null] = [...c];
        n[active] = null;
        return n;
      });
    }
  };

  // Keyboard: arrows / WASD move, Enter / J pick, Backspace undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT") {
        if (e.key === "Enter" && list[0]) pick(list[cursor] ?? list[0]);
        return;
      }
      const map: Record<string, number> = { ArrowRight: 1, KeyD: 1, ArrowLeft: -1, KeyA: -1, ArrowDown: cols, KeyS: cols, ArrowUp: -cols, KeyW: -cols };
      if (map[e.code] !== undefined) {
        e.preventDefault();
        setCursor((c) => {
          const n = Math.max(0, Math.min(list.length - 1, c + map[e.code]));
          if (list[n]) setHover(list[n]);
          (gridRef.current?.children[n] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
          audio.ui("move");
          return n;
        });
      } else if (e.code === "Enter" || e.code === "KeyJ" || e.code === "Space") {
        e.preventDefault();
        if (done) p.onConfirm(chosen[0]!, chosen[1]);
        else if (list[cursor]) pick(list[cursor]);
      } else if (e.code === "Backspace" || e.code === "Escape") {
        if (chosen[0] || chosen[1]) undo();
        else p.onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const preview: [FighterDef | null, FighterDef | null] = [
    chosen[0] ?? (active === 0 ? hover : null),
    chosen[1] ?? (active === 1 ? hover : null),
  ];

  const FILTERS: [Filter, string][] = [
    ["all", `All ${roster.fighters.length}`],
    ["featured", "★ Featured"],
    ["good", "Heroes"],
    ["bad", "Villains"],
    ["neutral", "Neutral"],
    ["favorites", "♥ Favorites"],
    ["recent", "Recent"],
  ];

  return (
    <div className="absolute inset-0 isolate flex flex-col overflow-hidden text-white">
      <Backdrop tint={active === 0 ? "#0891b2" : "#be123c"} image={(preview[active] ?? preview[0])?.portrait.lg} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
        <button type="button" onClick={p.onBack} className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="mr-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">{p.title}</p>
          <p className="fw-display text-2xl font-[650] uppercase leading-none">
            Choose your fighter
            {needed === 2 && (
              <span className="ml-3 text-base" style={{ color: P_COLORS[active] }}>
                · {active === 0 ? "Player 1" : p.p2Label}
              </span>
            )}
          </p>
        </div>
        <label className="relative ml-auto w-full max-w-xs sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 272 fighters"
            aria-label="Search fighters"
            className="w-full rounded-lg border border-white/15 bg-black/40 py-2 pl-9 pr-8 text-sm text-white outline-none placeholder:text-white/35 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/10"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <ArcadeButton tone="ghost" size="sm" onClick={randomPick}>
          <Dices className="h-4 w-4" /> Random
        </ArcadeButton>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/5 bg-black/20 px-5 py-2">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setFilter(k);
              audio.ui("move");
            }}
            className={cn(
              "-skew-x-12 rounded px-3 py-1 text-xs font-black uppercase tracking-wider transition",
              filter === k ? "bg-amber-300 text-slate-950" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <span className="inline-block skew-x-12">{label}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-white/50">
          Sort
          {(
            [
              ["power", "Power"],
              ["name", "A–Z"],
              ["strength", "STR"],
              ["speed", "SPD"],
              ["intelligence", "INT"],
              ["durability", "DUR"],
              ["power2", "PWR"],
              ["combat", "CMB"],
            ] as [Sort, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setSort(k)} className={cn("rounded px-2 py-1 font-mono font-bold transition", sort === k ? "bg-white/20 text-white" : "hover:text-white")}>
              {label}
            </button>
          ))}
        </span>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(300px,380px)_1fr_minmax(300px,380px)]">
        <FighterPanel def={preview[0]} player={0} locked={!!chosen[0]} label="Player 1" active={active === 0} favorites={favorites} onFavorite={p.onToggleFavorite} onView={p.onView} onChange={() => { setActive(0); setChosen([null, chosen[1]]); }} />

        <div className="fw-thin-scroll min-h-0 overflow-y-auto px-4 py-4">
          {list.length === 0 ? (
            <p className="mt-20 text-center text-white/50">No fighters match.</p>
          ) : (
            <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 xl:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {list.map((d, i) => (
                <div key={d.id} className={cn("rounded-md", i === cursor && "ring-2 ring-amber-300 ring-offset-2 ring-offset-black")}>
                  <FighterTile def={d} p1={chosen[0]?.id === d.id || (active === 0 && !chosen[0] && hover?.id === d.id)} p2={chosen[1]?.id === d.id || (active === 1 && !chosen[1] && hover?.id === d.id)} favorite={favorites.includes(d.id)} onPick={pick} onHover={setHover} />
                </div>
              ))}
            </div>
          )}
        </div>

        <FighterPanel def={preview[1]} player={1} locked={!!chosen[1]} label={needed === 2 ? p.p2Label : "Opponent"} active={active === 1} hiddenNote={needed === 1 ? "Opponent chosen for you" : undefined} favorites={favorites} onFavorite={p.onToggleFavorite} onView={p.onView} onChange={() => { setActive(1); setChosen([chosen[0], null]); }} />
      </div>

      {/* Ready bar */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="flex items-center justify-center gap-4 border-t border-amber-300/30 bg-black/70 px-6 py-4 backdrop-blur">
            <p className="fw-display hidden text-2xl font-[650] uppercase sm:block">
              <span style={{ color: P_COLORS[0] }}>{chosen[0]!.name}</span>
              {chosen[1] && (
                <>
                  <span className="mx-3 text-amber-300">vs</span>
                  <span style={{ color: P_COLORS[1] }}>{chosen[1].name}</span>
                </>
              )}
            </p>
            <ArcadeButton size="lg" onClick={() => p.onConfirm(chosen[0]!, chosen[1])} autoFocus>
              {p.confirmLabel ?? "Choose arena"} →
            </ArcadeButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Side panel ────────────────────────────────────────────────────── */
function FighterPanel({
  def,
  player,
  locked,
  label,
  active,
  hiddenNote,
  favorites,
  onFavorite,
  onView,
  onChange,
}: {
  def: FighterDef | null;
  player: 0 | 1;
  locked: boolean;
  label: string;
  active: boolean;
  hiddenNote?: string;
  favorites: number[];
  onFavorite: (id: number) => void;
  onView: (d: FighterDef) => void;
  onChange: () => void;
}) {
  const color = P_COLORS[player];
  return (
    <div className={cn("relative hidden min-h-0 flex-col overflow-hidden border-white/10 lg:flex", player === 0 ? "border-r" : "border-l")}>
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="fw-display text-lg font-[650] uppercase" style={{ color }}>
          {label}
        </p>
        {locked ? (
          <button type="button" onClick={onChange} className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/20 hover:text-white">
            Change
          </button>
        ) : (
          active && <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color, animation: "fw-pulse 1.2s infinite" }}>Selecting…</span>
        )}
      </div>

      {hiddenNote && !def ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-white/50">
          <Dices className="h-10 w-10" />
          <p>{hiddenNote}</p>
        </div>
      ) : !def ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-white/40">Hover a fighter to preview</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={def.id} initial={{ opacity: 0, x: player === 0 ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fw-thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="relative mx-5 mt-3 aspect-[4/5] shrink-0 overflow-hidden rounded-xl" style={{ boxShadow: locked ? `0 0 0 3px ${color}, 0 0 40px ${color}88` : "0 0 0 1px rgba(255,255,255,0.1)" }}>
              <img src={def.portrait.lg} alt={def.name} className="h-full w-full object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
              {locked && (
                <motion.span initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fw-display absolute right-3 top-3 -rotate-6 rounded px-2 py-0.5 text-sm font-[650] uppercase text-slate-950" style={{ background: color }}>
                  Locked in
                </motion.span>
              )}
              <div className="absolute inset-x-4 bottom-3">
                <p className="fw-display fw-outline text-4xl font-[650] uppercase leading-none text-white">{def.name}</p>
                {def.realName !== def.name && <p className="mt-1 text-sm text-white/70">{def.realName}</p>}
              </div>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <ArchetypeChip def={def} />
                <AlignmentChip def={def} />
                {def.custom && <span className="rounded-sm bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-950">★ Signature moves</span>}
                <button type="button" onClick={() => onFavorite(def.id)} aria-label="Favorite" className="ml-auto rounded p-1 text-white/60 hover:text-rose-400">
                  <Heart className={cn("h-4 w-4", favorites.includes(def.id) && "fill-rose-400 text-rose-400")} />
                </button>
              </div>
              <p className="text-[13px] leading-relaxed text-white/70">{def.blurb}</p>
              <StatBars def={def} />
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Health", def.maxHealth],
                  ["Power", `${Math.round(def.physMul * 100)}%`],
                  ["Speed", def.walk.toFixed(1)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/[0.05] py-2 ring-1 ring-white/10">
                    <p className="font-mono text-base font-bold tabular-nums">{v}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/45">{k}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                  Passive · <span style={{ color: ARCHETYPE_INFO[def.archetype].color }}>{def.passive.name}</span>
                </p>
                <p className="text-[13px] text-white/70">{def.passive.desc}</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Special moves</p>
                {specialList(def).map(({ input, move }) => (
                  <div key={move.id} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-1.5">
                    <span className={cn("text-[13px] font-semibold", move.kind === "ultimate" ? "text-amber-300" : "text-white")}>{move.name}</span>
                    <span className="font-mono text-[10px] text-white/45">{input}</span>
                  </div>
                ))}
              </div>
              <ArcadeButton tone="ghost" size="sm" className="w-full" onClick={() => onView(def)}>
                View character file
              </ArcadeButton>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
