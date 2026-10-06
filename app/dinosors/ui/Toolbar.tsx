"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SPECIES } from "../data/species";
import { TECH } from "../data/facts";
import { RES_INFO } from "../data/colony";
import { BUILD_BY_ID, BUILD_DEFS, DISASTER_OPTS, FOOD_OPTS, LAND_OPTS, PEOPLE_OPTS, PLANT_OPTS, TOOLS, WEATHER_OPTS, type BuildDef, type BuildOpt, type Opt, type ToolId, type ToolState } from "../game/tools";
import type { Resource, SpeciesId, TechId } from "../sim/types";
import Portrait from "./Portrait";
import { GameIcon } from "./GameIcon";

/* ------------------------------------------------------------------ */
/*  The toy box: big chunky tool buttons along the bottom. Tools with  */
/*  choices pop a little drawer of options above the bar.              */
/* ------------------------------------------------------------------ */

const HAS_OPTIONS = new Set<ToolId>(["dino", "egg", "food", "plant", "land", "weather", "disaster", "people", "build"]);

export default function Toolbar({ tool, setTool, unlocked, learned = [], stock = {} }: { tool: ToolState; setTool: (t: Partial<ToolState>) => void; unlocked: SpeciesId[]; learned?: TechId[]; stock?: Record<string, number> }) {
  const [open, setOpen] = useState<ToolId | null>(null);
  const [tip, setTip] = useState<ToolId | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const iconFor = (id: ToolId) => {
    switch (id) {
      case "dino":
        return SPECIES.find((s) => s.id === tool.species)?.emoji ?? "🦖";
      case "food":
        return FOOD_OPTS.find((o) => o.value === tool.food)!.icon;
      case "plant":
        return PLANT_OPTS.find((o) => o.value === tool.plant)!.icon;
      case "land":
        return LAND_OPTS.find((o) => o.value === tool.land)!.icon;
      case "people":
        return PEOPLE_OPTS.find((o) => o.value === tool.people)!.icon;
      case "build":
        return BUILD_BY_ID[tool.build].icon;
      default:
        return TOOLS.find((t) => t.id === id)!.icon;
    }
  };

  // every toy toggles: tap it to switch it on, tap it again to switch it off
  const press = (id: ToolId) => {
    if (id === "hand") {
      setTool({ id: "hand" });
      setOpen(null);
      return;
    }
    const active = tool.id === id;
    if (active || open === id) {
      setOpen(null);
      if (active) setTool({ id: "hand" });
      return;
    }
    if (HAS_OPTIONS.has(id)) {
      setOpen(id);
      // weather + most boom choices act instantly, so don't switch tools until one is picked
      if (id !== "weather" && id !== "disaster") setTool({ id });
    } else {
      setTool({ id });
      setOpen(null);
    }
  };

  const pick = <K extends keyof ToolState>(key: K, value: ToolState[K], close = true) => {
    // tapping the option that's already on turns the toy off
    if (open && open !== "weather" && tool.id === open && tool[key] === value) {
      setTool({ id: "hand" });
      setOpen(null);
      return;
    }
    setTool({ [key]: value, ...(open ? { id: open } : {}) } as Partial<ToolState>);
    if (close) setOpen(null);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2 sm:bottom-4">
      <div className="pointer-events-auto relative max-w-full">
        <AnimatePresence>
          {open && (
            <div key={open} className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 flex w-[calc(100vw-16px)] -translate-x-1/2 justify-center">
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 460, damping: 32 }}
              className="dl-glass pointer-events-auto w-max max-w-full rounded-3xl p-2.5 shadow-2xl"
            >
              {(open === "dino" || open === "egg") && (
                <SpeciesGrid
                  value={open === "dino" ? tool.species : tool.egg}
                  unlocked={unlocked}
                  egg={open === "egg"}
                  onPick={(s) => pick(open === "dino" ? "species" : "egg", s)}
                />
              )}
              {open === "food" && <Options opts={FOOD_OPTS} value={tool.food} onPick={(v) => pick("food", v)} />}
              {open === "plant" && <Options opts={PLANT_OPTS} value={tool.plant} onPick={(v) => pick("plant", v)} />}
              {open === "land" && <Options opts={LAND_OPTS} value={tool.land} onPick={(v) => pick("land", v)} />}
              {open === "people" && <Options opts={PEOPLE_OPTS} value={tool.people} onPick={(v) => pick("people", v)} />}
              {open === "build" && <BuildMenu value={tool.build} learned={learned} stock={stock} onPick={(v) => pick("build", v, false)} />}
              {open === "weather" && <Options opts={WEATHER_OPTS} value={tool.weather} onPick={(v) => pick("weather", v)} />}
              {open === "disaster" && <Options opts={DISASTER_OPTS} value={tool.disaster} onPick={(v) => pick("disaster", v)} />}
              <p className="mt-2 px-1 text-center text-xs font-medium text-white/70">
                {TOOLS.find((t) => t.id === open)!.tip}
                <span className="text-white/45"> · tap again to turn off</span>
              </p>
            </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="dl-glass dl-scroll flex max-w-[calc(100vw-16px)] gap-1 overflow-x-auto rounded-[28px] p-1.5 shadow-2xl">
          {TOOLS.map((t) => {
            const active = tool.id === t.id || open === t.id;
            return (
              <div key={t.id} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => press(t.id)}
                  onMouseEnter={() => setTip(t.id)}
                  onMouseLeave={() => setTip(null)}
                  aria-label={t.label}
                  aria-pressed={active}
                  title={active && t.id !== "hand" ? `${t.label} is on — tap to turn off` : t.label}
                  className={`group flex h-14 w-14 flex-col items-center justify-center rounded-[22px] transition duration-150 active:scale-90 sm:h-16 sm:w-16 ${
                    active ? "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-lg shadow-amber-900/30" : "hover:-translate-y-1 hover:bg-white/15"
                  }`}
                >
                  <span className={`text-[26px] leading-none transition group-hover:scale-110 sm:text-[30px] ${active ? "drop-shadow" : ""}`}>{iconFor(t.id)}</span>
                  <span className={`mt-0.5 hidden text-[10px] font-semibold sm:block ${active ? "text-slate-900/80" : "text-white/75"}`}>{tool.id === t.id && t.id !== "hand" ? "ON ✕" : t.label}</span>
                </button>
              </div>
            );
          })}
        </div>
        <AnimatePresence>
          {tip && !open && (
            <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-0 right-0 hidden justify-center sm:flex">
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="whitespace-nowrap rounded-2xl bg-slate-900/90 px-3 py-1.5 text-sm font-medium shadow-lg">
                {TOOLS.find((t) => t.id === tip)!.tip}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const CATS: { id: BuildDef["cat"]; icon: string; label: string }[] = [
  { id: "homes", icon: "🏡", label: "Homes" },
  { id: "defense", icon: "🛡️", label: "Defense" },
  { id: "work", icon: "⚒️", label: "Work" },
  { id: "land", icon: "🗺️", label: "Land" },
];

/** Icon grid of everything buildable, by category, with costs + what's still locked. */
function BuildMenu({ value, learned, stock, onPick }: { value: BuildOpt; learned: TechId[]; stock: Record<string, number>; onPick: (v: BuildOpt) => void }) {
  const [cat, setCat] = useState<BuildDef["cat"]>(BUILD_BY_ID[value]?.cat ?? "homes");
  const has = new Set(learned);
  const cur = BUILD_BY_ID[value];
  return (
    <div className="w-[min(560px,calc(100vw-40px))]">
      <div className="mb-2 grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1 text-[12px] font-bold">
        {CATS.map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`rounded-xl py-1.5 transition active:scale-95 ${cat === c.id ? "bg-amber-400 text-slate-900" : "hover:bg-white/10"}`}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {BUILD_DEFS.filter((b) => b.cat === cat).map((b) => {
          const locked = !!b.tech && !has.has(b.tech);
          const afford = (Object.entries(b.cost) as [Resource, number][]).every(([r, n]) => (stock[r] ?? 0) >= n);
          return (
            <button
              key={b.value}
              type="button"
              onClick={() => onPick(b.value)}
              title={locked ? `Invent ${TECH[b.tech!].name} first` : b.tip}
              className={`relative flex flex-col items-center rounded-2xl px-1 pb-1.5 pt-2 transition active:scale-95 ${b.value === value ? "bg-white/25 ring-2 ring-amber-300" : "bg-white/5 hover:-translate-y-0.5 hover:bg-white/15"} ${locked ? "opacity-50" : ""}`}
            >
              {["spikes", "barricade", "totem", "tannery"].includes(b.value) ? <GameIcon id={b.value} size={30} className={locked ? "grayscale" : ""} /> : <span className={`text-[28px] leading-none ${locked ? "grayscale" : ""}`}>{b.icon}</span>}
              <span className="mt-1 text-center text-[11px] font-semibold leading-tight">{b.label}</span>
              <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                {(Object.entries(b.cost) as [Resource, number][]).map(([r, n]) => (
                  <span key={r} className={`flex items-center gap-0.5 rounded-full px-1 text-[10px] font-bold ${(stock[r] ?? 0) >= n ? "bg-white/10" : "bg-rose-500/30"}`}>
                    <GameIcon id={r} size={11} />
                    {n}
                  </span>
                ))}
              </span>
              {locked && <span className="absolute right-1 top-1 text-[11px]">🔒</span>}
              {!locked && !afford && <span className="absolute right-1 top-1 text-[10px]" title="Not enough yet: gatherers will fetch it">⏳</span>}
            </button>
          );
        })}
      </div>
      {cur && (
        <p className="mt-2 px-1 text-center text-[12px] leading-snug text-white/75">
          <span className="font-bold text-white">
            {cur.icon} {cur.label}:
          </span>{" "}
          {cur.tech && !has.has(cur.tech) ? `invent ${TECH[cur.tech].icon} ${TECH[cur.tech].name} first.` : cur.tip}
          {cur.line && !/drag/i.test(cur.tip) ? " Drag to draw." : ""}
        </p>
      )}
    </div>
  );
}

function Options<V extends string>({ opts, value, onPick }: { opts: Opt<V>[]; value: V; onPick: (v: V) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className={`flex h-[72px] w-[72px] flex-col items-center justify-center rounded-2xl transition active:scale-90 ${o.value === value ? "bg-white/25 ring-2 ring-amber-300" : "bg-white/5 hover:-translate-y-0.5 hover:bg-white/15"}`}
        >
          <span className="text-3xl leading-none">{o.icon}</span>
          <span className="mt-1 text-[11px] font-semibold text-white/85">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function SpeciesGrid({ value, unlocked, egg, onPick }: { value: SpeciesId; unlocked: SpeciesId[]; egg: boolean; onPick: (s: SpeciesId) => void }) {
  const list = SPECIES.filter((s) => !egg || s.move !== "swim");
  return (
    <div className="dl-scroll grid max-h-[46vh] grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-6">
      {list.map((s) => {
        const ok = unlocked.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            title={ok ? s.name : "Find this dino in the world to unlock it!"}
            className={`relative flex w-[92px] flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 transition active:scale-95 ${s.id === value ? "bg-white/25 ring-2 ring-amber-300" : "bg-white/5 hover:bg-white/15"}`}
          >
            <Portrait species={s.id} locked={!ok} baby={egg} w={84} h={58} />
            <span className={`text-[12px] font-semibold ${ok ? "" : "text-white/50"}`}>{ok ? s.nick : "???"}</span>
            {!ok && <span className="absolute right-1.5 top-1 text-sm">🔒</span>}
            {egg && ok && <span className="absolute left-1.5 top-1 text-sm">🥚</span>}
          </button>
        );
      })}
    </div>
  );
}
