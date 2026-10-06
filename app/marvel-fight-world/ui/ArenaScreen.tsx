"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Dices } from "lucide-react";

import { audio } from "../audio/audio";
import type { FighterDef } from "../engine/types";
import type { Prop } from "../engine/match";
import { ARENAS, drawBack, drawFloor, drawFront, drawProp, type ArenaDef } from "../render/arenas";
import { FLOOR_Y, VH } from "../render/util";
import { ArcadeButton, Backdrop, P_COLORS, cn } from "./kit";
import { usePadConnected } from "./usePad";

/** Live, animated preview of an arena (same painters as the fight). */
export function ArenaPreview({ arena, className, zoom = 1.25 }: { arena: ArenaDef; className?: string; zoom?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: false })!;
    let raf = 0;
    const start = performance.now();
    const props: Prop[] = arena.props.map((p, i) => ({ id: i + 1, kind: p.kind, x: p.x, w: p.w, h: p.h, hp: 2, broken: false }));
    const draw = (now: number) => {
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.max(10, Math.round(rect.width * dpr));
      const h = Math.max(10, Math.round(rect.height * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const s = h / VH;
      const VW = w / s;
      const t = (now - start) / 1000;
      const camX = Math.sin(t * 0.15) * 260;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawBack(ctx, arena, { VW, camX, zoom, t });
      ctx.save();
      ctx.translate(VW / 2, FLOOR_Y);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, 0);
      drawFloor(ctx, arena, t);
      for (const p of props) drawProp(ctx, p, arena, t);
      ctx.restore();
      drawFront(ctx, arena, { VW, camX, zoom, t });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [arena, zoom]);
  return <canvas ref={ref} className={className} />;
}

export function ArenaScreen({ p1, p2, onBack, onPick }: { p1: FighterDef; p2: FighterDef | null; onBack: () => void; onPick: (a: ArenaDef) => void }) {
  const [idx, setIdx] = useState(0);
  const pad = usePadConnected();
  const arena = ARENAS[idx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "KeyS", "ArrowRight", "KeyD"].includes(e.code)) {
        setIdx((i) => (i + 1) % ARENAS.length);
        audio.ui("move");
      } else if (["ArrowUp", "KeyW", "ArrowLeft", "KeyA"].includes(e.code)) {
        setIdx((i) => (i - 1 + ARENAS.length) % ARENAS.length);
        audio.ui("move");
      } else if (e.code === "Enter" || e.code === "KeyJ") {
        e.preventDefault();
        onPick(ARENAS[idx]);
      } else if (e.code === "Escape" || e.code === "Backspace") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, onBack, onPick]);

  return (
    <div className="absolute inset-0 isolate flex flex-col text-white">
      <Backdrop tint={arena.colors[1]} />
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">Stage select</p>
          <p className="fw-display text-2xl font-[650] uppercase leading-none">Choose an arena</p>
        </div>
        <p className="fw-display ml-auto hidden text-xl font-[650] uppercase sm:block">
          <span style={{ color: P_COLORS[0] }}>{p1.name}</span>
          {p2 && (
            <>
              <span className="mx-2 text-amber-300">vs</span>
              <span style={{ color: P_COLORS[1] }}>{p2.name}</span>
            </>
          )}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[360px_1fr]">
        {pad && <p className="pointer-events-none absolute bottom-3 left-5 z-10 bg-black/70 px-3 py-1.5 font-mono text-xs text-amber-200">D-Pad / Left Stick Choose · A Confirm · B Back</p>}
        <div className="fw-thin-scroll flex min-h-0 flex-col gap-2 overflow-y-auto">
          {ARENAS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onMouseEnter={() => setIdx(i)}
              onFocus={() => setIdx(i)}
              onClick={() => onPick(a)}
              className={cn("relative -skew-x-6 overflow-hidden rounded-lg px-5 py-4 text-left transition", i === idx ? "scale-[1.02] ring-2 ring-amber-300" : "opacity-75 ring-1 ring-white/10 hover:opacity-100")}
              style={{ background: `linear-gradient(110deg, ${a.colors[0]}, ${a.colors[1]})` }}
            >
              <span className="block skew-x-6">
                <span className="fw-display block text-2xl font-[650] uppercase">{a.name}</span>
                <span className="mt-1 block text-[13px] text-white/75">{a.tagline}</span>
              </span>
            </button>
          ))}
          <ArcadeButton tone="ghost" className="mt-2" onClick={() => onPick(ARENAS[Math.floor(Math.random() * ARENAS.length)])}>
            <Dices className="h-4 w-4" /> Random arena
          </ArcadeButton>
        </div>

        <div className="relative min-h-[300px] overflow-hidden rounded-2xl ring-1 ring-white/15">
          <ArenaPreview arena={arena} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/90 to-transparent p-6">
            <motion.div key={arena.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <p className="fw-display fw-outline text-5xl font-[650] uppercase">{arena.name}</p>
              <p className="mt-1 text-white/75">{arena.tagline}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-white/45">{arena.props.length} destructible props</p>
            </motion.div>
            <ArcadeButton size="lg" onClick={() => onPick(arena)} autoFocus>
              Fight! →
            </ArcadeButton>
          </div>
        </div>
      </div>
    </div>
  );
}
