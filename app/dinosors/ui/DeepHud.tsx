"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpToLine, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Radar, X } from "lucide-react";
import { MINE_H, MINE_W } from "../data/mine";
import type { Engine, Snapshot } from "../game/engine";
import { GameIcon } from "./GameIcon";

/* ------------------------------------------------------------------ */
/*  The Deep HUD: a survey-console look (dark glass, cyan accents,     */
/*  monospace readouts). Depth gauge on the left, minimap + ore and   */
/*  hazard readouts on the right, lift + scanner along the bottom and */
/*  an inspector card for the selected cell.                          */
/* ------------------------------------------------------------------ */

const glass = "pointer-events-auto rounded-2xl border border-cyan-300/20 bg-slate-950/70 shadow-[0_0_30px_-10px_rgba(34,211,238,0.45)] backdrop-blur-md";
const label = "font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/60";
const BAND_TINT = ["#7a5636", "#6f6a63", "#8b8590", "#5f8fa6", "#b24a28"];

export default function DeepHud({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const d = snap.deep;
  // the survey panel starts open on big screens, tucked away on phones
  const [panel, setPanel] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);
  if (!d) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-white">
      {/* depth + band title */}
      <div className="absolute left-1/2 top-20 -translate-x-1/2 text-center sm:top-6">
        <div className={label}>{d.band}</div>
        <div className="font-mono text-2xl font-bold tabular-nums text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">{d.camFt} FT</div>
      </div>

      <DepthGauge snap={snap} engine={engine} />
      <CrewPanel snap={snap} engine={engine} />

      {/* right column */}
      <div className="absolute right-2 top-20 flex max-h-[calc(100%-200px)] flex-col items-end gap-2 sm:right-4 sm:top-24">
        <button type="button" onClick={() => setPanel((p) => !p)} className={`${glass} flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-cyan-100`}>
          <Radar className="h-3.5 w-3.5" /> Survey {panel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <AnimatePresence>
          {panel && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="dl-scroll flex max-h-full gap-2 overflow-y-auto">
              <div className={`${glass} w-[220px] space-y-3 p-3`}>
                <div>
                  <div className={label}>Charted</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" style={{ width: `${d.charted}%` }} />
                    </div>
                    <span className="font-mono text-[11px] text-cyan-100">{d.charted}%</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-white/60">
                    {d.dug} cells dug · deepest {d.deepestFt} ft
                  </div>
                </div>
                <div>
                  <div className={label}>Hazards</div>
                  <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[11px]">
                    <Hz icon="🌊" n={d.hazards.flooded} label="flooded" />
                    <Hz icon="💧" n={d.hazards.springs} label="springs" />
                    <Hz icon="☁️" n={d.hazards.gas} label="gas" />
                    <Hz icon="⚠️" n={d.hazards.caveIns} label="cave-ins" />
                  </div>
                  {d.hazards.knownTraps > 0 && <p className="mt-1 text-[10.5px] text-amber-200/80">◇ {d.hazards.knownTraps} spotted hazard{d.hazards.knownTraps === 1 ? "" : "s"} marked in the rock</p>}
                  <p className="mt-1 text-[10.5px] text-cyan-100/70">Lighting: {d.lighting.lanterns} miner lanterns · {d.lighting.lamps} fixed lamps</p>
                </div>
                <div>
                  <div className={label}>Minerals at camp</div>
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    {d.stock.map((s) => (
                      <span key={s.r} title={s.name} className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-mono text-[11px] ${s.n ? "bg-white/10" : "bg-white/[0.03] text-white/35"}`}>
                        <GameIcon id={s.r} size={12} />
                        {s.n}
                      </span>
                    ))}
                  </div>
                  {d.mined.length > 0 && (
                    <p className="mt-1.5 text-[10.5px] text-white/55">
                      From the Deep: {d.mined.map((m) => `${m.icon}${m.n}`).join("  ")}
                    </p>
                  )}
                </div>
                <div>
                  <div className={label}>Milestones</div>
                  <div className="mt-1 space-y-0.5 text-[11.5px]">
                    {d.milestones.map((m) => (
                      <div key={m.id} className={`flex items-center gap-1.5 ${m.got ? "text-amber-200" : "text-white/55"}`}>
                        <span>{m.got ? m.icon : "◇"}</span>
                        <span className="flex-1 truncate">{m.name}</span>
                        <span className="font-mono text-[10px]">{m.got ? "✓" : `${m.ft} ft`}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={label}>Landmarks</div>
                  <div className="mt-1 space-y-1 text-[11.5px]">
                    {d.landmarks.map((l) => (
                      <div key={l.kind} title={l.found ? l.name : "Something is down there… ping the scanner near it"}>
                        <div className={`flex items-center gap-1.5 ${l.done ? "text-emerald-200" : l.found ? "text-cyan-100" : "text-white/40"}`}>
                          <span>{l.found ? l.icon : "❔"}</span>
                          <span className="flex-1 truncate">{l.found ? l.name : "Unknown signal"}</span>
                          {l.done && <span className="text-[10px]">✓</span>}
                        </div>
                        {l.found && !l.done && (
                          <div className="ml-6 mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-cyan-300" style={{ width: `${l.progress * 100}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {d.critters > 0 && <p className="mt-1 text-[10.5px] text-rose-200">🦎 {d.critters} troglodon{d.critters === 1 ? "" : "s"} in the dark — lamps keep them away</p>}
                </div>
                <div>
                  <div className={label}>Field discoveries</div>
                  <div className="mt-1 max-h-36 space-y-1 overflow-y-auto">
                    {d.discoveries.length ? d.discoveries.map((find, i) => <div key={`${find.cell}-${i}`} className="rounded-lg border border-amber-200/15 bg-amber-100/5 px-2 py-1.5">
                      <div className="text-[11px] font-semibold text-amber-100">{find.kind === "fossil" ? "🦴" : find.kind === "nugget" ? "✦" : find.kind === "artifact" ? "🏺" : "◇"} {find.name}</div>
                      <div className="text-[10px] leading-snug text-white/55">{find.detail}</div>
                    </div>) : <p className="text-[10.5px] text-white/45">Rare fossils and precious finds will be recorded here.</p>}
                  </div>
                </div>
                <div>
                  <div className={label}>Settlement</div>
                  {d.settlement.length ? (
                    <div className="mt-1 space-y-0.5 text-[11.5px]">
                      {d.settlement.map((s) => (
                        <div key={s.kind} className="flex items-center gap-1.5">
                          <span>{s.icon}</span>
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="font-mono text-cyan-100">{s.built}</span>
                          {s.planned > 0 && <span className="font-mono text-[10px] text-amber-200">+{s.planned}</span>}
                        </div>
                      ))}
                      {d.room > 0 && <p className="text-[10.5px] text-emerald-200">🏠 Room for {d.room} more people in the tribe</p>}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10.5px] text-white/45">Dig out some space, then 🏗️ Build homes, a vault, farms and lamps down here.</p>
                  )}
                </div>
                <div>
                  <div className={label}>Tools</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.tools.map((t) => (
                      <span key={t.id} title={`${t.name}${t.on ? "" : " (not yet)"}`} className={`rounded-lg px-1.5 py-0.5 text-[13px] ${t.on ? "bg-cyan-400/15 ring-1 ring-cyan-300/40" : "bg-white/[0.03] opacity-35 grayscale"}`}>
                        {t.icon}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <Minimap engine={engine} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* selected cell */}
      <AnimatePresence>{d.sel && <CellCard snap={snap} engine={engine} />}</AnimatePresence>

      <AnimatePresence>{d.mode === "build" && <BuildPalette snap={snap} engine={engine} />}</AnimatePresence>

      {/* bottom console */}
      <div className="absolute inset-x-2 bottom-3 flex flex-wrap items-end justify-center gap-2 sm:bottom-5">
        <button type="button" onClick={() => engine.leaveDeep()} className={`${glass} flex items-center gap-2 px-4 py-3 text-sm font-bold text-cyan-50 transition hover:bg-slate-900/80 active:scale-95`}>
          <ArrowUpToLine className="h-4 w-4" /> Surface
        </button>
        <div className={`${glass} flex items-center gap-3 px-4 py-2.5`}>
          <span className="text-2xl">🛗</span>
          <div>
            <div className={label}>Lift</div>
            <div className="font-mono text-[13px] font-bold tabular-nums text-cyan-50">
              {d.liftFt} / {d.liftMaxFt} ft
            </div>
          </div>
          <button type="button" onClick={() => engine.deepCallLift(Math.round(engine.deep.cam.y / 32))} className="rounded-xl bg-white/10 px-2.5 py-1.5 text-[12px] font-bold hover:bg-white/20 active:scale-95">
            Call here
          </button>
          <button
            type="button"
            onClick={() => engine.deepUpgradeLift()}
            disabled={!d.canUpgrade}
            title="Extend the lift ~60 ft deeper"
            className="flex items-center gap-1.5 rounded-xl bg-cyan-500/80 px-2.5 py-1.5 text-[12px] font-bold text-slate-950 hover:bg-cyan-400 active:scale-95 disabled:bg-white/10 disabled:text-white/50"
          >
            +60 ft
            <span className="flex gap-0.5">
              {Object.entries(d.upgradeCost).map(([r, n]) => (
                <span key={r} className={`flex items-center gap-0.5 rounded-full px-1 text-[10px] ${(snap.camp.stock[r] ?? 0) >= (n ?? 0) ? "bg-black/20" : "bg-rose-500/50 text-white"}`}>
                  <GameIcon id={r} size={10} />
                  {n}
                </span>
              ))}
            </span>
          </button>
        </div>
        <ModeBar snap={snap} engine={engine} />
        <button
          type="button"
          onClick={() => engine.deepPing()}
          disabled={d.pingReady > 0}
          className={`${glass} relative flex items-center gap-2 px-4 py-3 text-sm font-bold text-cyan-50 transition hover:bg-slate-900/80 active:scale-95 disabled:opacity-60`}
          title="Sonar ping: maps the rock (not what's in it) around the selected spot"
        >
          <Radar className={`h-4 w-4 ${d.pingReady ? "" : "animate-pulse text-cyan-300"}`} />
          {d.pingReady ? `Scanner ${d.pingReady}s` : "Ping scanner"}
        </button>
      </div>
    </div>
  );
}

/** Start the mine over (two taps so it never happens by accident). */
function ResetMine({ engine }: { engine: Engine }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const id = window.setTimeout(() => setSure(false), 5000);
    return () => window.clearTimeout(id);
  }, [sure]);
  return (
    <button
      type="button"
      onClick={() => {
        if (!sure) return setSure(true);
        setSure(false);
        engine.deepReset();
      }}
      className={`mt-2 w-full rounded-xl py-1.5 text-[11.5px] font-bold transition active:scale-95 ${sure ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
      title="New rock, caves + mineral veins. Keeps your rooms, the lift and everything already hauled up."
    >
      {sure ? "Tap again: reset the whole mine?" : "♻️ Reset mine (new minerals)"}
    </button>
  );
}

const OrderBtn = ({ on, onClick, label: l }: { on: boolean; onClick: () => void; label: string }) => (
  <button type="button" onClick={onClick} className={`rounded-xl px-2.5 py-1.5 text-[12px] font-bold transition active:scale-95 ${on ? "bg-cyan-400 text-slate-950" : "bg-white/10 hover:bg-white/20"}`}>
    {on ? "✓ " : ""}
    {l}
  </button>
);

const MODES: { id: "look" | "dig" | "support" | "blast" | "pump" | "clear" | "build"; icon: string; label: string; tip: string }[] = [
  { id: "look", icon: "👁️", label: "Look", tip: "Tap cells to inspect them; drag to move" },
  { id: "dig", icon: "⛏️", label: "Dig", tip: "Tap or drag across rock to mark it for digging" },
  { id: "support", icon: "🪵", label: "Prop", tip: "Mark open tunnel for a support beam (stops cave-ins, 1 wood)" },
  { id: "blast", icon: "🧨", label: "Blast", tip: "Mark a spot for dynamite (tar + a stick; clears 3×3)" },
  { id: "pump", icon: "💧", label: "Pump", tip: "Mark flooded tunnel to pump out" },
  { id: "clear", icon: "✖️", label: "Clear", tip: "Remove marks" },
  { id: "build", icon: "🏗️", label: "Build", tip: "Build homes, a vault, farms, lamps + a mess hall in dug-out space" },
];

/** Order painting modes. In any mode but Look, one finger paints and two fingers move. */
function ModeBar({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const d = snap.deep!;
  return (
    <div className={`${glass} flex items-center gap-0.5 p-1`}>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          title={m.tip}
          onClick={() => (m.id === "build" ? engine.deepBuild(d.buildKind as "home") : engine.deepMode(m.id))}
          className={`flex min-w-[44px] flex-col items-center rounded-xl px-1.5 py-1 text-[10px] font-bold transition active:scale-95 ${d.mode === m.id ? "bg-cyan-400 text-slate-950" : "text-cyan-50 hover:bg-white/10"}`}
        >
          <span className="text-base leading-none">{m.icon}</span>
          {m.label}
          {m.id !== "look" && m.id !== "clear" && m.id !== "build" && d.orders[m.id] ? <span className="font-mono text-[9px] opacity-80">{d.orders[m.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Who's down here, what they're doing, and the send / recall buttons. */
function CrewPanel({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const d = snap.deep!;
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);
  return (
    <div className="absolute left-16 top-36 w-[230px] sm:left-20 sm:top-28">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${glass} flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-bold text-cyan-100`}>
        <span>⛏️ Crew {d.crew.length}{d.pending ? ` (+${d.pending} on the way)` : ""}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={`${glass} mt-1.5 p-2.5`}>
            {d.crew.length === 0 && <p className="text-[11.5px] text-white/60">Nobody is down here. Send a few grown-ups: they walk to the cave and ride the lift.</p>}
            <div className="dl-scroll max-h-[34vh] space-y-1.5 overflow-y-auto">
              {d.crew.map((m) => (
                <button type="button" key={m.id} onClick={(e) => engine.deep.selectMiner(m.id, e.shiftKey)} title="Select miner, then click a rock face. Shift-click to select several." className={`w-full rounded-xl px-2 py-1.5 text-left ${d.selectedMiners.includes(m.id) ? "bg-cyan-400/20 ring-1 ring-cyan-300" : "bg-white/[0.04]"}`}>
                  <div className="flex items-center gap-1.5 text-[12px] font-bold">
                    <span>{m.icon}</span>
                    <span className="flex-1 truncate">{m.name}</span>
                    <span className="font-mono text-[10px] text-white/55">
                      {m.load}/{m.cap}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${m.hp < 0.35 ? "bg-rose-400" : m.hp < 0.7 ? "bg-amber-300" : "bg-emerald-400"}`} style={{ width: `${m.hp * 100}%` }} />
                    </div>
                    <span className="truncate text-[10px] text-white/55">{m.activity}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-cyan-200/65">{m.skill}</div>
                  {m.carry && <div className="mt-0.5 text-[10px] text-white/60">{m.carry}</div>}
                </button>
              ))}
            </div>
            {d.selectedMiners.length > 0 && <div className="mt-2 flex items-start gap-2 text-[10.5px] text-cyan-100">
              <span className="flex-1">{d.selectedMiners.length} selected · click a rock face to send them. Shift-click crew to add miners.</span>
              <button type="button" onClick={() => engine.deep.selectMiner(0)} className="rounded bg-white/10 px-1.5 py-0.5 text-white/70 hover:bg-white/20">Clear</button>
            </div>}
            <div className="mt-2 grid grid-cols-3 gap-1">
              <button type="button" disabled={!d.canSend} onClick={() => engine.deepSend(1)} className="rounded-xl bg-cyan-500/80 py-1.5 text-[11.5px] font-bold text-slate-950 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-white/40">
                +1
              </button>
              <button type="button" disabled={!d.canSend} onClick={() => engine.deepSend(3)} className="rounded-xl bg-cyan-500/80 py-1.5 text-[11.5px] font-bold text-slate-950 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-white/40">
                +3
              </button>
              <button type="button" disabled={!d.crew.length && !d.pending} onClick={() => engine.deepRecall()} className="rounded-xl bg-white/10 py-1.5 text-[11.5px] font-bold hover:bg-white/20 disabled:opacity-40">
                Recall
              </button>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-white/75">
              <input type="checkbox" checked={d.autoMine} onChange={() => engine.deepToggleAuto()} className="accent-cyan-400" />
              Dig out ore they spot by themselves
            </label>
            <p className={`mt-1 text-[10.5px] ${d.food < d.crew.length * 2 ? "text-amber-200" : "text-white/45"}`}>🍖 Food at camp: {d.food} (miners eat from it)</p>
            {d.hauled.length > 0 && <p className="mt-1 text-[10.5px] text-white/55">Lifted up so far: {d.hauled.map((x) => `${x.icon}${x.n}`).join(" ")}</p>}
            <ResetMine engine={engine} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The rooms you can build, with their size and cost. Pick one, then tap open tunnel. */
function BuildPalette({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const d = snap.deep!;
  const cur = d.palette.find((p) => p.kind === d.buildKind);
  const listRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: false, right: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => setScroll({
      left: list.scrollLeft > 1,
      right: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
    });
    const wheel = (event: WheelEvent) => {
      if (list.scrollWidth <= list.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      list.scrollLeft += event.deltaMode === 1 ? event.deltaY * 30 : event.deltaY;
    };
    const resize = new ResizeObserver(update);
    resize.observe(list);
    update();
    list.addEventListener("wheel", wheel, { passive: false });
    return () => {
      resize.disconnect();
      list.removeEventListener("wheel", wheel);
    };
  }, []);

  const move = (direction: -1 | 1) => {
    const list = listRef.current;
    if (list) list.scrollBy({ left: direction * Math.max(116, list.clientWidth * 0.7), behavior: "smooth" });
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute inset-x-2 bottom-[150px] flex justify-center sm:bottom-24">
      <div className={`${glass} w-full max-w-[640px] p-2.5`}>
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <span className={label}>Build underground</span>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[10px] text-white/50">Scroll for more</span>
            <button type="button" aria-label="Previous buildings" disabled={!scroll.left} onClick={() => move(-1)} className="rounded-lg bg-white/10 p-1 text-cyan-100 hover:bg-white/20 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next buildings" disabled={!scroll.right} onClick={() => move(1)} className="rounded-lg bg-white/10 p-1 text-cyan-100 hover:bg-white/20 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div ref={listRef} onScroll={() => {
          const list = listRef.current;
          if (list) setScroll({ left: list.scrollLeft > 1, right: list.scrollLeft + list.clientWidth < list.scrollWidth - 1 });
        }} className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x" role="group" aria-label="Underground buildings">
          {d.palette.map((p) => (
            <button
              key={p.kind}
              type="button"
              title={p.tip}
              onClick={() => engine.deepBuild(p.kind as "home")}
              className={`flex min-w-[108px] shrink-0 flex-col items-center rounded-xl px-2 py-1.5 transition active:scale-95 ${d.buildKind === p.kind ? "bg-cyan-400/25 ring-2 ring-cyan-300" : "bg-white/5 hover:bg-white/10"}`}
            >
              <span className="text-2xl leading-none">{p.icon}</span>
              <span className="mt-0.5 text-[11px] font-bold leading-tight">{p.name}</span>
              <span className="font-mono text-[9.5px] text-white/50">
                {p.w}×{p.h} cells
              </span>
              <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                {Object.entries(p.cost).map(([r, n]) => (
                  <span key={r} className={`flex items-center gap-0.5 rounded-full px-1 text-[10px] font-bold ${(snap.camp.stock[r] ?? 0) >= (n ?? 0) ? "bg-white/10" : "bg-rose-500/40"}`}>
                    <GameIcon id={r} size={10} />
                    {n}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
        {cur && (
          <p className="mt-1.5 px-1 text-center text-[11.5px] text-white/70">
            <b className="text-cyan-100">{cur.icon} {cur.name}:</b> {cur.tip} <span className="text-white/45">Tap open, dug-out space to place it (green = fits).</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

const Hz = ({ icon, n, label: l }: { icon: string; n: number; label: string }) => (
  <span className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 ${n ? "bg-amber-500/15 text-amber-100" : "bg-white/[0.03] text-white/40"}`}>
    {icon} {n} <span className="truncate text-[10px] opacity-70">{l}</span>
  </span>
);

/** Vertical depth gauge: bands, the view, the lift's reach and the deepest dig. Tap to jump. */
function DepthGauge({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const d = snap.deep!;
  const pct = (ft: number) => `${Math.min(100, (ft / (MINE_H * 6)) * 100)}%`;
  return (
    <div className="absolute bottom-28 left-2 top-36 w-12 sm:left-4 sm:top-28">
      <button
        type="button"
        aria-label="Depth gauge: tap to jump"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          engine.deepFocus(null, ((e.clientY - r.top) / r.height) * MINE_H);
        }}
        className={`${glass} relative h-full w-5 overflow-hidden !rounded-full p-0`}
      >
        {d.bands.map((b, i) => {
          const to = d.bands[i + 1]?.from ?? MINE_H;
          return <span key={b.name} title={b.name} className="absolute inset-x-0 opacity-70" style={{ top: `${(b.from / MINE_H) * 100}%`, height: `${((to - b.from) / MINE_H) * 100}%`, background: BAND_TINT[i] }} />;
        })}
        <span className="absolute inset-x-0 bg-cyan-300/25" style={{ top: 0, height: pct(d.liftMaxFt) }} />
        <span className="absolute inset-x-0 h-0.5 bg-amber-300" style={{ top: pct(d.deepestFt) }} />
      </button>
      {/* you-are-here */}
      <span className="pointer-events-none absolute left-5 -translate-y-1/2 font-mono text-[10px] font-bold text-cyan-100" style={{ top: pct(d.camFt) }}>
        ◀ {d.camFt}
      </span>
      <span className="pointer-events-none absolute left-5 -translate-y-1/2 font-mono text-[9px] text-white/60" style={{ top: pct(d.liftMaxFt) }}>
        🛗
      </span>
    </div>
  );
}

function Minimap({ engine }: { engine: Engine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => ref.current && engine.drawDeepMinimap(ref.current);
    draw();
    const id = window.setInterval(draw, 350);
    return () => window.clearInterval(id);
  }, [engine]);
  return (
    <div className={`${glass} hidden flex-col items-center p-2 sm:flex`}>
      <div className={label}>Map</div>
      <canvas
        ref={ref}
        width={MINE_W}
        height={MINE_H}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          engine.deepFocus(((e.clientX - r.left) / r.width) * MINE_W, ((e.clientY - r.top) / r.height) * MINE_H);
        }}
        className="mt-1 h-[340px] w-[82px] cursor-crosshair rounded-md ring-1 ring-cyan-300/20"
        style={{ imageRendering: "pixelated" }}
        aria-label="Mine minimap: tap to jump"
      />
    </div>
  );
}

function CellCard({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const c = snap.deep!.sel!;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[178px] flex justify-center px-14 sm:bottom-28">
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className={`${glass} relative w-full max-w-[340px] p-3`}
    >
      <button type="button" aria-label="Close" onClick={() => engine.deepClearSelection()} className="absolute right-2 top-2 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white">
        <X className="h-4 w-4" />
      </button>
      <div className={label}>
        Cell {c.x},{c.y} · {c.band}
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-lg font-bold">{c.material}</span>
        <span className="font-mono text-[12px] text-cyan-200">{c.depthFt} ft</span>
      </div>
      <div className="mt-2 space-y-1 text-[12.5px]">
        {c.state === "uncharted" && <p className="text-white/65">Uncharted rock. Ping the scanner nearby, or dig toward it with a lantern to see what&apos;s here.</p>}
        {c.state === "rock" &&
          (c.content ? (
            <p className={c.content.hazard ? "text-amber-200" : "text-cyan-100"}>
              {c.content.icon} {c.content.hazard ? "Hazard: " : "Contains: "}
              <b>{c.content.name}</b>
            </p>
          ) : (
            <p className="text-white/60">Contents unknown — a lantern spots ore in rock next to a fresh dig.</p>
          ))}
        {c.state === "rock" && (c.digTime !== null ? <p className="font-mono text-[11.5px] text-white/70">⛏️ ~{c.digTime}s to dig with today&apos;s tools</p> : c.why && <p className="text-[11.5px] text-white/60">🔒 {c.why}</p>)}
        {c.building ? (
          <div className="rounded-xl bg-white/[0.05] p-2">
            <p className="font-bold">
              {c.building.icon} {c.building.name}
            </p>
            <p className="text-[11.5px] text-white/70">{c.building.built >= 1 ? c.building.tip : c.building.have ? `Being built… ${Math.round(c.building.built * 100)}%` : "Waiting for a miner to fetch the supplies from the lift."}</p>
            {c.building.kind === "mushroom" && c.building.built >= 1 && <p className="mt-1 font-mono text-[11px] text-emerald-200">Next harvest {Math.round(c.building.grow * 100)}%</p>}
            <button type="button" onClick={() => engine.deepDemolish(c.building!.id)} className="mt-1.5 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold hover:bg-rose-500/40">
              {c.building.built >= 1 ? "Take down (½ back)" : "Cancel"}
            </button>
          </div>
        ) : (
          c.state === "open" && <p className="text-white/65">Open tunnel.{c.support ? " A support beam holds the roof." : ""}</p>
        )}
        {c.state === "shaft" && <p className="text-white/65">The lift shaft.</p>}
        {c.water > 0.05 && <p className="text-sky-200">🌊 Water {Math.round(c.water * 100)}%{c.water > 0.55 ? " — flooded" : ""}</p>}
        {c.gas && <p className="text-lime-200">☁️ Gas in the air — no flames here!</p>}
        {c.heat > 0 && <p className="text-orange-200">🔥 Hot: hurts anyone who stays</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {c.state === "rock" || c.state === "uncharted" ? (
          <>
            <OrderBtn on={c.order === "dig"} onClick={() => engine.deepOrder(c.order === "dig" ? null : "dig")} label="⛏️ Dig" />
            <OrderBtn on={c.order === "blast"} onClick={() => engine.deepOrder(c.order === "blast" ? null : "blast")} label="🧨 Blast" />
          </>
        ) : c.state === "open" && !c.building ? (
          <>
            {!c.support && <OrderBtn on={c.order === "support"} onClick={() => engine.deepOrder(c.order === "support" ? null : "support")} label="🪵 Prop up (1 wood)" />}
            {c.water > 0.05 && <OrderBtn on={c.order === "pump"} onClick={() => engine.deepOrder(c.order === "pump" ? null : "pump")} label="💧 Pump" />}
            <OrderBtn on={c.order === "blast"} onClick={() => engine.deepOrder(c.order === "blast" ? null : "blast")} label="🧨 Blast here" />
          </>
        ) : null}
      </div>
      {snap.deep!.crew.length === 0 && <p className="mt-2 text-[10.5px] text-amber-200/70">No miners down here yet: send some from the Crew panel.</p>}
    </motion.div>
    </div>
  );
}
