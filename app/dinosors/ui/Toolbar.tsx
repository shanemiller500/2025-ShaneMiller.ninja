"use client";

import { BREED_LIST } from "../data/dragons";
import { type CivPath, type CivTechId } from "../data/civ";
import { memo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudSun, Drumstick, Dumbbell, Egg, Eraser, Flag, Flame, Hammer, Hand, Map as MapIcon, Mountain, SunMoon, TreePine, Users, X, Zap, type LucideIcon } from "lucide-react";
import { SPECIES } from "../data/species";
import { BUILD_BY_ID, BUILD_DEFS, bestBuild, buildCost, buildVisible, DISASTER_OPTS, FARM_CROP_OPTS, FOLK_GROUP_OPTS, FOLK_PEOPLE, FOOD_OPTS, LAND_OPTS, PEOPLE_OPTS, PLANT_OPTS, TOOLS, WEATHER_OPTS, type BuildDef, type BuildOpt, type Opt, type ToolId, type ToolState } from "../game/tools";
import type { Resource, SpeciesId, TechId } from "../sim/types";
import Portrait from "./Portrait";
import { GameIcon } from "./GameIcon";
import { useClickAway } from "./useClickAway";

/* ------------------------------------------------------------------ */
/*  The toy box: big chunky tool buttons along the bottom. Tools with  */
/*  choices pop a little drawer of options above the bar.              */
/* ------------------------------------------------------------------ */

/** A long-necked dinosaur in the same line style as the other icons. */
const DinoGlyph = (({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number | string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M1.5 17c2.300-.2 3.900-1.400 5-3.300C7.600 11.800 9.300 11 11.300 11h1.200c1.700 0 2.900-1 3.300-2.600l.6-2.600C16.800 4.100 18 3 19.500 3h.7a1.800 1.800 0 0 1 0 3.600h-1l-.8 4.300c-.4 2-1.300 3.300-2.900 4V20" />
    <path d="M8 14.700V20" />
    <path d="M8 15h7.500" />
  </svg>
)) as unknown as LucideIcon;

const TOOL_ICON: Record<ToolId, LucideIcon> = { hand: Hand, build: Hammer, people: Users, dino: DinoGlyph, food: Drumstick, egg: Egg, plant: TreePine, land: Mountain, fire: Flame, weather: CloudSun, disaster: Zap, erase: Eraser };
/** the order along the bar, in groups (a hairline between them): look · run the tribe · make life · shape the world */
const BAR: (ToolId | "map" | "train" | "shifts" | "|")[] = ["hand", "map", "|", "train", "shifts", "build", "people", "|", "dino", "food", "egg", "plant", "land", "|", "fire", "weather", "disaster", "erase"];

const HAS_OPTIONS = new Set<ToolId>(["dino", "egg", "food", "plant", "land", "weather", "disaster", "people", "build"]);

export default memo(Toolbar);

/** The toy box: memoized, so it only re-renders when the tool, unlocks, techs or stock actually change. */
function Toolbar({ tool, setTool, unlocked, learned = [], stock = {}, ownedBuilds = {}, civDone = [], civPath = "none", trainOpen = false, onTrain, shiftOpen = false, onShifts, orphanNests = [], onClaimNest, mapOpen, onMap }: { tool: ToolState; setTool: (t: Partial<ToolState>) => void; unlocked: SpeciesId[]; learned?: TechId[]; stock?: Record<string, number>; ownedBuilds?: Partial<Record<BuildOpt, number>>; civDone?: CivTechId[]; civPath?: CivPath; trainOpen?: boolean; onTrain?: () => void; shiftOpen?: boolean; onShifts?: () => void; orphanNests?: { id: number; breed: string; eggs: number; found: boolean }[]; onClaimNest?: (id: number) => void; mapOpen: boolean; onMap: () => void }) {
  const [open, setOpen] = useState<ToolId | null>(null);
  const [tip, setTip] = useState<ToolId | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useClickAway(!!open, toolbarRef, () => setOpen(null));

  /** While a tool with choices is on, its button shows what you picked (the dino, the food…). */
  const pickedIcon = (id: ToolId): string | null => {
    if (tool.id !== id) return null;
    switch (id) {
      case "dino":
        return SPECIES.find((s) => s.id === tool.species)?.emoji ?? null;
      case "food":
        return FOOD_OPTS.find((o) => o.value === tool.food)?.icon ?? null;
      case "plant":
        return PLANT_OPTS.find((o) => o.value === tool.plant)?.icon ?? null;
      case "land":
        return LAND_OPTS.find((o) => o.value === tool.land)?.icon ?? null;
      case "people":
        return PEOPLE_OPTS.find((o) => o.value === tool.people)?.icon ?? null;
      case "build":
        return BUILD_BY_ID[bestBuild(tool.build, (t) => learned.includes(t), (c) => civDone.includes(c))].icon;
      default:
        return null;
    }
  };

  // Open choice menus with the Hand active so the last choice cannot be used accidentally.
  const press = (id: ToolId) => {
    if (id === "hand") {
      setTool({ id: "hand" });
      setOpen(null);
      return;
    }
    if (open === id) {
      setOpen(null);
      return;
    }
    if (HAS_OPTIONS.has(id)) {
      setTool({ id: "hand" });
      setOpen(id);
    } else {
      setTool({ id: tool.id === id ? "hand" : id });
      setOpen(null);
    }
  };

  /** The open menu only shows a choice once the player has made one this time (the tool is the Hand until then). */
  const chosen = <V,>(v: V): V | null => (open && tool.id === open ? v : null);

  const pick = <K extends keyof ToolState>(key: K, value: ToolState[K], close = true) => {
    setTool({ [key]: value, ...(open ? { id: open } : {}) } as Partial<ToolState>);
    if (close) setOpen(null);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8px)] z-[31] flex justify-center px-2 sm:bottom-4">
      <div ref={toolbarRef} className="pointer-events-auto relative max-w-full">
        <AnimatePresence>
          {open && (
            <div key={open} className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 flex w-[calc(100vw-16px)] -translate-x-1/2 justify-center">
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 460, damping: 32 }}
              className="dl-glass pointer-events-auto w-max max-w-full rounded-3xl p-3 shadow-2xl"
            >
              {(open === "dino" || open === "egg") && (
                <SpeciesGrid
                  value={chosen(open === "dino" ? tool.species : tool.dragonEgg ? null : tool.egg)}
                  unlocked={unlocked}
                  egg={open === "egg"}
                  onPick={(s) => { if (open === "egg") setTool({ dragonEgg: null }); pick(open === "dino" ? "species" : "egg", s); }}
                />
              )}
              {open === "dino" && orphanNests.length > 0 && onClaimNest && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-amber-100/75">🐉 Nests with eggs and no dragon: send one to take over</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {orphanNests.map((n) => {
                      const b = BREED_LIST.find((x) => x.id === n.breed);
                      return (
                        <button key={n.id} type="button" onClick={() => onClaimNest(n.id)}
                          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white/10 px-2.5 text-xs font-bold transition hover:bg-white/20 active:scale-95">
                          <span className="inline-block h-4 w-3 rounded-[50%]" style={{ background: b?.look.egg, boxShadow: `inset -2px -2px 0 ${b?.look.spots}` }} />
                          {b?.name ?? "Dragon"} · {n.eggs} egg{n.eggs > 1 ? "s" : ""}{n.found ? "" : " (hidden nest)"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {open === "egg" && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-amber-100/75">🐉 Dragon eggs (tap near a nest to add to it)</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {BREED_LIST.map((b) => (
                      <button key={b.id} type="button" onClick={() => setTool({ id: "egg", dragonEgg: b.id })} aria-pressed={chosen(tool.dragonEgg) === b.id}
                        className={`flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition active:scale-95 ${chosen(tool.dragonEgg) === b.id ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
                        <span className="inline-block h-4 w-3 rounded-[50%]" style={{ background: b.look.egg, boxShadow: `inset -2px -2px 0 ${b.look.spots}` }} />
                        {b.name.replace(" Dragon", "")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {open === "food" && <Options opts={FOOD_OPTS} value={chosen(tool.food)} onPick={(v) => pick("food", v)} />}
              {open === "plant" && <Options opts={PLANT_OPTS} value={chosen(tool.plant)} onPick={(v) => pick("plant", v)} />}
              {open === "land" && <div className="dl-scroll max-h-[min(54vh,470px)] space-y-2 overflow-y-auto pr-1">
                <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-amber-100/75">Paint terrain</p>
                <Options opts={LAND_OPTS.slice(0, 4)} value={chosen(tool.land)} onPick={(v) => pick("land", v)} />
                <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-amber-100/75">Place surface materials</p>
                <Options opts={LAND_OPTS.slice(4)} value={chosen(tool.land)} onPick={(v) => pick("land", v)} />
              </div>}
              {open === "people" && (
                <>
                  <Options opts={PEOPLE_OPTS} value={chosen(tool.people)} onPick={(v) => pick("people", v, !FOLK_PEOPLE.has(v))} />
                  {tool.id === "people" && FOLK_PEOPLE.has(tool.people) && (
                    <>
                      <p className="mt-2 px-1 text-[11px] font-bold uppercase tracking-wide text-amber-100/75">They arrive as…</p>
                      <div className="flex flex-wrap gap-1.5">
                        {FOLK_GROUP_OPTS.filter((o) => o.value !== "caravan" || tool.people === "sandFolk" || tool.people === "snowFolk").map((o) => (
                          <button key={o.value} type="button" aria-pressed={tool.folkGroup === o.value} onClick={() => { setTool({ id: "people", folkGroup: o.value }); setOpen(null); }}
                            className={`flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition active:scale-95 ${tool.folkGroup === o.value ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
                            <span className="text-base">{o.icon}</span> {o.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              {open === "build" && <BuildMenu value={chosen(tool.build)} farmCrop={tool.farmCrop} onFarmCrop={(v) => setTool({ farmCrop: v })} learned={learned} civDone={civDone} civPath={civPath} stock={stock} ownedBuilds={ownedBuilds} onPick={(v) => pick("build", v)} />}
              {open === "weather" && <Options opts={WEATHER_OPTS} value={chosen(tool.weather)} onPick={(v) => pick("weather", v)} />}
              {open === "disaster" && <Options opts={DISASTER_OPTS} value={chosen(tool.disaster)} onPick={(v) => pick("disaster", v)} />}
              <p className="mt-2 px-1 text-center text-xs font-medium text-white/70">
                {TOOLS.find((t) => t.id === open)!.tip}
                <span className="text-white/45"> · tap again to turn off</span>
              </p>
            </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="dl-glass dl-scroll flex max-w-[calc(100vw-16px)] items-stretch gap-0.5 overflow-x-auto rounded-[22px] px-1.5 pb-2 pt-1.5" role="toolbar" aria-label="Tools">
          {BAR.map((id, i) => {
            const cell = "dl-tool group flex h-[54px] w-[52px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl text-white/70 sm:w-[58px]";
            const label = "text-[10px] font-semibold leading-none tracking-wide";
            if (id === "|") return <span key={`sep${i}`} className="dl-sep" aria-hidden />;
            if (id === "map")
              return (
                <button key={id} type="button" onClick={() => { setOpen(null); onMap(); }} aria-label="Map" aria-pressed={mapOpen} title="Show the world map" className={`${cell} sm:hidden`}>
                  <MapIcon className="h-[22px] w-[22px]" strokeWidth={1.9} />
                  <span className={label}>Map</span>
                </button>
              );
            if (id === "train")
              return (
                <button key={id} type="button" onClick={() => { setOpen(null); setTool({ id: "hand" }); onTrain?.(); }} aria-label="Train dinosaurs" aria-pressed={trainOpen} title="Train dinosaurs and manage hauling" className={cell}>
                  <Dumbbell className="h-[22px] w-[22px]" strokeWidth={1.9} />
                  <span className={label}>Train</span>
                </button>
              );
            if (id === "shifts")
              return (
                <button key={id} type="button" onClick={() => { setOpen(null); setTool({ id: "hand" }); onShifts?.(); }} aria-label="Shifts" aria-pressed={shiftOpen} title="Day and night shifts" className={cell}>
                  <SunMoon className="h-[22px] w-[22px]" strokeWidth={1.9} />
                  <span className={label}>Shifts</span>
                </button>
              );
            const t = TOOLS.find((x) => x.id === id)!;
            // with a drawer open, only that tool is lit (the Hand is just what's held meanwhile)
            const active = open ? open === t.id : tool.id === t.id;
            const on = tool.id === t.id && t.id !== "hand";
            const Icon = TOOL_ICON[t.id];
            const emoji = pickedIcon(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => press(t.id)}
                onMouseEnter={() => setTip(t.id)}
                onMouseLeave={() => setTip(null)}
                aria-label={on ? `${t.label} is on: tap to turn off` : t.label}
                aria-pressed={active}
                title={on ? `${t.label} is on: tap to turn off` : t.label}
                className={cell}
              >
                {emoji ? <span className="text-[21px] leading-none">{emoji}</span> : <Icon className="h-[22px] w-[22px] transition-transform duration-150 group-hover:scale-110" strokeWidth={1.9} />}
                <span className={label}>{t.label}</span>
                {on && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white ring-2 ring-amber-400" aria-hidden>
                    <X className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <AnimatePresence>
          {tip && !open && (
            <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-0 right-0 hidden justify-center sm:flex">
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="dl-glass max-w-[min(560px,calc(100vw-24px))] rounded-xl px-3 py-1.5 text-center text-[13px] font-medium text-white/90">
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
  { id: "wonders", icon: "🏛️", label: "Wonders" },
];

/** Icon grid of what the tribe can build right now, by category, with costs. Future eras stay hidden until they're learned. */
function BuildMenu({ value, farmCrop, onFarmCrop, learned, civDone, stock, ownedBuilds, onPick }: { value: BuildOpt | null; farmCrop: ToolState["farmCrop"]; onFarmCrop: (v: ToolState["farmCrop"]) => void; learned: TechId[]; civDone: CivTechId[]; civPath: CivPath; stock: Record<string, number>; ownedBuilds: Partial<Record<BuildOpt, number>>; onPick: (v: BuildOpt) => void }) {
  const has = new Set(learned);
  const civ = new Set(civDone);
  const knows = (t: TechId) => has.has(t);
  const did = (c: CivTechId) => civ.has(c);
  // only what can be built now, and only the newest version of it (no wood walls once stone is known)
  const visible = (b: BuildDef) => buildVisible(b, knows, did);
  const cats = CATS.filter((c) => BUILD_DEFS.some((b) => b.cat === c.id && visible(b)));
  const best = value ? bestBuild(value, knows, did) : null;
  const [pickedCat, setCat] = useState<BuildDef["cat"]>((best && BUILD_BY_ID[best]?.cat) || "homes");
  const cat = cats.some((c) => c.id === pickedCat) ? pickedCat : cats[0]?.id ?? "homes";
  const cur = best && visible(BUILD_BY_ID[best]) ? BUILD_BY_ID[best] : null;
  return (
    <div className="w-[min(560px,calc(100vw-40px))]">
      <div className="mb-2 grid gap-1 rounded-2xl bg-white/5 p-1 text-[12px] font-bold" style={{ gridTemplateColumns: `repeat(${Math.max(1, cats.length)}, minmax(0, 1fr))` }}>
        {cats.map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`rounded-xl py-1.5 transition active:scale-95 ${cat === c.id ? "bg-amber-400 text-slate-900" : "hover:bg-white/10"}`}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {best === "farm" && <div className="mb-2 rounded-2xl bg-white/5 p-2"><p className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-amber-100/75">Choose field seed</p><Options opts={FARM_CROP_OPTS} value={farmCrop} onPick={onFarmCrop} /></div>}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {BUILD_DEFS.filter((b) => b.cat === cat && visible(b)).map((b) => {
          const cost = buildCost(b, knows);
          const afford = (Object.entries(cost) as [Resource, number][]).every(([r, n]) => (stock[r] ?? 0) >= n);
          const isAction = b.value === "cleanMud" || b.value === "levitate";
          const owned = ownedBuilds[b.value] ?? 0;
          const stoneTower = b.value === "tower" && knows("stonewall");
          return (
            <button
              key={b.value}
              type="button"
              onClick={() => onPick(b.value)}
              title={b.tip}
              className={`relative flex flex-col items-center rounded-2xl px-1 pb-1.5 pt-2 transition active:scale-95 ${b.value === best ? "dl-btn bg-amber-400/90 text-[#0f172a]" : "bg-white/5 hover:-translate-y-0.5 hover:bg-white/15"}`}
            >
              <span className="mb-0.5 flex h-3.5 w-full items-center justify-end gap-1 text-[10px] font-bold leading-none">
                {!afford && <span title="Not enough yet: gatherers will fetch it">&#9203;</span>}
                <span className="inline-flex items-center gap-0.5 rounded-full bg-black/15 px-1 py-0.5" title={isAction ? "Action: no structure to own" : owned + " owned (finished)"} aria-label={isAction ? "Action: no owned count" : owned + " owned (finished)"}>
                  <Flag className="h-2.5 w-2.5" aria-hidden="true" />
                  {isAction ? "-" : owned}
                </span>
              </span>
              {["spikes", "barricade", "totem", "tannery"].includes(b.value) ? <GameIcon id={b.value} size={30} /> : <span className="text-[28px] leading-none">{stoneTower ? "🏰" : b.icon}</span>}
              <span className="mt-1 text-center text-[11px] font-semibold leading-tight">{stoneTower ? "Stone tower" : b.label}</span>
              <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                {(Object.entries(cost) as [Resource, number][]).map(([r, n]) => (
                  <span key={r} className={`flex items-center gap-0.5 rounded-full px-1 text-[10px] font-bold ${(stock[r] ?? 0) >= n ? "bg-white/10" : "bg-rose-500/30"}`}>
                    <GameIcon id={r} size={11} />
                    {n}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-white/70"><Flag className="h-3 w-3" aria-hidden="true" /> Owned (finished)</p>
      {cur ? (
        <p className="mt-2 px-1 text-center text-[12px] leading-snug text-white/75">
          <span className="font-bold text-white">
            {cur.icon} {cur.label}:
          </span>{" "}
          {cur.tip}
          {cur.line && !/drag/i.test(cur.tip) ? " Drag to draw." : ""}
        </p>
      ) : (
        <p className="mt-2 px-1 text-center text-[12px] leading-snug text-white/60">💡 Invent new things at camp to unlock more to build.</p>
      )}
    </div>
  );
}

function Options<V extends string>({ opts, value, onPick }: { opts: Opt<V>[]; value: V | null; onPick: (v: V) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className={`flex h-[72px] w-[clamp(62px,18vw,72px)] min-w-0 flex-col items-center justify-center rounded-2xl px-1 transition active:scale-90 ${o.value === value ? "dl-btn bg-amber-400/90 text-[#0f172a]" : "bg-white/5 hover:-translate-y-0.5 hover:bg-white/15"}`}
        >
          <span className="text-3xl leading-none">{o.icon}</span>
          <span className="mt-1 text-center text-[10px] font-semibold leading-tight text-white/85 sm:text-[11px]">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function SpeciesGrid({ value, unlocked, egg, onPick }: { value: SpeciesId | null; unlocked: SpeciesId[]; egg: boolean; onPick: (s: SpeciesId) => void }) {
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
            className={`relative flex w-[92px] flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 transition active:scale-95 ${s.id === value ? "dl-btn bg-amber-400/90 text-[#0f172a]" : "bg-white/5 hover:bg-white/15"}`}
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
