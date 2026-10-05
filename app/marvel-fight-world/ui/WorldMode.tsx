"use client";

/* ------------------------------------------------------------------ */
/*  World mode: walk a side-scrolling comic world, meet characters and  */
/*  challenge them. Rendering + movement run in a canvas loop; React    */
/*  only re-renders when the zone or the nearby character changes.      */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { InputManager } from "../engine/input";
import type { FighterDef, FighterState } from "../engine/types";
import { Rng } from "../engine/rng";
import { ARENAS, drawArenaBack, arenaById, type ArenaDef, type ArenaId } from "../render/arenas";
import { drawFighter } from "../render/drawFighter";
import { comicText } from "../render/renderer";
import { ArcadeButton, Portrait, StatBars } from "./shared";
import css from "./fight-world.module.css";

const ZONE_W = 1800;
const ZONES: { arena: ArenaId; name: string; blurb: string }[] = [
  { arena: "street", name: "Downtown Streets", blurb: "Busy avenues and somebody's wrecked taxi." },
  { arena: "rooftop", name: "Skyline Rooftops", blurb: "Heroes keep watch up here at night." },
  { arena: "lab", name: "Underground Lab", blurb: "Strange experiments, stranger visitors." },
  { arena: "temple", name: "Mystic Temple", blurb: "Floating stones and old magic." },
  { arena: "volcano", name: "Magma Forge", blurb: "A secret base built into a volcano." },
  { arena: "space", name: "Orbital Station", blurb: "The edge of space. Cosmic-level threats." },
];
const WORLD_W = ZONES.length * ZONE_W;

interface Npc {
  def: FighterDef;
  x: number;
  home: number;
  facing: 1 | -1;
  vx: number;
  state: FighterState;
  stateTime: number;
  next: number;
}

export interface WorldState {
  x: number;
  seed: number;
}

export default function WorldMode({
  player,
  fighters,
  input,
  state,
  onFight,
  onDetails,
  onCompare,
  onExit,
}: {
  player: FighterDef;
  fighters: FighterDef[];
  input: InputManager;
  state: WorldState;
  onFight: (opponent: FighterDef, arena: ArenaDef, x: number) => void;
  onDetails: (f: FighterDef) => void;
  onCompare: (f: FighterDef) => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zone, setZone] = useState(0);
  const [near, setNear] = useState<Npc | null>(null);
  const [selected, setSelected] = useState<Npc | null>(null);
  const posRef = useRef(state.x);
  const selectedRef = useRef<Npc | null>(null);
  selectedRef.current = selected;

  // Populate each zone with a few characters (stable for this visit)
  const npcs = useMemo<Npc[]>(() => {
    const rng = new Rng(state.seed);
    const others = fighters.filter((f) => f.id !== player.id);
    const featured = others.filter((f) => f.custom);
    const rest = others.filter((f) => !f.custom);
    const out: Npc[] = [];
    ZONES.forEach((_, zi) => {
      for (let k = 0; k < 3; k++) {
        const pool = (k === 0 && featured.length) || !rest.length ? featured : rest;
        const def = pool.splice(rng.int(0, pool.length - 1), 1)[0];
        if (!def) continue;
        const x = zi * ZONE_W + 380 + k * 480 + rng.int(-60, 60);
        out.push({ def, x, home: x, facing: rng.chance(0.5) ? 1 : -1, vx: 0, state: "idle", stateTime: 0, next: rng.int(60, 200) });
      }
    });
    return out;
  }, [fighters, player.id, state.seed]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    input.attach();
    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const me = { x: posRef.current, y: 0, vy: 0, vx: 0, facing: 1 as 1 | -1, state: "idle" as FighterState, stateTime: 0 };
    let camX = me.x;
    let t = 0;
    let raf = 0;
    let lastZone = -1;
    let lastNear: Npc | null = null;
    let prevUp = false;
    let prevAct = false;

    const loop = () => {
      t += 1 / 60;
      const inp = input.read(0);
      const inp2 = input.read(1);
      const left = inp.left || inp2.left;
      const right = inp.right || inp2.right;
      const up = inp.up || inp2.up;
      const act = inp.lp || inp2.lp || input.held("Enter") || input.held("Space");

      // Movement (paused while a character card is open)
      const busy = !!selectedRef.current;
      const speed = player.walk * 1.6;
      me.vx = busy ? 0 : right ? speed : left ? -speed : 0;
      if (me.vx) me.facing = me.vx > 0 ? 1 : -1;
      if (!busy && up && !prevUp && me.y === 0) me.vy = player.jump;
      prevUp = up;
      me.vy -= 0.95;
      me.y = Math.max(0, me.y + me.vy);
      if (me.y === 0) me.vy = 0;
      me.x = Math.max(80, Math.min(WORLD_W - 80, me.x + me.vx));
      const ns: FighterState = me.y > 0 ? "air" : me.vx ? "walk" : "idle";
      if (ns !== me.state) {
        me.state = ns;
        me.stateTime = 0;
      } else me.stateTime++;
      posRef.current = me.x;

      // NPC idle wandering
      for (const n of npcs) {
        n.stateTime++;
        const dist = Math.abs(n.x - me.x);
        if (dist < 260) {
          n.vx = 0;
          n.facing = me.x > n.x ? 1 : -1;
          if (n.state !== "idle") {
            n.state = "idle";
            n.stateTime = 0;
          }
        } else if (--n.next <= 0) {
          n.next = 80 + Math.floor(Math.random() * 200);
          const dir = Math.random() < 0.5 ? -1 : 1;
          n.vx = Math.random() < 0.5 ? 0 : dir * n.def.walk * 0.5;
          if (Math.abs(n.x + n.vx * 60 - n.home) > 160) n.vx = -n.vx;
          n.facing = n.vx ? (n.vx > 0 ? 1 : -1) : n.facing;
          n.state = n.vx ? "walk" : "idle";
          n.stateTime = 0;
        }
        n.x += n.vx;
      }

      // Nearest character
      let best: Npc | null = null;
      let bd = 150;
      for (const n of npcs) {
        const d = Math.abs(n.x - me.x);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best !== lastNear) {
        lastNear = best;
        setNear(best);
      }
      if (act && !prevAct && best && !busy) setSelected(best);
      prevAct = act;

      const zi = Math.min(ZONES.length - 1, Math.floor(me.x / ZONE_W));
      if (zi !== lastZone) {
        lastZone = zi;
        setZone(zi);
      }

      // ---- Render ----
      if (W > 0 && H > 0) {
        const s = H / 560;
        const groundY = H * 0.86;
        camX += (me.x - camX) * 0.1;
        const arena = arenaById(ZONES[zi].arena);
        const zoneCenter = zi * ZONE_W + ZONE_W / 2;
        drawArenaBack(g, arena, { x: camX - zoneCenter, s }, t, W, H, groundY);

        g.save();
        g.translate(W / 2 - camX * s, groundY);
        g.scale(s, s);
        // zone gates
        for (let k = 1; k < ZONES.length; k++) {
          const gx = k * ZONE_W;
          g.fillStyle = "rgba(255,255,255,0.08)";
          g.fillRect(gx - 6, -520, 12, 520);
          comicText(g, `${ZONES[k - 1].name} ◀  ▶ ${ZONES[k].name}`, gx, -540, 22, "#e2e8f0");
        }
        for (const n of npcs) {
          if (Math.abs(n.x - camX) > W / s) continue;
          drawFighter(
            g,
            { def: n.def, x: n.x, y: 0, facing: n.facing, state: n.state, stateTime: n.stateTime, move: null, moveTime: 0, vy: 0, invuln: 0, rage: 0, shield: 0, flash: 0 },
            t,
            arena.rim
          );
          const isNear = n === lastNear;
          comicText(g, n.def.name.toUpperCase(), n.x, -(n.def.height + 34), isNear ? 24 : 16, isNear ? "#fde047" : "#e2e8f0");
          if (isNear) comicText(g, "!", n.x, -(n.def.height + 70 + Math.sin(t * 6) * 6), 40, "#ef4444");
        }
        drawFighter(
          g,
          { def: player, x: me.x, y: me.y, facing: me.facing, state: me.state, stateTime: me.stateTime, move: null, moveTime: 0, vy: me.vy, invuln: 0, rage: 0, shield: 0, flash: 0 },
          t,
          arena.rim
        );
        g.restore();

        // Fade to black at zone borders
        const fromLeft = zi > 0 ? me.x - zi * ZONE_W : Infinity;
        const fromRight = zi < ZONES.length - 1 ? (zi + 1) * ZONE_W - me.x : Infinity;
        const edge = Math.min(fromLeft, fromRight);
        if (edge < 220) {
          g.fillStyle = `rgba(0,0,0,${0.7 * (1 - edge / 220)})`;
          g.fillRect(0, 0, W, H);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [npcs, player, input]);

  const onCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = r.height / 560;
    const wx = posRef.current + (e.clientX - r.left - r.width / 2) / s;
    let best: Npc | null = null;
    let bd = 90;
    for (const n of npcs) {
      const d = Math.abs(n.x - wx);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (best) setSelected(best);
  };

  const z = ZONES[zone];
  const arena = arenaById(z.arena);
  const randomOpponent = () => {
    const pool = fighters.filter((f) => f.id !== player.id);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-pointer" onClick={onCanvasClick} />

      {/* Zone banner */}
      <div key={zone} className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-center ${css.slam}`}>
        <div className="mfw-title text-3xl sm:text-5xl" style={{ color: arena.color }}>
          {z.name}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-white/70">{z.blurb}</div>
      </div>

      <div className="absolute left-3 top-3 flex gap-2">
        <ArcadeButton tone="ghost" onClick={onExit}>
          ← Menu
        </ArcadeButton>
      </div>

      {/* Minimap */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
        {ZONES.map((zz, i) => (
          <div key={zz.name} className={`h-2 w-10 skew-x-[-20deg] border border-black sm:w-16 ${i === zone ? "" : "opacity-40"}`} style={{ background: arenaById(zz.arena).color }} />
        ))}
      </div>

      {!selected && (
        <div className="pointer-events-none absolute bottom-8 left-3 text-[11px] font-bold uppercase tracking-widest text-white/60">
          {near ? `Press J / Enter (or tap) to meet ${near.def.name}` : "A / D or ← → to walk · W to jump · find someone to fight"}
        </div>
      )}

      {selected && (
        <div className="absolute inset-x-2 bottom-2 z-10 sm:inset-x-auto sm:right-4 sm:w-[420px]">
          <div className={`mfw-panel p-3 ${css.slideR}`}>
            <div className="flex gap-3">
              <div className="h-28 w-20 shrink-0 overflow-hidden border-2 border-black" style={{ background: selected.def.look.primary }}>
                <Portrait src={selected.def.portrait.sm} alt={selected.def.name} className="h-full w-full" color={selected.def.look.primary} eager />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mfw-title text-2xl">{selected.def.name}</div>
                <div className="mb-1 text-[11px] text-white/60">{selected.def.blurb}</div>
                <StatBars stats={selected.def.stats} compare={player.stats} compact />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ArcadeButton onClick={() => onFight(selected.def, arena, posRef.current)}>Fight!</ArcadeButton>
              <ArcadeButton tone="ghost" onClick={() => onDetails(selected.def)}>
                View
              </ArcadeButton>
              <ArcadeButton tone="ghost" onClick={() => onCompare(selected.def)}>
                Compare
              </ArcadeButton>
              <ArcadeButton tone="ghost" onClick={() => onFight(randomOpponent(), ARENAS[Math.floor(Math.random() * ARENAS.length)], posRef.current)}>
                🎲 Random challenge
              </ArcadeButton>
              <ArcadeButton tone="danger" onClick={() => setSelected(null)}>
                Leave
              </ArcadeButton>
            </div>
            <p className="mt-2 text-[10px] text-white/40">Bars show {selected.def.name}; white ticks are {player.name}.</p>
          </div>
        </div>
      )}
    </div>
  );
}
