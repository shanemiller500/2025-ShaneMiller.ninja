"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronUp, Dices, Eye, GitCompare, Map as MapIcon, Swords, UserRound } from "lucide-react";

import { audio } from "../audio/audio";
import type { Roster } from "../data/roster";
import type { Settings } from "../data/storage";
import type { FighterDef } from "../engine/types";
import type { ArenaDef } from "../render/arenas";
import { WorldScene } from "../world/scene";
import { ZONES, ZONE_HALF, neighbours, residentsFor, zoneById, type Resident } from "../world/zones";
import { AlignmentChip, ArcadeButton, ArchetypeChip, Keycap, P_COLORS, PadBtn, StatBars, StatRadar, cn } from "./kit";
import { usePadConnected } from "./usePad";

interface Props {
  roster: Roster;
  settings: Settings;
  player: FighterDef;
  zoneId: string;
  x: number;
  onMove: (zoneId: string, x: number) => void;
  onFight: (opponent: FighterDef, arena: ArenaDef) => void;
  onView: (def: FighterDef) => void;
  onChangeFighter: () => void;
  onBack: () => void;
  /** An overlay (character sheet) is open on top: freeze the walker */
  frozen?: boolean;
}

export function WorldScreen(p: Props) {
  const { roster, settings, player } = p;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const [zoneId, setZoneId] = useState(p.zoneId);
  const [entryX, setEntryX] = useState(p.x);
  const [near, setNear] = useState<Resident | null>(null);
  const [map, setMap] = useState(false);
  const [compare, setCompare] = useState<FighterDef | null>(null);
  const [touch, setTouch] = useState(false);
  const [fade, setFade] = useState(true);
  const pad = usePadConnected();
  const cb = useRef(p);
  cb.current = p;

  const zone = zoneById(zoneId);
  const residents = useMemo(() => residentsFor(zone, roster.fighters, roster.featured, player.id), [zone, roster, player.id]);
  const [left, right] = neighbours(zone.id);

  useEffect(() => {
    setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  const travel = useCallback((id: string, x: number) => {
    setFade(true);
    audio.play("whoosh", 0.6);
    window.setTimeout(() => {
      setNear(null);
      setZoneId(id);
      setEntryX(x);
      setMap(false);
    }, 260);
  }, []);

  // Boot one scene per zone visit
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const scene = new WorldScene(c, zone, player, residents, entryX, settings, {
      onNear: (r) => {
        setNear(r);
        if (r) audio.ui("move");
      },
      onEdge: (dir) => {
        const [l, r] = neighbours(zone.id);
        travel((dir < 0 ? l : r).id, dir < 0 ? ZONE_HALF - 260 : -ZONE_HALF + 260);
      },
    });
    sceneRef.current = scene;
    scene.start();
    const id = window.setTimeout(() => setFade(false), 60);
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);
    audio.startMusic(zone.arena.music);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", onResize);
      cb.current.onMove(zone.id, scene.x);
      scene.destroy();
      sceneRef.current = null;
    };
    // entryX intentionally read only when the zone changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, player, residents, settings]);

  // Freeze the walker while an overlay is open
  useEffect(() => {
    sceneRef.current?.setActive(!map && !compare && !p.frozen);
  }, [map, compare, p.frozen, zone]);

  const fight = useCallback(
    (def: FighterDef) => {
      if (sceneRef.current) cb.current.onMove(zone.id, sceneRef.current.x);
      cb.current.onFight(def, zone.arena);
    },
    [zone]
  );

  const randomChallenge = useCallback(() => {
    const pool = roster.fighters.filter((d) => d.id !== player.id);
    fight(pool[Math.floor(Math.random() * pool.length)]);
  }, [roster, player.id, fight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Escape") {
        if (compare) setCompare(null);
        else if (map) setMap(false);
        else cb.current.onBack();
        return;
      }
      if (e.code === "KeyM" || e.code === "Tab") {
        e.preventDefault();
        setMap((m) => !m);
        audio.ui("select");
        return;
      }
      if (map || compare) return;
      if (e.code === "KeyR") randomChallenge();
      if (e.code === "KeyF") cb.current.onChangeFighter();
      if (!near) return;
      if (e.code === "KeyE" || e.code === "Enter") {
        audio.ui("confirm");
        fight(near.def);
      } else if (e.code === "KeyV") cb.current.onView(near.def);
      else if (e.code === "KeyC") setCompare(near.def);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [near, map, compare, fight, randomChallenge]);

  const hold = (a: "left" | "right" | "up") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      sceneRef.current?.setTouch(a, true);
    },
    onPointerUp: () => sceneRef.current?.setTouch(a, false),
    onPointerLeave: () => sceneRef.current?.setTouch(a, false),
    onPointerCancel: () => sceneRef.current?.setTouch(a, false),
  });

  return (
    <div className="absolute inset-0 overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className={cn("pointer-events-none absolute inset-0 bg-black transition-opacity duration-300", fade ? "opacity-100" : "opacity-0")} />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/80 to-transparent p-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={p.onBack} aria-label="Back to menu" className="rounded-xl bg-black/40 p-2.5 text-white/75 ring-1 ring-white/10 backdrop-blur hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <AnimatePresence mode="wait">
            <motion.div key={zone.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">Fight World · Zone {ZONES.indexOf(zone) + 1}/{ZONES.length}</p>
              <p className="fw-display fw-outline text-3xl font-[650] uppercase leading-none md:text-4xl">{zone.name}</p>
              <p className="mt-1 hidden text-sm text-white/60 sm:block">{zone.blurb}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={p.onChangeFighter} className="hidden items-center gap-2 rounded-xl bg-black/40 py-1.5 pl-1.5 pr-3 ring-1 ring-white/10 backdrop-blur hover:bg-white/10 sm:flex" title="Change fighter">
            <img src={player.portrait.xs} alt="" className="h-8 w-8 rounded-lg object-cover object-top" />
            <span className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: P_COLORS[0] }}>Playing as</span>
              <span className="fw-display block text-sm font-[650] uppercase leading-none">{player.name}</span>
            </span>
            <UserRound className="ml-1 h-4 w-4 text-white/50" />
          </button>
          <ArcadeButton tone="ghost" size="sm" onClick={randomChallenge} title="Random challenger (R)">
            <Dices className="h-4 w-4" /> <span className="hidden md:inline">Random</span>
          </ArcadeButton>
          <ArcadeButton tone="cyan" size="sm" onClick={() => setMap(true)} title="World map (M)">
            <MapIcon className="h-4 w-4" /> Map
          </ArcadeButton>
        </div>
      </div>

      {/* Proximity prompt */}
      <AnimatePresence>
        {near && !map && !compare && (
          <motion.div
            key={near.def.id}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className={cn("absolute left-1/2 z-10 w-[min(94vw,640px)] -translate-x-1/2", touch ? "bottom-40" : "bottom-8")}
          >
            <div className="flex items-center gap-4 overflow-hidden rounded-2xl bg-[#0b0c14]/90 p-3 pr-4 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] ring-1 ring-amber-300/40 backdrop-blur-xl">
              <img src={near.def.portrait.sm} alt="" className="h-20 w-16 shrink-0 rounded-xl object-cover object-top ring-1 ring-white/15" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ArchetypeChip def={near.def} />
                  <AlignmentChip def={near.def} />
                </div>
                <p className="fw-display mt-1 truncate text-2xl font-[650] uppercase leading-none">{near.def.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-white/55">{near.def.blurb}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                <ArcadeButton size="sm" onClick={() => fight(near.def)}>
                  <Swords className="h-4 w-4" /> Fight <span className="hidden opacity-60 sm:inline">{pad ? "A" : "E"}</span>
                </ArcadeButton>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => p.onView(near.def)} title={pad ? "Y · View file" : "V · View file"} className="rounded-lg bg-white/[0.07] p-2.5 text-white/80 ring-1 ring-white/10 hover:bg-white/15">
                    <Eye className="h-4 w-4" /> {pad && <span className="text-xs">Y</span>}
                  </button>
                  <button type="button" onClick={() => setCompare(near.def)} title={pad ? "X · Compare" : "C · Compare"} className="rounded-lg bg-white/[0.07] p-2.5 text-white/80 ring-1 ring-white/10 hover:bg-white/15">
                    <GitCompare className="h-4 w-4" /> {pad && <span className="text-xs">X</span>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls hint */}
      {!touch && !near && pad && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-black/50 px-5 py-2 text-[12px] text-white/70 ring-1 ring-white/10 backdrop-blur">
          <span className="flex items-center gap-1.5"><PadBtn>LS</PadBtn> walk</span>
          <span className="flex items-center gap-1.5"><PadBtn>LB</PadBtn> run</span>
          <span className="flex items-center gap-1.5"><PadBtn>↑</PadBtn> jump</span>
          <span className="flex items-center gap-1.5"><PadBtn>View</PadBtn> map</span>
          <span className="flex items-center gap-1.5"><PadBtn>LS</PadBtn> change fighter</span>
          <span className="flex items-center gap-1.5"><PadBtn>RS</PadBtn> random</span>
        </div>
      )}
      {!touch && !near && !pad && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-black/50 px-5 py-2 text-[12px] text-white/70 ring-1 ring-white/10 backdrop-blur">
          <span className="flex items-center gap-1.5"><Keycap>A</Keycap><Keycap>D</Keycap> walk</span>
          <span className="flex items-center gap-1.5"><Keycap>Shift</Keycap> run</span>
          <span className="flex items-center gap-1.5"><Keycap>W</Keycap> jump</span>
          <span className="flex items-center gap-1.5"><Keycap>M</Keycap> map</span>
          <span className="hidden items-center gap-1.5 md:flex">walk to a fighter to challenge them</span>
        </div>
      )}

      {/* Touch pad */}
      {touch && !map && !compare && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
          <div className="flex gap-3">
            <button type="button" aria-label="Left" {...hold("left")} className="grid h-20 w-20 touch-none place-items-center rounded-full bg-white/10 ring-1 ring-white/20 active:bg-white/25"><ChevronLeft className="h-9 w-9" /></button>
            <button type="button" aria-label="Right" {...hold("right")} className="grid h-20 w-20 touch-none place-items-center rounded-full bg-white/10 ring-1 ring-white/20 active:bg-white/25"><ChevronRight className="h-9 w-9" /></button>
          </div>
          <button type="button" aria-label="Jump" {...hold("up")} className="grid h-20 w-20 touch-none place-items-center rounded-full bg-white/10 ring-1 ring-white/20 active:bg-white/25"><ChevronUp className="h-9 w-9" /></button>
        </div>
      )}

      {/* World map */}
      <AnimatePresence>
        {map && (
          <motion.div data-pad-menu initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 grid place-items-center bg-black/75 p-6 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && setMap(false)}>
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} className="w-[min(96vw,1100px)]">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">Fast travel</p>
                  <p className="fw-display fw-outline text-4xl font-[650] uppercase">World map</p>
                </div>
                <p className="hidden text-sm text-white/50 sm:block">
                  Walk off either edge to reach <b className="text-white/80">{left.name}</b> or <b className="text-white/80">{right.name}</b>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {ZONES.map((z, i) => {
                  const here = z.id === zone.id;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => (here ? setMap(false) : travel(z.id, -ZONE_HALF + 300))}
                      className={cn("group relative h-32 overflow-hidden rounded-xl p-4 text-left transition hover:-translate-y-0.5", here ? "ring-2 ring-amber-300" : "ring-1 ring-white/15 hover:ring-white/40")}
                      style={{ background: `linear-gradient(135deg, ${z.arena.colors[0]}, ${z.arena.colors[1]})` }}
                    >
                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.25),transparent_55%)] opacity-0 transition group-hover:opacity-100" />
                      <span className="font-mono text-[10px] font-bold text-white/60">{String(i + 1).padStart(2, "0")}</span>
                      <span className="fw-display mt-1 block text-xl font-[650] uppercase leading-tight">{z.name}</span>
                      <span className="mt-1 line-clamp-2 block text-[12px] text-white/70">{z.blurb}</span>
                      {here && <span className="absolute right-3 top-3 rounded-sm bg-amber-300 px-1.5 text-[10px] font-black uppercase text-slate-950">You are here</span>}
                      {z.favors && !here && <span className={cn("absolute right-3 top-3 text-[10px] font-black uppercase", z.favors === "bad" ? "text-rose-200" : "text-emerald-200")}>{z.favors === "bad" ? "Villain turf" : "Hero turf"}</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compare */}
      <AnimatePresence>
        {compare && (
          <motion.div data-pad-menu initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 grid place-items-center bg-black/75 p-6 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && setCompare(null)}>
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} className="fw-thin-scroll max-h-[92vh] w-[min(96vw,1000px)] overflow-y-auto rounded-3xl bg-[#0b0c14] p-6 ring-1 ring-white/10">
              <p className="fw-display text-center text-3xl font-[650] uppercase">
                <span style={{ color: P_COLORS[0] }}>{player.name}</span> <span className="text-amber-300">vs</span> <span style={{ color: P_COLORS[1] }}>{compare.name}</span>
              </p>
              <div className="mt-6 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
                <StatBars def={player} />
                <div className="mx-auto">
                  <StatRadar defs={[player, compare]} size={260} />
                </div>
                <StatBars def={compare} />
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ArcadeButton size="lg" onClick={() => fight(compare)}>
                  <Swords className="h-5 w-5" /> Fight {compare.name}
                </ArcadeButton>
                <ArcadeButton tone="ghost" data-pad-back onClick={() => setCompare(null)}>
                  Close
                </ArcadeButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
