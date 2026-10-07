"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { CIV_ORDER, CIV_TECH, EXPERIMENT_MATS, FREQ_MAX, FREQ_MIN, PATH_INFO, PYRAMID_STAGES, SHIELD_HOLD, type CivPath, type CivTechId } from "../data/civ";
import { RES_INFO, type Cost } from "../data/colony";
import type { Engine, Snapshot } from "../game/engine";
import type { ExperimentResult } from "../sim/civ";
import type { Resource } from "../sim/types";
import { GameIcon } from "./GameIcon";

/* ------------------------------------------------------------------ */
/*  Civilization HQ. Before the choice: where the humming chamber is.  */
/*  After: research tree, energy grid (Resonance), the tuning lab and  */
/*  big projects (monuments, survival projects, the end of an age).    */
/* ------------------------------------------------------------------ */

type Tab = "research" | "energy" | "lab" | "projects";

const Chip = ({ r, n, ok }: { r: string; n: number; ok: boolean }) => (
  <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${ok ? "bg-white/10" : "bg-rose-500/30"}`}>
    <GameIcon id={r} size={12} />
    {n}
  </span>
);

function Costs({ cost, stock, paid = false }: { cost: Cost; stock: Record<string, number>; paid?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {(Object.entries(cost) as [Resource, number][]).map(([r, n]) => (
        <Chip key={r} r={r} n={n} ok={paid || (stock[r] ?? 0) >= n} />
      ))}
    </span>
  );
}

export default function CivPanel({ snap, engine, onClose, onChoose, onExtinction }: { snap: Snapshot; engine: Engine; onClose: () => void; onChoose: () => void; onExtinction: () => void }) {
  const civ = snap.civ;
  const [tab, setTab] = useState<Tab>("research");
  const res = civ.path === "resonance";
  const tabs = ([["research", "📜", "Research"], ...(res || civ.grid.length ? [["energy", "⚡", "Energy"]] : []), ...(res ? [["lab", "🔔", "Lab"]] : []), ["projects", "🔺", "Projects"]] as [Tab, string, string][]);
  useEffect(() => {
    if (!tabs.some(([k]) => k === tab)) setTab("research");
  }, [tabs, tab]);
  const info = civ.path !== "none" ? PATH_INFO[civ.path] : null;
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="dl-glass dl-scroll pointer-events-auto absolute inset-x-2 bottom-[84px] z-20 max-h-[60vh] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:max-h-[calc(100vh-200px)] sm:w-[400px]"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <X className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 pr-8">
        <span className="text-3xl">{info ? info.icon : "🏛️"}</span>
        <div>
          <h2 className="text-xl font-bold leading-tight">{info ? info.name : "Civilization"}</h2>
          <p className="text-xs text-white/60">{info ? `${civ.done.length} ideas learned${civ.crossOpen ? " · can borrow from the other path" : ""}` : "How will your people grow?"}</p>
        </div>
      </div>

      {civ.path === "none" ? (
        <Before snap={snap} engine={engine} onChoose={onChoose} />
      ) : (
        <>
          <div className={`mt-3 grid gap-1 rounded-2xl bg-white/5 p-1 text-[11.5px] font-bold`} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(([k, icon, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-xl py-1.5 transition active:scale-95 ${tab === k ? "bg-cyan-400 text-slate-900" : "hover:bg-white/10"}`}>
                {icon} {label}
              </button>
            ))}
          </div>
          {tab === "research" && <Research snap={snap} engine={engine} />}
          {tab === "energy" && <Energy snap={snap} />}
          {tab === "lab" && <Lab snap={snap} engine={engine} />}
          {tab === "projects" && <Projects snap={snap} engine={engine} onExtinction={onExtinction} />}
        </>
      )}
    </motion.aside>
  );
}

/* ------------------------------ before the choice ------------------------------ */

function Before({ snap, engine, onChoose }: { snap: Snapshot; engine: Engine; onChoose: () => void }) {
  const civ = snap.civ;
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="rounded-2xl bg-white/5 p-3">
        {!civ.chamber && (
          <>
            <p className="font-bold">🎵 Something is sleeping in the rocks…</p>
            <p className="mt-1 text-white/70">Once the tribe is settled (6 inventions and at least 3 grown-ups), a strange humming chamber will surface somewhere near camp.</p>
            <p className="mt-2 text-xs text-white/50">Inventions: {snap.camp.learned.length}/6 · grown-ups: {snap.tribe.people.filter((p) => !p.child).length}/3</p>
          </>
        )}
        {civ.chamber && !civ.found && (
          <>
            <p className="font-bold">🎵 A humming chamber has surfaced!</p>
            <p className="mt-1 text-white/70">Someone needs to walk over and look inside.</p>
          </>
        )}
        {civ.found && (
          <>
            <p className="font-bold">💠 The chamber is open</p>
            <p className="mt-1 text-white/70">Crystals, a meteor shard, and strange shaped stones. Your people must decide what it means.</p>
          </>
        )}
      </div>
      {civ.found ? (
        <button type="button" onClick={onChoose} className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-cyan-500 py-3 text-base font-bold shadow-lg transition hover:brightness-110 active:scale-[0.98]">
          Choose your path…
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMsg(engine.goToChamber())}
          className="w-full rounded-2xl bg-white/10 py-2.5 font-bold transition hover:bg-white/20 active:scale-[0.98] disabled:opacity-40"
          disabled={!civ.chamber && !civ.ripe}
        >
          {civ.chamber ? "🔭 Go to the chamber" : "🔒 Not yet"}
        </button>
      )}
      {msg && <p className="text-center text-xs text-amber-200">{msg}</p>}
    </div>
  );
}

/* ------------------------------ research ------------------------------ */

function Research({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const civ = snap.civ;
  const stock = snap.camp.stock;
  const cur = civ.current;
  const own = civ.path === "none" ? [] : CIV_ORDER[civ.path];
  const opts = civ.options.filter((o) => !o.cross);
  const cross = civ.options.filter((o) => o.cross);
  return (
    <div className="mt-3 space-y-3">
      {cur ? (
        <div className="rounded-2xl bg-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">
              {CIV_TECH[cur.id].icon} {CIV_TECH[cur.id].name}
            </span>
            <span className="text-xs text-white/60">
              {Math.floor(cur.rp)}/{cur.need}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width] duration-300" style={{ width: `${Math.min(100, (cur.rp / cur.need) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-white/70">{CIV_TECH[cur.id].what}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <Costs cost={cur.cost} stock={stock} paid={cur.paid} />
            <span className="text-white/55">{cur.paid ? "✓ materials in" : cur.missing ? `gatherers are fetching ${RES_INFO[cur.missing as Resource]?.name.toLowerCase() ?? cur.missing}` : "ready"}</span>
          </div>
          <p className="mt-2 text-[11px] text-white/50">
            📜 {civ.jobs.researcher || "No"} researcher{civ.jobs.researcher === 1 ? "" : "s"} on it
            {civ.path === "resonance" && !snap.civ.canExperiment && cur.id !== "resonance" ? " · build a 🔔 Resonance table: research there is 4× faster" : ""}. Set jobs in the tribe panel (or leave them on Auto).
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-white/5 p-3 text-sm text-white/70">Pick something to research below.</p>
      )}

      <div>
        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-white/50">The {civ.path === "resonance" ? "Resonance" : "Old Ways"}</h3>
        <div className="space-y-1.5">
          {own.map((id) => {
            const def = CIV_TECH[id];
            const done = civ.done.includes(id);
            const opt = opts.find((o) => o.id === id);
            const active = cur?.id === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!opt || active}
                onClick={() => engine.setCivResearch(id)}
                className={`flex w-full items-start gap-2 rounded-2xl px-3 py-2 text-left transition ${active ? "bg-cyan-500/25 ring-1 ring-cyan-300" : done ? "bg-emerald-500/15" : opt ? "bg-white/5 hover:bg-white/15" : "bg-white/[0.03] opacity-50"}`}
              >
                <span className="text-xl leading-none">{def.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[13px] font-bold">
                    {def.name}
                    <span className="shrink-0 text-[11px] font-semibold text-white/55">{done ? "✓" : active ? "studying" : opt ? `${def.rp} pts` : "🔒"}</span>
                  </span>
                  <span className="block text-[11.5px] leading-snug text-white/65">{def.what}</span>
                  {!done && opt && (
                    <span className="mt-1 block">
                      <Costs cost={opt.cost} stock={stock} />
                    </span>
                  )}
                  {!done && !opt && <span className="mt-0.5 block text-[10.5px] text-white/45">After: {def.after.map((a) => CIV_TECH[a].name).join(" + ")}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Borrow from the other path</h3>
        {civ.crossOpen ? (
          cross.length ? (
            <div className="mt-2 space-y-1.5">
              {cross.map((o) => (
                <button key={o.id} type="button" disabled={cur?.id === o.id} onClick={() => engine.setCivResearch(o.id)} className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-white/15">
                  <span>{CIV_TECH[o.id].icon}</span>
                  <span className="flex-1 font-semibold">{CIV_TECH[o.id].name}</span>
                  <Costs cost={o.cost} stock={stock} />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-white/60">Nothing left to borrow right now.</p>
          )
        ) : (
          <p className="mt-1 text-xs text-white/60">Learn 6 of your own path&apos;s ideas and a few of the other path&apos;s ideas open up (at double cost).</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ energy ------------------------------ */

function Energy({ snap }: { snap: Snapshot }) {
  const civ = snap.civ;
  const k = civ.cap > 0 ? civ.energy / civ.cap : 0;
  const net = civ.gen - civ.use;
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="rounded-2xl bg-white/10 p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-bold">⚡ Resonance energy</span>
          <span className="text-xs text-white/65">
            {Math.floor(civ.energy)} / {Math.floor(civ.cap)}
          </span>
        </div>
        <div className="relative mt-2 h-4 overflow-hidden rounded-full bg-slate-900/60 ring-1 ring-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-300 to-white transition-[width] duration-300" style={{ width: `${Math.min(100, k * 100)}%`, boxShadow: "0 0 12px rgba(120,220,255,0.7)" }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
          <span className="rounded-xl bg-white/5 py-1">
            <b className="block text-[13px] text-emerald-300">+{civ.gen.toFixed(1)}/s</b>made
          </span>
          <span className="rounded-xl bg-white/5 py-1">
            <b className="block text-[13px] text-rose-300">−{civ.use.toFixed(1)}/s</b>used
          </span>
          <span className="rounded-xl bg-white/5 py-1">
            <b className={`block text-[13px] ${net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{net >= 0 ? "+" : ""}{net.toFixed(1)}/s</b>net
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
          <span>Strain</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${civ.strain > 0.6 ? "bg-rose-400" : civ.strain > 0.3 ? "bg-amber-300" : "bg-emerald-400"}`} style={{ width: `${civ.strain * 100}%` }} />
          </div>
          <span>{civ.jobs.technician ? `⚡ ${civ.jobs.technician} technician` : "no technician"}</span>
        </div>
        {snap.weather === "storm" && <p className="mt-2 text-[11px] text-cyan-200">⛈️ The storm is charging the crystals: +60% energy!</p>}
      </div>
      <div>
        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-white/50">The grid</h3>
        {civ.grid.length ? (
          <div className="grid grid-cols-2 gap-1.5">
            {civ.grid.map((g) => (
              <div key={g.kind} className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-[12px]">
                <span className="text-lg">{g.icon}</span>
                <span className="flex-1 leading-tight">
                  <b>{g.n}× </b>
                  {g.name}
                  {g.gen > 0 && <span className="block text-[10.5px] text-emerald-300">+{g.gen.toFixed(1)}/s</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/60">No energy buildings yet. Research Copper resonance for the Energy tower.</p>
        )}
      </div>
      <div className="rounded-2xl bg-white/5 p-3 text-[12px]">
        <p>
          💧 Water pulled from the air: <b>{civ.condensed.toFixed(1)}</b> · in the jars: <b>{Math.floor(snap.camp.stock.water ?? 0)}</b>
        </p>
        <p className="mt-1 text-white/55">Condensers work best in rain and fog. Beam towers spend energy per shot; pylon barriers drain it while they push. Too full for too long and things can overload — technicians help.</p>
      </div>
      <p className="text-center text-[10.5px] text-white/40">The Resonance is make-believe fantasy tech for this game, not real science.</p>
    </div>
  );
}

/* ------------------------------ the tuning lab ------------------------------ */

function Lab({ snap, engine }: { snap: Snapshot; engine: Engine }) {
  const civ = snap.civ;
  const stock = snap.camp.stock;
  const [mat, setMat] = useState<Resource>("stone");
  const [freq, setFreq] = useState(440);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [log, setLog] = useState<Record<string, { f: number; r: ExperimentResult["result"]; close: number }[]>>({});
  const [ring, setRing] = useState(0);
  const m = EXPERIMENT_MATS.find((x) => x.r === mat)!;
  const tuned = civ.tuned.includes(mat);
  const strike = () => {
    const r = engine.civExperiment(mat, freq);
    setResult(r);
    if (r.result !== "locked") {
      setRing((n) => n + 1);
      setLog((l) => ({ ...l, [mat]: [{ f: freq, r: r.result, close: r.close }, ...(l[mat] ?? [])].slice(0, 6) }));
    }
  };
  const nudge = (d: number) => setFreq((f) => Math.max(FREQ_MIN, Math.min(FREQ_MAX, f + d)));
  if (!civ.canExperiment)
    return (
      <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-white/70">
        <p className="font-bold text-white">🔔 Build a Resonance table</p>
        <p className="mt-1">Find it in Build → Wonders. Then come back here to ring stone, copper, quartz, magnetite, crystal and meteor fragments at different notes. Each one has a hidden true note — find it and the whole settlement gets a bonus.</p>
      </div>
    );
  const color = result?.result === "resonant" ? "#7ef0ff" : result?.result === "warm" ? "#ffd27a" : result?.result === "fracture" || result?.result === "spark" ? "#ff7a7a" : "#9aa7b8";
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="grid grid-cols-3 gap-1.5">
        {EXPERIMENT_MATS.map((x) => (
          <button
            key={x.r}
            type="button"
            onClick={() => {
              setMat(x.r);
              setResult(null);
              if (civ.notes[x.r]) setFreq(civ.notes[x.r]);
            }}
            className={`relative flex flex-col items-center rounded-2xl px-1 py-2 text-[11px] font-semibold transition active:scale-95 ${mat === x.r ? "bg-white/25 ring-2 ring-cyan-300" : "bg-white/5 hover:bg-white/15"}`}
          >
            <span className="text-xl">{x.icon}</span>
            {x.name}
            <span className="text-[10px] text-white/55">×{Math.floor(stock[x.r] ?? 0)}</span>
            {civ.tuned.includes(x.r) && <span className="absolute right-1 top-1 text-[11px]">🎶</span>}
          </button>
        ))}
      </div>

      {/* the resonance plate */}
      <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-3xl bg-slate-950/60 ring-1 ring-white/10">
        <AnimatePresence>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={`${ring}-${i}`}
              className="absolute rounded-full border-2"
              style={{ borderColor: color }}
              initial={{ width: 30, height: 14, opacity: 0.9 }}
              animate={{ width: 80 + (result?.close ?? 0.2) * 240 + i * 40, height: 30 + (result?.close ?? 0.2) * 80 + i * 16, opacity: 0 }}
              transition={{ duration: 1.4 + i * 0.25, delay: i * 0.12, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>
        <motion.span key={`stone-${ring}`} animate={result && result.result !== "locked" ? { x: [0, -2, 2, -1, 1, 0], y: result.result === "resonant" ? [0, -10, -6, -10, 0] : 0 } : {}} transition={{ duration: 0.6 }} className="relative text-5xl drop-shadow-[0_0_16px_rgba(120,220,255,0.5)]">
          {m.icon}
        </motion.span>
        <span className="absolute bottom-2 left-3 text-[11px] font-bold tabular-nums text-white/60">{freq} Hz</span>
        {tuned && <span className="absolute right-3 top-2 text-[11px] font-bold text-cyan-200">true note: {civ.notes[mat]} Hz</span>}
      </div>

      <div>
        <input type="range" min={FREQ_MIN} max={FREQ_MAX} value={freq} onChange={(e) => setFreq(Number(e.target.value))} className="w-full accent-cyan-400" aria-label="Frequency" />
        <div className="mt-1 flex items-center gap-1">
          {[-50, -10, -1].map((d) => (
            <button key={d} type="button" onClick={() => nudge(d)} className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold hover:bg-white/20">
              {d}
            </button>
          ))}
          <span className="flex-1" />
          {[1, 10, 50].map((d) => (
            <button key={d} type="button" onClick={() => nudge(d)} className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold hover:bg-white/20">
              +{d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => engine.civTone(freq, mat)} className="flex-1 rounded-2xl bg-white/10 py-2.5 font-bold hover:bg-white/20 active:scale-[0.98]">
          🎧 Listen
        </button>
        <button type="button" onClick={strike} disabled={(stock[mat] ?? 0) < 1} className="flex-[2] rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 py-2.5 font-bold shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-40">
          🔔 Strike the {m.name.toLowerCase()}
        </button>
      </div>
      {result && (
        <motion.p key={ring} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl px-3 py-2 text-[13px] font-semibold" style={{ background: `${color}22`, color }}>
          {result.text}
        </motion.p>
      )}
      {(log[mat] ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 text-[10.5px]">
          {(log[mat] ?? []).map((l, i) => (
            <span key={i} className={`rounded-full px-2 py-0.5 ${l.r === "resonant" ? "bg-cyan-400/30" : l.r === "warm" ? "bg-amber-400/25" : l.r === "cold" ? "bg-white/10" : "bg-rose-500/25"}`}>
              {l.f} Hz {l.r === "resonant" ? "🎶" : l.r === "warm" ? "🔥" : l.r === "cold" ? "❄️" : "💥"}
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-snug text-white/50">Close notes hum back (and give a little research). Brittle quartz + crystal can crack on shrill notes; magnetite, copper + meteor shards can throw sparks. Fantasy tech — have fun with it!</p>
    </div>
  );
}

/* ------------------------------ projects ------------------------------ */

function Projects({ snap, engine, onExtinction }: { snap: Snapshot; engine: Engine; onExtinction: () => void }) {
  const civ = snap.civ;
  const ext = snap.extinction;
  const pyramid = civ.monuments.find((m) => m.name === "Pyramid");
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div>
        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-white/50">Monuments</h3>
        {civ.monuments.length ? (
          <div className="space-y-1.5">
            {civ.monuments.map((m) => (
              <div key={m.id} className="rounded-2xl bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{m.icon}</span>
                  <span className="flex-1 font-bold">{m.name}</span>
                  <span className="text-[11px] text-white/60">{m.done ? "✓ finished" : m.stages > 1 ? `stage ${m.stage + 1}/${m.stages}` : `${Math.round(m.built * 100)}%`}</span>
                </div>
                {m.stages > 1 && (
                  <div className="mt-1.5 flex gap-1">
                    {PYRAMID_STAGES.map((s, i) => (
                      <span key={s.name} title={s.name} className={`h-1.5 flex-1 rounded-full ${m.done || i < m.stage ? "bg-amber-300" : i === m.stage ? "bg-amber-300/50" : "bg-white/10"}`} />
                    ))}
                  </div>
                )}
                {m.stages > 1 && !m.done && <p className="mt-1 text-[11px] text-white/55">Now: {m.stageName}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/60">{civ.path === "resonance" ? "Learn Monumental construction to raise a Pyramid, Stone circles and more." : "Your great works are your walls, halls and fields."}</p>
        )}
        {civ.path === "resonance" && !pyramid && civ.done.includes("monumental") && <p className="mt-1.5 text-[11.5px] text-cyan-200">🔺 Place the Pyramid from Build → Wonders. It goes up in 6 stages and needs {PYRAMID_STAGES[5].energy} energy to activate.</p>}
        {civ.megaliths > 0 && <p className="mt-1.5 text-[11.5px] text-white/60">🪨 {civ.megaliths} megalith{civ.megaliths === 1 ? "" : "s"} floated into place.</p>}
      </div>

      <div className="rounded-2xl bg-white/5 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">If the sky falls</h3>
        <ul className="mt-1.5 space-y-1 text-[12.5px]">
          <li>{ext.shelter ? "✅" : "⬜"} 🕳️ Deep shelter {ext.shelter ? "built — people inside have a good chance" : civ.done.includes("deepShelter") ? "— researched, build it from Wonders" : "(Old Ways: Deep shelters)"}</li>
          <li>
            {ext.shieldReady ? "✅" : "⬜"} 🌀 Resonance shield {ext.shield ? (ext.shieldReady ? "charged and ready" : `built — needs ${SHIELD_HOLD} stored energy to hold`) : civ.done.includes("advancedArch") ? "— researched, build it from Wonders" : "(Resonance: Advanced architecture)"}
          </li>
        </ul>
        <p className="mt-1.5 text-[11px] text-white/50">Nothing is guaranteed: even sheltered people might not make it.</p>
      </div>

      <button type="button" onClick={onExtinction} disabled={ext.phase !== "idle" && ext.phase !== "ruins"} className="w-full rounded-2xl border border-rose-400/40 bg-rose-900/40 py-2.5 font-bold text-rose-100 transition hover:bg-rose-800/60 active:scale-[0.98] disabled:opacity-40">
        ☄️ End of an age…
      </button>
      <button type="button" onClick={() => engine.flyTo(engine.world.camp.x, engine.world.camp.y, 0.7)} className="w-full rounded-2xl bg-white/5 py-2 text-[12px] font-semibold text-white/70 hover:bg-white/10">
        🏕️ Back to camp
      </button>
    </div>
  );
}

/* ------------------------------ the choice ------------------------------ */

const PREVIEW: Record<Exclude<CivPath, "none">, { scene: string[]; tree: CivTechId[] }> = {
  traditional: { scene: ["🏡", "⚒️", "🌾", "🧱", "🎯", "🐎"], tree: CIV_ORDER.traditional },
  resonance: { scene: ["🔔", "⚡", "🔷", "🪶", "🔺", "🔆"], tree: CIV_ORDER.resonance },
};

export function CivChoice({ open, onClose, engine, fontClass }: { open: boolean; onClose: () => void; engine: Engine; fontClass: string }) {
  const [pick, setPick] = useState<Exclude<CivPath, "none"> | null>(null);
  const [peek, setPeek] = useState<Exclude<CivPath, "none">>("traditional");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) setPick(null);
  }, [open]);
  const paths = useMemo(() => ["traditional", "resonance"] as const, []);
  return (
    <Modal className="dl-modal" open={open} onClose={onClose} size="lg" accent="#59d0e6" labelledBy="civ-choice">
      <div className={`max-h-[88dvh] overflow-y-auto bg-slate-950 p-5 text-white sm:p-6 ${fontClass}`}>
        <h2 id="civ-choice" className="text-center text-2xl font-bold">💠 The chamber hums. Which way will your people grow?</h2>
        <p className="mx-auto mt-1 max-w-xl text-center text-sm text-white/60">This choice shapes the rest of your world. Late in the game you can borrow a few ideas from the other path, at a price.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {paths.map((k) => {
            const info = PATH_INFO[k];
            const pv = PREVIEW[k];
            const on = pick === k || peek === k;
            return (
              <div
                key={k}
                onMouseEnter={() => setPeek(k)}
                className={`flex flex-col rounded-3xl border p-4 transition ${on ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5"}`}
                style={{ boxShadow: on ? `0 0 40px -12px ${info.color}` : undefined }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-4xl">{info.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: info.color }}>
                      {info.name}
                    </h3>
                    <p className="text-[12px] text-white/60">{info.tag}</p>
                  </div>
                </div>
                {/* a little preview of how the settlement will look */}
                <div className="mt-3 flex items-end justify-around rounded-2xl px-2 py-3" style={{ background: k === "resonance" ? "linear-gradient(180deg,#0b2533,#123b4a)" : "linear-gradient(180deg,#3a2414,#4b3420)" }}>
                  {pv.scene.map((s, i) => (
                    <motion.span key={s} className="text-2xl" animate={{ y: k === "resonance" && (s === "🪶" || s === "🔷") ? [0, -6, 0] : 0 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}>
                      {s}
                    </motion.span>
                  ))}
                </div>
                <p className="mt-3 text-[13px] leading-snug text-white/80">{info.feel}</p>
                <ul className="mt-2 space-y-0.5 text-[12.5px] text-white/75">
                  {info.pros.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
                <details className="mt-2 text-[11.5px] text-white/60">
                  <summary className="cursor-pointer font-semibold text-white/70">Research tree preview</summary>
                  <ol className="mt-1 space-y-0.5">
                    {pv.tree.map((id, i) => (
                      <li key={id}>
                        {i + 1}. {CIV_TECH[id].icon} {CIV_TECH[id].name}
                      </li>
                    ))}
                  </ol>
                </details>
                <span className="flex-1" />
                {pick === k ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setPick(null)} className="flex-1 rounded-2xl bg-white/10 py-2.5 text-sm font-bold hover:bg-white/20">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        engine.chooseCivPath(k);
                        closeRef.current();
                      }}
                      className="flex-[2] rounded-2xl py-2.5 text-sm font-bold text-slate-950 hover:brightness-110"
                      style={{ background: info.color }}
                    >
                      Yes — {k === "resonance" ? "study it" : "keep the Old Ways"}!
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setPick(k)} className="mt-3 rounded-2xl border py-2.5 text-sm font-bold transition hover:bg-white/10" style={{ borderColor: info.color, color: info.color }}>
                    Choose this path
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[11px] text-white/40">The Resonance is pure fantasy technology made up for this game. It isn&apos;t real science.</p>
        <button type="button" onClick={onClose} className="mx-auto mt-2 block text-xs font-semibold text-white/50 hover:text-white">
          Decide later
        </button>
      </div>
    </Modal>
  );
}
