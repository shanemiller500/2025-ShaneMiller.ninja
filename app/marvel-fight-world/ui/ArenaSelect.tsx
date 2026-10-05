"use client";

import { useEffect, useRef, useState } from "react";
import type { FighterDef } from "../engine/types";
import { ARENAS, drawArenaBack, type ArenaDef } from "../render/arenas";
import { ArcadeButton, Portrait } from "./shared";
import css from "./fight-world.module.css";

/** Live, gently animated preview of an arena (paused when off-screen). */
function ArenaThumb({ arena, animate }: { arena: ArenaDef; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const W = (c.width = 480);
    const H = (c.height = 270);
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      drawArenaBack(g, arena, { x: Math.sin(t * 0.3) * 120, s: H / 640 }, t, W, H, H * 0.86);
      if (animate) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [arena, animate]);
  return <canvas ref={ref} className="h-full w-full" />;
}

export default function ArenaSelect({
  p1,
  p2,
  initial,
  onPick,
  onBack,
}: {
  p1: FighterDef;
  p2: FighterDef;
  initial?: ArenaDef;
  onPick: (a: ArenaDef) => void;
  onBack: () => void;
}) {
  const [sel, setSel] = useState<ArenaDef>(initial ?? ARENAS[0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter") onPick(sel);
      if (e.code === "Escape") onBack();
      const i = ARENAS.indexOf(sel);
      if (e.code === "ArrowRight" || e.code === "KeyD") setSel(ARENAS[(i + 1) % ARENAS.length]);
      if (e.code === "ArrowLeft" || e.code === "KeyA") setSel(ARENAS[(i + ARENAS.length - 1) % ARENAS.length]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, onPick, onBack]);

  return (
    <div className="mfw-scroll absolute inset-0 overflow-y-auto p-3 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <ArcadeButton tone="ghost" onClick={onBack}>
            ← Fighters
          </ArcadeButton>
          <h1 className="mfw-title text-3xl sm:text-5xl">Choose your arena</h1>
        </div>

        {/* VS banner */}
        <div className="mfw-panel flex items-center justify-center gap-4 overflow-hidden p-3 sm:gap-10">
          <div className={`flex items-center gap-3 ${css.slideL}`}>
            <div className="h-20 w-16 overflow-hidden border-2 border-black sm:h-28 sm:w-20" style={{ background: p1.look.primary }}>
              <Portrait src={p1.portrait.sm} alt={p1.name} className="h-full w-full" color={p1.look.primary} eager />
            </div>
            <span className="mfw-title text-xl sm:text-3xl" style={{ color: "#fca5a5" }}>
              {p1.name}
            </span>
          </div>
          <span className={`mfw-title text-4xl sm:text-6xl ${css.slam}`}>VS</span>
          <div className={`flex flex-row-reverse items-center gap-3 ${css.slideR}`}>
            <div className="h-20 w-16 overflow-hidden border-2 border-black sm:h-28 sm:w-20" style={{ background: p2.look.primary }}>
              <Portrait src={p2.portrait.sm} alt={p2.name} className="h-full w-full" color={p2.look.primary} eager />
            </div>
            <span className="mfw-title text-xl sm:text-3xl" style={{ color: "#93c5fd" }}>
              {p2.name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARENAS.map((a) => {
            const on = a.id === sel.id;
            return (
              <button
                key={a.id}
                onClick={() => setSel(a)}
                onDoubleClick={() => onPick(a)}
                className={`group relative aspect-video overflow-hidden border-4 text-left transition-transform ${on ? "scale-[1.02]" : "border-black opacity-80 hover:opacity-100"}`}
                style={{ borderColor: on ? a.color : undefined }}
              >
                <ArenaThumb arena={a} animate={on} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                  <div className="mfw-title text-2xl" style={{ color: on ? a.color : "#fff" }}>
                    {a.name}
                  </div>
                  <div className="text-xs font-bold text-white/70">{a.tagline}</div>
                  {a.props.length > 0 && <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-white/40">Destructible props</div>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-3 pb-6">
          <ArcadeButton tone="ghost" onClick={() => onPick(ARENAS[Math.floor(Math.random() * ARENAS.length)])}>
            🎲 Random arena
          </ArcadeButton>
          <ArcadeButton tone="gold" big onClick={() => onPick(sel)}>
            Start fight!
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}
