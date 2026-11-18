"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Handshake, Cloud, Dna, Flame, Gem, Landmark, Pickaxe, Sun, Tent, BookOpen, FolderOpen, Info, Lightbulb, LogOut, Menu, MonitorCog, RefreshCw, Save, Sparkles, Trophy, Volume2, VolumeX, Map as MapIcon, Pause, Play, X } from "lucide-react";
import { DISCOVERIES } from "../data/facts";
import { Engine, type Snapshot } from "../game/engine";
import { WEATHER_LABEL } from "../sim/weather";
import { WORLD_H, WORLD_W } from "../sim/types";
import { useClickAway } from "./useClickAway";
import { MessageFeed, type Toast } from "./Toasts";
import { QUALITY_INFO, type QualityId } from "../render/quality";
import { SEASONS } from "../sim/seasons";

export type TopPanel = null | "time" | "places" | "menu";

interface Props {
  snap: Snapshot;
  engine: Engine;
  panel: TopPanel;
  setPanel: (p: TopPanel) => void;
  muted: boolean;
  onMute: () => void;
  onStickers: () => void;
  onAbout: () => void;
  onSave: () => void;
  onSaves: () => void;
  onNew: () => void;
  onReset: () => void;
  onCamp: () => void;
  onDiplomacy: () => void;
  diplomacyOpen: boolean;
  onEvolution: () => void;
  onCiv: () => void;
  onDeep: () => void;
  onHelp: () => void;
  onTips: () => void;
  tipsOn: boolean;
  quality: QualityId;
  onQuality: (q: QualityId) => void;
  onExtinction: () => void;
  civOpen: boolean;
  onCloud: () => void;
  onLeave: () => void;
  cloudStatus: string;
  campOpen: boolean;
  evoOpen: boolean;
  log: Toast[];
  unread: number;
  popups: boolean;
  onTogglePopups: (on: boolean) => void;
  onRead: () => void;
  onGo: (x: number, y: number) => void;
}

const fmtTime = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const am = hh < 12 ? "am" : "pm";
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${am}`;
};

/** one button in the top-right strip (the strip itself is the glass) */
const btn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white active:scale-90";
const ico = "h-[21px] w-[21px]";

export default function TopBar(p: Props) {
  const { snap, panel, setPanel } = p;
  const reduceMotion = useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  useClickAway(!!panel, barRef, () => setPanel(null));
  const toggle = (k: TopPanel) => setPanel(panel === k ? null : k);
  return (
    <>
      <div ref={barRef} onPointerDownCapture={(e) => {
        if (panel && e.target instanceof Element && !e.target.closest("[data-dl-top-panel], [data-dl-top-trigger]")) setPanel(null);
      }} className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 p-2 sm:p-4">
        <div className="pointer-events-auto relative flex items-center gap-2">
          <SkyDial snap={snap} onClick={() => toggle("time")} />
          <AnimatePresence>{panel === "time" && <TimePanel {...p} />}</AnimatePresence>
        </div>
        <div className="pointer-events-auto relative flex min-w-0 flex-1 justify-end">
          <button type="button" data-dl-top-trigger aria-label={panel === "menu" ? "Close menu" : "Open menu"} aria-expanded={panel === "menu"} aria-controls="dl-mobile-actions"
            onClick={() => toggle("menu")}
            className="dl-glass relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition active:scale-95 sm:hidden">
            <motion.span animate={{ rotate: panel === "menu" ? 90 : 0 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30 }}>
              {panel === "menu" ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </motion.span>
            {p.unread > 0 && panel !== "menu" && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1 text-center text-[10px] font-black text-slate-900">{p.unread > 99 ? "99+" : p.unread}</span>}
          </button>
          {/* phones: the buttons scroll sideways (panels sit outside the strip so they aren't clipped) */}
          <div className="dl-glass hidden min-w-0 items-center gap-0.5 rounded-2xl p-1 sm:flex">
          {p.cloudStatus !== "off" && (
            <button type="button" className={`${btn} relative`} title={p.cloudStatus === "signedIn" ? "Cloud save: on" : "Save to the cloud"} aria-label="Cloud save" onClick={p.onCloud}>
              <Cloud className={ico} />
              <span className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-slate-900 ${p.cloudStatus === "signedIn" ? "bg-emerald-400" : p.cloudStatus === "linkSent" ? "bg-amber-400" : "bg-slate-400"}`} />
            </button>
          )}
          <button type="button" className={`${btn} relative ${p.evoOpen ? "!bg-white/15 !text-cyan-300" : ""}`} title="Evolution" aria-label="Evolution" aria-pressed={p.evoOpen} onClick={p.onEvolution}>
            <Dna className={ico} />
          </button>
          <button type="button" className={`${btn} relative ${snap.view === "deep" ? "!bg-white/15 !text-cyan-300" : ""}`} title={snap.view === "deep" ? "Back to the surface" : "The Deep: the mine under the cave"} aria-label="The Deep" aria-pressed={snap.view === "deep"} onClick={p.onDeep}>
            {snap.view === "deep" ? <Sun className={ico} /> : <Pickaxe className={ico} />}
            {snap.view === "surface" && snap.crew > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-cyan-400 px-1.5 text-[11px] font-bold text-slate-900">{snap.crew}</span>}
          </button>
          <button type="button" className={`${btn} relative ${p.civOpen ? "!bg-white/15 !text-cyan-300" : ""}`} title="Civilization" aria-label="Civilization" aria-pressed={p.civOpen} onClick={p.onCiv}>
            {snap.civ.path === "resonance" ? <Gem className={ico} /> : snap.civ.path === "traditional" ? <Flame className={ico} /> : <Landmark className={ico} />}
            {(snap.civ.pending || (snap.civ.chamber && !snap.civ.found)) && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-cyan-300" />}
            {snap.civ.path === "resonance" && snap.civ.cap > 0 && (
              <span className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, (snap.civ.energy / snap.civ.cap) * 100)}%` }} />
              </span>
            )}
          </button>
          <button type="button" className={`${btn} relative ${p.campOpen ? "!bg-white/15 !text-amber-300" : ""}`} title="Your tribe" aria-label="Your tribe" aria-pressed={p.campOpen} onClick={p.onCamp}>
            <Tent className={ico} />
            {snap.tribe.raid && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-rose-500" />}
          </button>
          <button type="button" className={`${btn} !w-auto gap-1.5 px-2 ${p.diplomacyOpen ? "!bg-white/15 !text-emerald-300" : ""}`} title="Diplomacy" aria-label="Diplomacy" aria-pressed={p.diplomacyOpen} onClick={p.onDiplomacy}><Handshake className={ico} /><span className="hidden text-xs lg:inline">Diplomacy</span></button>
          <button type="button" data-dl-top-trigger className={btn} title="Places" aria-label="Places" onClick={() => toggle("places")}>
            <MapIcon className={ico} />
          </button>
          <button type="button" className={`${btn} relative !w-auto gap-1.5 px-2.5`} title={`Sticker book: ${snap.discoveries.length} of ${DISCOVERIES.length} found`} aria-label="Sticker book" onClick={p.onStickers}>
            <Trophy className={`${ico} text-amber-300`} />
            <span className="text-[12px] font-semibold tabular-nums text-white/70">
              {snap.discoveries.length}<span className="text-white/35">/{DISCOVERIES.length}</span>
            </span>
          </button>
          <span className="mx-0.5 h-6 w-px bg-white/10" aria-hidden />
          <button type="button" className={btn} title={p.muted ? "Sound on" : "Mute"} aria-label={p.muted ? "Sound on" : "Mute"} onClick={p.onMute}>
            {p.muted ? <VolumeX className={ico} /> : <Volume2 className={ico} />}
          </button>
          <button type="button" data-dl-top-trigger className={`${btn} ${panel === "menu" ? "!bg-white/15 !text-white" : ""}`} title="Menu" aria-label="Menu" aria-expanded={panel === "menu"} onClick={() => toggle("menu")}>
            <Menu className={ico} />
          </button>
          </div>
          <AnimatePresence>
            {panel === "places" && <PlacesPanel engine={p.engine} close={() => setPanel(null)} onCamp={p.onCamp} />}
            {panel === "menu" && <><MobileActionsPanel {...p} close={() => setPanel(null)} openPlaces={() => setPanel("places")} /><MenuPanel {...p} close={() => setPanel(null)} /></>}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

/** Round window onto the sky: sun or moon on an arc, tinted by time + weather. */
function SkyDial({ snap, onClick }: { snap: Snapshot; onClick: () => void }) {
  const h = snap.time;
  const day = h >= 6 && h < 18;
  const a = day ? ((h - 6) / 12) * Math.PI : (((h + 6) % 24) / 12) * Math.PI;
  const x = 50 - Math.cos(a) * 34;
  const y = 66 - Math.sin(a) * 44;
  const d = snap.daylight;
  const top = d > 0.5 ? "#5fb7ff" : d > 0.1 ? "#f08a5d" : "#0b1236";
  const bottom = d > 0.5 ? "#bfe6ff" : d > 0.1 ? "#ffd29a" : "#28306b";
  const w = WEATHER_LABEL[snap.weather];
  return (
    <button type="button" data-dl-top-trigger onClick={onClick} className="dl-glass flex items-center gap-2.5 rounded-2xl p-1 pr-3.5 transition hover:brightness-110 active:scale-95" aria-label="Time and weather">
      <span className="relative block h-11 w-11 overflow-hidden rounded-xl ring-1 ring-white/10" style={{ background: `linear-gradient(${top}, ${bottom})` }}>
        {d < 0.3 &&
          [12, 30, 70, 84, 50, 22].map((sx, i) => (
            <span key={i} className="absolute h-[2px] w-[2px] rounded-full bg-white" style={{ left: `${sx}%`, top: `${10 + ((i * 37) % 40)}%`, opacity: 0.5 + ((i * 13) % 5) / 10 }} />
          ))}
        <span className="absolute -translate-x-1/2 -translate-y-1/2 text-xl transition-all duration-500" style={{ left: `${x}%`, top: `${y}%` }}>
          {day ? "☀️" : "🌙"}
        </span>
        <span className="absolute inset-x-0 bottom-0 h-3 bg-emerald-700/80" />
        {snap.weather !== "clear" && <span className="absolute bottom-0.5 right-0.5 text-base">{w.icon}</span>}
      </span>
      <span className="text-left leading-tight">
        <span className="block text-[15px] font-semibold tabular-nums tracking-tight">{fmtTime(h)}</span>
        <span className="block text-[11px] font-medium text-white/55">
          {snap.season.icon} {snap.season.name} - Day {snap.day} · {w.label}
          {snap.paused ? " · ⏸" : ""}
        </span>
      </span>
    </button>
  );
}

const pop = {
  initial: { opacity: 0, y: -8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { type: "spring" as const, stiffness: 460, damping: 32 },
};

function TimePanel({ snap, engine }: Props) {
  return (
    <motion.div {...pop} data-dl-top-panel className="dl-glass absolute left-0 top-[calc(100%+8px)] w-72 rounded-3xl p-4 shadow-2xl">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>🌅 Time of day</span>
        <span className="text-white/70">{fmtTime(snap.time)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={23.9}
        step={0.1}
        value={snap.time}
        onChange={(e) => engine.setTime(parseFloat(e.target.value))}
        className="mt-2 w-full accent-amber-400"
        aria-label="Time of day"
      />
      <div className="mt-1 flex justify-between text-lg">
        {[
          [6, "🌅"],
          [12, "☀️"],
          [18.7, "🌇"],
          [0, "🌙"],
        ].map(([h, ic]) => (
          <button key={ic} type="button" onClick={() => engine.setTime(h as number)} className="rounded-xl px-2 py-1 hover:bg-white/15 active:scale-90" title="Jump">
            {ic}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white/90">
        <span>
          {snap.season.icon} {snap.season.name}, day {snap.season.dayOf} of {snap.season.days}
        </span>
        <span className="text-white/55">Year {snap.season.year}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1" role="group" aria-label="Choose a season">
        {SEASONS.map((s) => <button key={s.id} type="button" aria-pressed={snap.season.name === s.name} onClick={() => engine.setSeason(s.id)} className={"flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold transition active:scale-95 " + (snap.season.name === s.name ? "bg-amber-300 text-slate-900" : "bg-white/10 hover:bg-white/20")}><span className="text-lg" aria-hidden="true">{s.icon}</span>{s.name}</button>)}
      </div>
      <p className="mt-1 text-[10px] text-white/50">Choose a season to move the calendar forward. Seasons also change naturally.</p>
      <div className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/75">
        <div className="flex items-center justify-between font-semibold text-white/90">
          <span>
            {snap.sky.icon} Sky watching: {snap.sky.name}
          </span>
          {snap.sky.moon && <span title={snap.sky.moon.name}>{snap.sky.moon.icon}</span>}
        </div>
        {snap.sky.next !== null && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-indigo-300" style={{ width: `${Math.min(100, (snap.sky.knowledge / snap.sky.next) * 100)}%` }} />
          </div>
        )}
        <p className="mt-1">
          {snap.sky.watching ? "Someone is out watching the stars tonight." : "On clear nights someone lies back and studies the sky."}
          {snap.sky.level >= 2 && ` Forecasts: ${snap.sky.hits} right, ${snap.sky.misses} wrong.`}
        </p>
        {snap.sky.forecasts.length > 0 && (
          <div className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5">
            <div className="font-semibold text-white/90">🔭 Coming up (the watchers' guess)</div>
            {snap.sky.forecasts.slice(0, 4).map((f, i) => (
              <div key={i}>
                {f.icon} {f.text}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold">⏩ Clock speed</div>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 4].map((s) => {
          const on = s === 0 ? snap.paused : !snap.paused && snap.speed === s;
          return (
            <button key={s} type="button" onClick={() => engine.setSpeed(s)} className={`flex items-center justify-center rounded-xl py-2 text-sm font-bold transition active:scale-90 ${on ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
              {s === 0 ? <Pause className="h-4 w-4" /> : s === 1 ? <Play className="h-4 w-4" /> : `${s}×`}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold">
        <span>🎲 Surprise weather</span>
        <input type="checkbox" checked={snap.weatherAuto} onChange={(e) => engine.setWeatherAuto(e.target.checked)} className="h-5 w-5 accent-amber-400" />
      </label>
      <p className="mt-2 text-xs text-white/60">Use the 🌦️ toy to change the weather yourself.</p>
    </motion.div>
  );
}

function PlacesPanel({ engine, close, onCamp }: { engine: Engine; close: () => void; onCamp: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = 288;
  const H = Math.round((W * WORLD_H) / WORLD_W);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = ref.current;
      if (!cv) return;
      const c = cv.getContext("2d")!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== W * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = true;
      c.drawImage(engine.renderer.mapImage, 0, 0, W, H);
      const k = W / WORLD_W;
      for (const d of engine.world.dinos) {
        c.fillStyle = "rgba(255,240,180,0.9)";
        c.fillRect(d.x * k - 1, d.y * k - 1, 2, 2);
      }
      const v = engine.renderer.viewRect(engine.cam);
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.strokeRect(v.x0 * k, v.y0 * k, (v.x1 - v.x0) * k, (v.y1 - v.y0) * k);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, W, H]);
  return (
    <motion.div {...pop} data-dl-top-panel className="dl-glass absolute right-0 top-[calc(100%+8px)] w-[312px] rounded-3xl p-3 shadow-2xl">
      <canvas
        ref={ref}
        style={{ width: W, height: H }}
        className="cursor-pointer rounded-2xl"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          engine.flyTo(((e.clientX - r.left) / W) * WORLD_W, ((e.clientY - r.top) / H) * WORLD_H);
        }}
        aria-label="Map — tap to fly there"
      />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {Engine.places().map((pl) => (
          <button
            key={pl.id}
            type="button"
            onClick={() => {
              engine.flyTo(pl.x, pl.y, pl.zoom);
              if (pl.id === "camp") onCamp();
              close();
            }}
            className="flex flex-col items-center rounded-2xl bg-white/5 px-1 py-2 transition hover:bg-white/15 active:scale-95"
          >
            <span className="text-2xl leading-none">{pl.icon}</span>
            <span className="mt-1 text-[11px] font-semibold leading-tight text-white/85">{pl.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-white/55">Some places are secret… keep exploring! ✨</p>
    </motion.div>
  );
}

function MobileActionsPanel(p: Props & { close: () => void; openPlaces: () => void }) {
  const reduceMotion = useReducedMotion();
  const action = (label: string, icon: ReactNode, onClick: () => void, active = false) => (
    <button key={label} type="button" onClick={onClick} aria-label={label} aria-pressed={active}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center text-[11px] font-bold leading-tight transition active:scale-95 ${active ? "border-amber-300/50 bg-amber-300/20 text-amber-100" : "border-white/10 bg-white/[0.07] text-white/85 hover:bg-white/15"}`}>
      <span className="text-xl leading-none">{icon}</span>{label}
    </button>
  );
  const run = (fn: () => void) => () => { fn(); p.close(); };
  return (
    <motion.div id="dl-mobile-actions" data-dl-top-panel initial={reduceMotion ? false : { opacity: 0, x: 14, y: -12, scale: 0.94 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={{ opacity: 0, x: 10, y: -8, scale: 0.96 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
      className="dl-glass dl-scroll pointer-events-auto absolute right-0 top-[calc(100%+8px)] z-50 max-h-[min(78dvh,680px)] w-[min(92vw,360px)] overflow-y-auto rounded-3xl border border-amber-200/20 p-3 shadow-2xl shadow-black/40 sm:hidden">
      <div className="mb-3 flex items-center justify-between px-1">
        <div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/70">Dinosaur Land</div><div className="text-lg font-black">World menu</div></div>
        <span className="rounded-full bg-amber-300/15 px-2.5 py-1 text-[11px] font-bold text-amber-100">Day {p.snap.day}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {p.cloudStatus !== "off" && action("Cloud", "☁️", run(p.onCloud), p.cloudStatus === "signedIn")}
        {action("Evolution", "🧬", run(p.onEvolution), p.evoOpen)}
        {action(p.snap.view === "deep" ? "Surface" : "The Deep", p.snap.view === "deep" ? "🌤️" : "⛏️", run(p.onDeep), p.snap.view === "deep")}
        {action("Civilization", p.snap.civ.path === "resonance" ? "💠" : p.snap.civ.path === "traditional" ? "🔥" : "🏛️", run(p.onCiv), p.civOpen)}
        {action("Your tribe", p.snap.tribe.levelIcon, run(p.onCamp), p.campOpen)}
        {action("Diplomacy", <Handshake className="h-5 w-5" />, run(p.onDiplomacy), p.diplomacyOpen)}
        {action("Places", <MapIcon className="h-5 w-5" />, p.openPlaces)}
        {action("Stickers", <Trophy className="h-5 w-5 text-amber-300" />, run(p.onStickers))}
        {action(p.muted ? "Sound on" : "Mute", p.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />, p.onMute, p.muted)}
      </div>
      <details className="group mt-3 rounded-2xl bg-black/15 p-2" onToggle={(e) => { if (e.currentTarget.open) p.onRead(); }}>
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-1 text-sm font-bold">
          <span>🔔 Alerts</span><span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[11px] text-amber-100">{p.unread ? `${p.unread} new` : p.log.length}</span>
        </summary>
        <div className="dl-scroll max-h-[min(38dvh,300px)] overflow-y-auto border-t border-white/10 pt-2">
          <MessageFeed log={p.log} popups={p.popups} onTogglePopups={p.onTogglePopups} onGo={(x, y) => { p.onGo(x, y); p.close(); }} />
        </div>
      </details>
      <div className="my-3 h-px bg-white/10" />
      <MenuPanel {...p} embedded />
    </motion.div>
  );
}

function MenuPanel(p: Props & { close: () => void; embedded?: boolean }) {
  const item = "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] font-semibold transition hover:bg-white/15 active:scale-[0.98]";
  return (
    <motion.div {...(p.embedded ? {} : pop)} data-dl-top-panel className={p.embedded ? "rounded-2xl bg-white/[0.04] p-1" : "dl-glass absolute right-0 top-[calc(100%+8px)] hidden w-72 rounded-3xl p-2 shadow-2xl sm:block"}>
      <button type="button" className={item} onClick={() => { p.onSave(); p.close(); }}>
        <Save className="h-5 w-5 text-emerald-300" /> Save now
      </button>
      <button type="button" className={item} onClick={() => { p.onSaves(); p.close(); }}>
        <FolderOpen className="h-5 w-5 text-amber-300" /> Saved games
      </button>
      <button type="button" className={item} onClick={() => { p.onNew(); p.close(); }}>
        <Sparkles className="h-5 w-5 text-sky-300" /> New world
      </button>
      <button type="button" className={item} onClick={() => { p.onReset(); p.close(); }}>
        <RefreshCw className="h-5 w-5 text-rose-300" /> Reset everything
      </button>
      <button type="button" className={item} onClick={() => { p.onHelp(); p.close(); }}>
        <BookOpen className="h-5 w-5 text-amber-300" /> How to play
      </button>
      <button type="button" className={item} onClick={() => p.onTips()} aria-pressed={p.tipsOn}>
        <Lightbulb className={`h-5 w-5 ${p.tipsOn ? "text-amber-300" : "text-white/40"}`} /> Tips: {p.tipsOn ? "On" : "Off"}
      </button>
      <button type="button" className={item} onClick={() => { p.onAbout(); p.close(); }}>
        <Info className="h-5 w-5 text-amber-300" /> About Dinosaur Land
      </button>
      <div className="px-3 pb-1 pt-2">
        <div className="flex items-center justify-between text-[12px] font-semibold text-white/60">
          <span className="flex items-center gap-1.5"><MonitorCog className="h-4 w-4" /> Graphics</span>
          <span className="text-white/45">{p.quality === "auto" ? `Auto · ${QUALITY_INFO[p.engine.quality.level].name}` : QUALITY_INFO[p.quality].name}</span>
        </div>
        <div role="radiogroup" aria-label="Graphics quality" className="mt-1.5 grid grid-cols-5 gap-1 rounded-xl bg-black/25 p-1">
          {(["auto", "low", "medium", "high", "ultra"] as const).map((q) => (
            <button key={q} type="button" role="radio" aria-checked={p.quality === q} title={QUALITY_INFO[q].hint} onClick={() => p.onQuality(q)}
              className={`rounded-lg px-0.5 py-1.5 text-[11px] font-bold transition active:scale-95 ${p.quality === q ? "bg-white text-slate-900 shadow" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              {q === "medium" ? "Med" : QUALITY_INFO[q].name}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-white/45">{QUALITY_INFO[p.quality].hint}</p>
      </div>
      <button type="button" className={item} disabled={p.snap.extinction.phase !== "idle" && p.snap.extinction.phase !== "ruins"} onClick={() => { p.onExtinction(); p.close(); }}>
        <span className="w-5 text-center text-lg leading-none">☄️</span> End of an age…
      </button>
      <div className="my-1 h-px bg-white/10" />
      <button
        type="button"
        className={item}
        onClick={() => {
          p.engine.save(true);
          p.close();
          p.onLeave();
        }}
      >
        <LogOut className="h-5 w-5 text-white/70" /> Leave to projects
      </button>
      <p className="px-3 pb-1 pt-1 text-[11px] text-white/45">
        {p.snap.dinos} dinos · {p.snap.humans} cave people · {p.snap.fps} fps · sim {p.snap.perf.sim}ms · draw {p.snap.perf.render}ms
      </p>
    </motion.div>
  );
}
