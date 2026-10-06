"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, Info, LogOut, Menu, RefreshCw, Save, Sparkles, Trophy, Volume2, VolumeX, Map as MapIcon, Pause, Play } from "lucide-react";
import { DISCOVERIES } from "../data/facts";
import { Engine, type Snapshot } from "../game/engine";
import { WEATHER_LABEL } from "../sim/weather";
import { WORLD_H, WORLD_W } from "../sim/types";

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
  onEvolution: () => void;
  onCloud: () => void;
  onLeave: () => void;
  cloudStatus: string;
  campOpen: boolean;
  evoOpen: boolean;
}

const fmtTime = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const am = hh < 12 ? "am" : "pm";
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${am}`;
};

const btn = "dl-glass flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800/80 active:scale-90 sm:h-14 sm:w-14";

export default function TopBar(p: Props) {
  const { snap, panel, setPanel } = p;
  const toggle = (k: TopPanel) => setPanel(panel === k ? null : k);
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-4">
        <div className="pointer-events-auto relative flex items-center gap-2">
          <SkyDial snap={snap} onClick={() => toggle("time")} />
          <AnimatePresence>{panel === "time" && <TimePanel {...p} />}</AnimatePresence>
        </div>
        <div className="pointer-events-auto relative flex items-center gap-1.5 sm:gap-2">
          {p.cloudStatus !== "off" && (
            <button type="button" className={`${btn} relative`} title={p.cloudStatus === "signedIn" ? "Cloud save: on" : "Save to the cloud"} aria-label="Cloud save" onClick={p.onCloud}>
              <span className="text-2xl leading-none">☁️</span>
              <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900 ${p.cloudStatus === "signedIn" ? "bg-emerald-400" : p.cloudStatus === "linkSent" ? "bg-amber-400" : "bg-slate-400"}`} />
            </button>
          )}
          <button type="button" className={`${btn} relative ${p.evoOpen ? "!bg-cyan-500/60" : ""}`} title="Evolution" aria-label="Evolution" aria-pressed={p.evoOpen} onClick={p.onEvolution}>
            <span className="text-2xl leading-none">🧬</span>
          </button>
          <button type="button" className={`${btn} relative ${p.campOpen ? "!bg-amber-500/60" : ""}`} title="Your tribe" aria-label="Your tribe" aria-pressed={p.campOpen} onClick={p.onCamp}>
            <span className="text-2xl leading-none">{snap.tribe.levelIcon}</span>
            {snap.tribe.raid && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-rose-500" />}
          </button>
          <button type="button" className={btn} title="Places" aria-label="Places" onClick={() => toggle("places")}>
            <MapIcon className="h-6 w-6" />
          </button>
          <button type="button" className={`${btn} relative`} title="Sticker book" aria-label="Sticker book" onClick={p.onStickers}>
            <Trophy className="h-6 w-6 text-amber-300" />
            <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-slate-900">
              {snap.discoveries.length}/{DISCOVERIES.length}
            </span>
          </button>
          <button type="button" className={btn} title={p.muted ? "Sound on" : "Mute"} aria-label={p.muted ? "Sound on" : "Mute"} onClick={p.onMute}>
            {p.muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </button>
          <button type="button" className={btn} title="Menu" aria-label="Menu" onClick={() => toggle("menu")}>
            <Menu className="h-6 w-6" />
          </button>
          <AnimatePresence>
            {panel === "places" && <PlacesPanel engine={p.engine} close={() => setPanel(null)} onCamp={p.onCamp} />}
            {panel === "menu" && <MenuPanel {...p} close={() => setPanel(null)} />}
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
    <button type="button" onClick={onClick} className="dl-glass flex items-center gap-2 rounded-[22px] p-1.5 pr-3 shadow-lg transition hover:-translate-y-0.5 active:scale-95" aria-label="Time and weather">
      <span className="relative block h-12 w-12 overflow-hidden rounded-[16px] sm:h-14 sm:w-14" style={{ background: `linear-gradient(${top}, ${bottom})` }}>
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
        <span className="block text-sm font-bold sm:text-base">{fmtTime(h)}</span>
        <span className="block text-[11px] font-medium text-white/70 sm:text-xs">
          Day {snap.day} · {w.label}
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
    <motion.div {...pop} className="dl-glass absolute left-0 top-[calc(100%+8px)] w-72 rounded-3xl p-4 shadow-2xl">
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
    <motion.div {...pop} className="dl-glass absolute right-0 top-[calc(100%+8px)] w-[312px] rounded-3xl p-3 shadow-2xl">
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

function MenuPanel(p: Props & { close: () => void }) {
  const item = "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] font-semibold transition hover:bg-white/15 active:scale-[0.98]";
  return (
    <motion.div {...pop} className="dl-glass absolute right-0 top-[calc(100%+8px)] w-60 rounded-3xl p-2 shadow-2xl">
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
      <button type="button" className={item} onClick={() => { p.onAbout(); p.close(); }}>
        <Info className="h-5 w-5 text-amber-300" /> About Dinosaur Land
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
        {p.snap.dinos} dinos · {p.snap.humans} cave people · {p.snap.fps} fps
      </p>
    </motion.div>
  );
}
