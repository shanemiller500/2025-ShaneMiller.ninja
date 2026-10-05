"use client";

/* ------------------------------------------------------------------ */
/*  Arcade character select                                             */
/* ------------------------------------------------------------------ */

import { memo, useEffect, useMemo, useState } from "react";
import { ARCHETYPE_INFO, specialList } from "../engine/fighters";
import type { Difficulty } from "../engine/ai";
import type { Alignment, Archetype, FighterDef, StatKey } from "../engine/types";
import { stinger } from "../audio/audio";
import { AlignBadge, ArcadeButton, ArchetypeBadge, Portrait, StatBars, powerTotal } from "./shared";
import css from "./fight-world.module.css";

type Sort = "featured" | "total" | "name" | StatKey;

interface Props {
  fighters: FighterDef[];
  /** How many players pick (1 = only P1, opponent decided elsewhere) */
  slots: 1 | 2;
  /** Which sides the CPU controls */
  cpu: [boolean, boolean];
  title: string;
  initial?: [FighterDef | null, FighterDef | null];
  favorites: number[];
  recent: number[];
  difficulty: Difficulty;
  showDifficulty: boolean;
  allowCpuToggle: boolean;
  offline: boolean;
  onToggleFavorite: (id: number) => void;
  onDifficulty: (d: Difficulty) => void;
  onCpuToggle?: (cpu: boolean) => void;
  onDetails: (f: FighterDef) => void;
  onConfirm: (p1: FighterDef, p2: FighterDef | null) => void;
  onBack: () => void;
}

const SORTS: { id: Sort; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "total", label: "Power level" },
  { id: "name", label: "Name" },
  { id: "strength", label: "Strength" },
  { id: "speed", label: "Speed" },
  { id: "combat", label: "Combat" },
  { id: "intelligence", label: "Intelligence" },
  { id: "durability", label: "Durability" },
  { id: "power", label: "Power" },
];

export default function CharacterSelect(p: Props) {
  const [picks, setPicks] = useState<[FighterDef | null, FighterDef | null]>(p.initial ?? [null, null]);
  const [active, setActive] = useState<0 | 1>(p.initial?.[0] && p.slots === 2 ? 1 : 0);
  const [hover, setHover] = useState<FighterDef | null>(null);
  const [q, setQ] = useState("");
  const [align, setAlign] = useState<"all" | Alignment>("all");
  const [arch, setArch] = useState<"all" | Archetype>("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [favOnly, setFavOnly] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let l = p.fighters.filter(
      (f) =>
        (align === "all" || f.alignment === align) &&
        (arch === "all" || f.archetype === arch) &&
        (!favOnly || p.favorites.includes(f.id)) &&
        (!needle || f.name.toLowerCase().includes(needle) || f.realName.toLowerCase().includes(needle))
    );
    if (sort === "name") l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "total") l = [...l].sort((a, b) => powerTotal(b.stats) - powerTotal(a.stats));
    else if (sort !== "featured") l = [...l].sort((a, b) => b.stats[sort] - a.stats[sort]);
    return l;
  }, [p.fighters, p.favorites, q, align, arch, sort, favOnly]);

  const recent = useMemo(() => p.recent.map((id) => p.fighters.find((f) => f.id === id)).filter(Boolean).slice(0, 8) as FighterDef[], [p.recent, p.fighters]);

  const pick = (f: FighterDef) => {
    stinger("select");
    const next: [FighterDef | null, FighterDef | null] = [...picks] as [FighterDef | null, FighterDef | null];
    next[active] = f;
    setPicks(next);
    if (p.slots === 2 && active === 0) setActive(1);
  };

  const random = () => {
    const pool = list.length ? list : p.fighters;
    pick(pool[Math.floor(Math.random() * pool.length)]);
  };

  const ready = !!picks[0] && (p.slots === 1 || !!picks[1]);
  const confirm = () => ready && p.onConfirm(picks[0]!, picks[1]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Enter" && ready) confirm();
      if (e.code === "Escape") p.onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const preview = (i: 0 | 1) => (active === i && hover ? hover : picks[i]);

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 px-3 pt-3 sm:px-5">
        <ArcadeButton tone="ghost" onClick={p.onBack}>
          ← Back
        </ArcadeButton>
        <h1 className="mfw-title text-2xl sm:text-4xl">{p.title}</h1>
        {p.offline && <span className="text-[10px] font-bold uppercase tracking-widest text-orange-300">Offline roster</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {p.allowCpuToggle && (
            <ArcadeButton tone={p.cpu[1] ? "gold" : "ghost"} onClick={() => p.onCpuToggle?.(!p.cpu[1])}>
              P2: {p.cpu[1] ? "CPU" : "Human"}
            </ArcadeButton>
          )}
          {p.showDifficulty && (
            <div className="flex">
              {(["easy", "normal", "hard", "insane"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => p.onDifficulty(d)}
                  className={`border-2 border-black px-2 py-1 text-[11px] font-black uppercase ${p.difficulty === d ? "bg-yellow-400 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <ArcadeButton tone="gold" big disabled={!ready} onClick={confirm}>
            {p.slots === 1 ? "Select" : "Fight!"}
          </ArcadeButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:px-5 lg:flex-row">
        <Preview f={preview(0)} side={0} label={p.cpu[0] ? "CPU" : "PLAYER 1"} active={active === 0} onClick={() => setActive(0)} onDetails={p.onDetails} />

        {/* Grid + filters */}
        <div className="mfw-panel flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${p.fighters.length} fighters…`}
              className="min-w-[10rem] flex-1 border-2 border-black bg-white/10 px-3 py-1.5 text-sm font-bold text-white placeholder-white/40 outline-none focus:bg-white/15"
            />
            <select value={align} onChange={(e) => setAlign(e.target.value as typeof align)} className="border-2 border-black bg-slate-800 px-2 py-1.5 text-xs font-bold">
              <option value="all">All sides</option>
              <option value="good">Heroes</option>
              <option value="bad">Villains</option>
              <option value="neutral">Neutral</option>
            </select>
            <select value={arch} onChange={(e) => setArch(e.target.value as typeof arch)} className="border-2 border-black bg-slate-800 px-2 py-1.5 text-xs font-bold">
              <option value="all">All styles</option>
              {(Object.keys(ARCHETYPE_INFO) as Archetype[]).map((a) => (
                <option key={a} value={a}>
                  {ARCHETYPE_INFO[a].label}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="border-2 border-black bg-slate-800 px-2 py-1.5 text-xs font-bold">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <button onClick={() => setFavOnly((v) => !v)} className={`border-2 border-black px-2 py-1.5 text-xs font-black ${favOnly ? "bg-yellow-400 text-black" : "bg-white/10"}`}>
              ★ Favorites
            </button>
            <ArcadeButton tone="ghost" onClick={random}>
              🎲 Random
            </ArcadeButton>
          </div>
          {recent.length > 0 && (
            <div className="mb-2 flex items-center gap-1 overflow-x-auto">
              <span className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-widest text-white/50">Recent</span>
              {recent.map((f) => (
                <button key={f.id} onClick={() => pick(f)} onMouseEnter={() => setHover(f)} className="h-10 w-8 shrink-0 overflow-hidden border-2 border-black" title={f.name}>
                  <Portrait src={f.portrait.xs} alt={f.name} className="h-full w-full" color={f.look.primary} />
                </button>
              ))}
            </div>
          )}
          <div className="mfw-scroll grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(64px,1fr))] content-start gap-1.5 overflow-y-auto pr-1 sm:grid-cols-[repeat(auto-fill,minmax(78px,1fr))]" onMouseLeave={() => setHover(null)}>
            {list.map((f) => (
              <Tile key={f.id} f={f} p1={picks[0]?.id === f.id} p2={picks[1]?.id === f.id} fav={p.favorites.includes(f.id)} onPick={pick} onHover={setHover} onFav={p.onToggleFavorite} />
            ))}
            {list.length === 0 && <p className="col-span-full p-6 text-center text-sm text-white/50">No fighters match those filters.</p>}
          </div>
        </div>

        {p.slots === 2 && <Preview f={preview(1)} side={1} label={p.cpu[1] ? "CPU" : "PLAYER 2"} active={active === 1} onClick={() => setActive(1)} onDetails={p.onDetails} />}
      </div>
    </div>
  );
}

const Tile = memo(function Tile({
  f,
  p1,
  p2,
  fav,
  onPick,
  onHover,
  onFav,
}: {
  f: FighterDef;
  p1: boolean;
  p2: boolean;
  fav: boolean;
  onPick: (f: FighterDef) => void;
  onHover: (f: FighterDef) => void;
  onFav: (id: number) => void;
}) {
  const cls = p1 && p2 ? css.tileBoth : p1 ? css.tileP1 : p2 ? css.tileP2 : "";
  return (
    <div className={`${css.tile} ${cls}`} onClick={() => onPick(f)} onMouseEnter={() => onHover(f)} title={f.name} role="button" aria-label={`Pick ${f.name}`}>
      <Portrait src={f.portrait.sm} alt={f.name} color={f.look.primary} />
      <div className={css.tileName}>{f.name}</div>
      {f.custom && <span className="absolute left-2 top-0.5 text-[9px] font-black text-yellow-300 drop-shadow">★ PRO</span>}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFav(f.id);
        }}
        className={`absolute right-1.5 top-0.5 text-sm ${fav ? "text-yellow-300" : "text-white/30 hover:text-white/80"}`}
        aria-label={fav ? "Unfavorite" : "Favorite"}
      >
        ★
      </button>
    </div>
  );
});

function Preview({ f, side, label, active, onClick, onDetails }: { f: FighterDef | null; side: 0 | 1; label: string; active: boolean; onClick: () => void; onDetails: (f: FighterDef) => void }) {
  const color = side === 0 ? "#ef4444" : "#3b82f6";
  return (
    <div
      onClick={onClick}
      className={`mfw-panel relative flex shrink-0 cursor-pointer flex-col overflow-hidden lg:w-[300px] xl:w-[340px] ${active ? "" : "opacity-80"}`}
      style={{ borderColor: active ? color : undefined }}
    >
      <div className="absolute left-0 top-0 z-10 px-3 py-1 text-xs font-black tracking-widest text-white" style={{ background: color }}>
        {label} {active && "◀ CHOOSING"}
      </div>
      {f ? (
        <div key={f.id} className={`flex flex-1 flex-row gap-3 p-3 pt-8 lg:flex-col ${side === 0 ? css.slideL : css.slideR}`}>
          <div className="relative h-40 w-28 shrink-0 overflow-hidden border-2 border-black sm:h-48 sm:w-36 lg:h-56 lg:w-full" style={{ background: f.look.primary }}>
            <Portrait src={f.portrait.md} alt={f.name} className="h-full w-full object-top" color={f.look.primary} eager />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
              <div className="mfw-title text-2xl lg:text-3xl" style={{ color: "#fff" }}>
                {f.name}
              </div>
              <div className="text-[11px] font-bold text-white/70">{f.realName}</div>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-1">
              <AlignBadge a={f.alignment} />
              <ArchetypeBadge a={f.archetype} />
              {f.custom && <span className="text-[10px] font-black text-yellow-300">★ SIGNATURE MOVES</span>}
            </div>
            <p className="text-xs italic text-white/70">{f.blurb}</p>
            <StatBars stats={f.stats} compact />
            <div className="hidden space-y-0.5 text-[11px] sm:block">
              {specialList(f).map(({ move, input }) => (
                <div key={move.id} className="flex justify-between gap-2">
                  <span className="truncate font-bold">{move.name}</span>
                  <span className="shrink-0 text-white/50">{input}</span>
                </div>
              ))}
              <div className="pt-1 text-white/60">
                <span className="font-bold text-yellow-200">{f.passive.name}:</span> {f.passive.desc}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDetails(f);
              }}
              className="text-xs font-black uppercase tracking-widest text-cyan-300 hover:text-cyan-200"
            >
              Full profile →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 pt-10 text-center text-sm font-bold uppercase tracking-widest text-white/40">Pick a fighter</div>
      )}
    </div>
  );
}
