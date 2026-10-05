"use client";

/* Title-screen backdrop: two CPU fighters sparring (silent attract mode). */

import { useEffect, useRef } from "react";
import { FightAI } from "../engine/ai";
import { Match } from "../engine/match";
import type { FighterDef } from "../engine/types";
import { ARENAS } from "../render/arenas";
import { FightRenderer } from "../render/renderer";

export default function Attract({ fighters }: { fighters: FighterDef[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const pool = fighters.filter((f) => f.custom);
    if (!pool.length) return;
    const canvas = ref.current!;
    const g = canvas.getContext("2d")!;
    let match: Match;
    let ai: [FightAI, FightAI];
    let renderer: FightRenderer;
    let n = 0;
    const start = () => {
      n++;
      const a = pool[Math.floor(Math.random() * pool.length)];
      let b = pool[Math.floor(Math.random() * pool.length)];
      if (b.id === a.id) b = pool[(pool.indexOf(a) + 1) % pool.length];
      match = new Match({ p1: a, p2: b, roundsToWin: 1, seed: n * 97 });
      ai = [new FightAI(0, "hard", n), new FightAI(1, "hard", n + 5)];
      renderer = new FightRenderer(ARENAS[Math.floor(Math.random() * ARENAS.length)]);
    };
    start();
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      acc += Math.min(0.1, (now - last) / 1000) * match.timeScale;
      last = now;
      while (acc >= 1 / 60) {
        match.step([ai[0].update(match), ai[1].update(match)]);
        renderer.consume(match.events, match);
        match.events.length = 0;
        renderer.tick();
        acc -= 1 / 60;
      }
      if (match.phase === "over" && match.phaseTime > 120) start();
      if (W && H) renderer.draw(g, match, W, H);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fighters]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-60" aria-hidden />;
}
