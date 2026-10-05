"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SPECIES } from "../data/species";
import { DISASTER_OPTS, FOOD_OPTS, LAND_OPTS, PEOPLE_OPTS, PLANT_OPTS, TOOLS, WEATHER_OPTS, type Opt, type ToolId, type ToolState } from "../game/tools";
import type { SpeciesId } from "../sim/types";
import Portrait from "./Portrait";

/* ------------------------------------------------------------------ */
/*  The toy box: big chunky tool buttons along the bottom. Tools with  */
/*  choices pop a little drawer of options above the bar.              */
/* ------------------------------------------------------------------ */

const HAS_OPTIONS = new Set<ToolId>(["dino", "egg", "food", "plant", "land", "weather", "disaster", "people"]);

export default function Toolbar({ tool, setTool, unlocked }: { tool: ToolState; setTool: (t: Partial<ToolState>) => void; unlocked: SpeciesId[] }) {
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
      default:
        return TOOLS.find((t) => t.id === id)!.icon;
    }
  };

  const press = (id: ToolId) => {
    if (HAS_OPTIONS.has(id)) {
      setOpen((o) => (o === id ? null : id));
      // weather + boom choices act instantly, so don't switch tools until one is picked
      if (id !== "weather" && id !== "disaster") setTool({ id });
    } else {
      setTool({ id });
      setOpen(null);
    }
  };

  const pick = <K extends keyof ToolState>(key: K, value: ToolState[K], close = true) => {
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
              {open === "weather" && <Options opts={WEATHER_OPTS} value={tool.weather} onPick={(v) => pick("weather", v)} />}
              {open === "disaster" && <Options opts={DISASTER_OPTS} value={tool.disaster} onPick={(v) => pick("disaster", v)} />}
              <p className="mt-2 px-1 text-center text-xs font-medium text-white/70">{TOOLS.find((t) => t.id === open)!.tip}</p>
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
                  className={`group flex h-14 w-14 flex-col items-center justify-center rounded-[22px] transition duration-150 active:scale-90 sm:h-16 sm:w-16 ${
                    active ? "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-lg shadow-amber-900/30" : "hover:-translate-y-1 hover:bg-white/15"
                  }`}
                >
                  <span className={`text-[26px] leading-none transition group-hover:scale-110 sm:text-[30px] ${active ? "drop-shadow" : ""}`}>{iconFor(t.id)}</span>
                  <span className={`mt-0.5 hidden text-[10px] font-semibold sm:block ${active ? "text-slate-900/80" : "text-white/75"}`}>{t.label}</span>
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
