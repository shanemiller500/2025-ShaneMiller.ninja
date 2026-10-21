"use client";

/* ------------------------------------------------------------------ */
/*  The hatching scene: a little film that plays when a dragon egg     */
/*  hatches (and can be watched again from the dragon's panel).        */
/*                                                                     */
/*  A warm, glowing hatchery. The keeper kneels by the egg; it rocks,  */
/*  cracks spread with light leaking through, the shell bursts, and    */
/*  the hatchling blinks its eyes open for the first time, stretches   */
/*  its wings, sneezes a puff of fire, then hops over to the person    */
/*  waiting for it: a glowing thread of light between them, hearts,    */
/*  and their names. Bonded.                                           */
/*                                                                     */
/*  It's drawn with the game's own art (so the hatchling is exactly    */
/*  the dragon you'll raise: its colours, markings and eyes, and the   */
/*  keeper's own face), at full screen resolution up to 4K, and the    */
/*  game pauses while it plays. Replay or close at any time (Esc).     */
/* ------------------------------------------------------------------ */
import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { Engine } from "../game/engine";
import { BREEDS } from "../data/dragons";
import { drawDragon, drawDragonEgg } from "../render/dragonArt";
import { drawFlame, drawHuman } from "../render/sprites";
import type { Dragon, DragonEgg, Human } from "../sim/types";

/** The film's length (seconds); it holds on the last shot after. */
const LENGTH = 15;
/** Virtual stage the film is composed on (scaled to fill the screen). */
const VW = 1600;
const VH = 900;
const GROUND = 690;
const EGG_X = 900;
const KEEPER_X = 610;

type Scene = NonNullable<ReturnType<Engine["hatchSceneData"]>>;

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** Seeded dice, so each dragon's film always plays the same (and each dragon's is different). */
function dice(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

interface Shard { x: number; y: number; vx: number; vy: number; r: number; spin: number; size: number; col: string }
interface Mote { x: number; y: number; s: number; v: number; a: number }

export default function HatchScene({ engine, dragonId, onClose }: { engine: Engine; dragonId: number; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scene] = useState<Scene | null>(() => engine.hatchSceneData(dragonId));
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const [caption, setCaption] = useState("");

  const close = useCallback(() => onClose(), [onClose]);

  // the game holds still while the film plays
  useEffect(() => {
    engine.stop();
    return () => engine.start();
  }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !scene) return;
    const c = cv.getContext("2d");
    if (!c) return;
    // up to 4K-sharp: the canvas is sized in real device pixels (at least 2x, at most 3840 wide)
    const fit = () => {
      const dpr = Math.max(2, window.devicePixelRatio || 1);
      const k = Math.min(dpr, 3840 / Math.max(1, window.innerWidth));
      cv.width = Math.round(window.innerWidth * k);
      cv.height = Math.round(window.innerHeight * k);
    };
    fit();
    window.addEventListener("resize", fit);

    const L = BREEDS[scene.dragon.breed ?? "fire"].look;
    const rnd = dice(scene.dragon.id);
    const dragon: Dragon = { ...(scene.dragon as Dragon) };
    const keeper: Human | null = scene.keeper ? ({ ...(scene.keeper as unknown as Human) }) : null;
    const egg: DragonEgg = { ...(scene.egg as DragonEgg) };
    // dust motes drifting in the warm light; straw stalks round the nest
    const motes: Mote[] = Array.from({ length: 60 }, () => ({ x: rnd() * VW, y: rnd() * VH, s: 1 + rnd() * 2.5, v: 6 + rnd() * 14, a: 0.2 + rnd() * 0.5 }));
    const straw = Array.from({ length: 70 }, () => ({ a: rnd() * Math.PI, r: 70 + rnd() * 70, l: 14 + rnd() * 26, tilt: (rnd() - 0.5) * 1.4 }));
    const cracks = Array.from({ length: 7 }, (_, i) => {
      const pts: [number, number][] = [];
      let x = (rnd() - 0.5) * 6;
      let y = -8 - rnd() * 4;
      const dx = i % 2 ? 1 : -1;
      for (let k = 0; k < 5; k++) {
        x += dx * (0.6 + rnd() * 1.2);
        y += (rnd() - 0.5) * 2.4;
        pts.push([x, y]);
      }
      return { at: 2.8 + i * 0.42, pts };
    });
    let shards: Shard[] = [];
    let burst = false;
    let sounds = new Set<string>();
    const start = performance.now();
    let raf = 0;

    const say = (s: string) => setCaption((cur) => (cur === s ? cur : s));
    const sfx = (key: string, name: string, vol = 1, pitch = 1) => {
      if (sounds.has(key)) return;
      sounds.add(key);
      engine.audio.play(name, 0, 0, vol, pitch);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - start) / 1000;
      const W = cv.width;
      const H = cv.height;
      // compose on the 1600x900 stage, letterboxed to fill the screen (cover)
      const k = Math.max(W / VW, H / VH);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      // a slow push-in on the egg, with a jolt when it bursts
      const zoom = 1 + span(t, 0, 6) * 0.12 + span(t, 9.5, 14) * 0.06;
      const jolt = burst && t < 6.6 ? Math.sin(t * 90) * 6 * (6.6 - t) : 0;
      const focusX = EGG_X - span(t, 9.5, 12) * 110;
      c.translate(W / 2, H / 2);
      c.scale(k * zoom, k * zoom);
      c.translate(-focusX + jolt, -VH * 0.55);

      // the hatchery: warm firelight on stone
      const bg = c.createRadialGradient(EGG_X, GROUND - 120, 40, EGG_X, GROUND - 120, 1100);
      const pulse = 0.85 + Math.sin(t * 2.2) * 0.05 + (burst ? Math.max(0, 1 - (t - 6) * 0.8) * 0.4 : 0);
      bg.addColorStop(0, `rgba(255,190,110,${0.95 * pulse})`);
      bg.addColorStop(0.35, "#8a4a26");
      bg.addColorStop(1, "#1d0f0a");
      c.fillStyle = bg;
      c.fillRect(-400, -400, VW + 800, VH + 800);
      // stone wall blocks in the back
      c.fillStyle = "rgba(40,22,14,0.35)";
      for (let row = 0; row < 6; row++) {
        for (let i = 0; i < 9; i++) {
          const x = -200 + i * 230 + (row % 2) * 115;
          const y = 40 + row * 90;
          c.beginPath();
          c.roundRect(x, y, 212, 78, 14);
          c.fill();
        }
      }
      // the floor
      const fl = c.createLinearGradient(0, GROUND - 40, 0, VH + 200);
      fl.addColorStop(0, "#5b3a22");
      fl.addColorStop(1, "#24140c");
      c.fillStyle = fl;
      c.fillRect(-400, GROUND - 10, VW + 800, VH);
      // the fire that keeps the egg warm
      drawFlame(c, 1270, GROUND + 4, 6, t);
      drawFlame(c, 1300, GROUND + 6, 4.5, t * 1.3);
      // the nest of straw
      c.fillStyle = "#6e4a24";
      c.beginPath();
      c.ellipse(EGG_X, GROUND + 6, 150, 38, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#c79a4a";
      c.lineWidth = 3;
      c.lineCap = "round";
      for (const s of straw) {
        const x = EGG_X + Math.cos(s.a) * s.r * (s.a > Math.PI / 2 ? -1 : 1);
        const y = GROUND + 4 + Math.sin(s.a) * 22 - 6;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(s.tilt) * s.l, y + Math.sin(s.tilt) * s.l * 0.4);
        c.stroke();
      }

      // the keeper, kneeling close by (then reaching out)
      if (keeper) {
        keeper.state = t > 9.8 ? "tame" : t > 6.2 && t < 7.4 ? "lookUp" : "watch";
        keeper.anim = t * (t > 9.8 ? 1.2 : 0.4);
        c.save();
        c.translate(KEEPER_X + span(t, 9.6, 11.5) * 40, GROUND + 2);
        c.scale(6, 6);
        drawHuman(c, keeper, t, null, false, 0, 1, null, 0, null, 0, false);
        c.restore();
      }

      // ---- the egg: glow, rock, crack ----
      const rock = t < 6 ? Math.sin(t * (6 + t * 4)) * 0.05 * span(t, 1.8, 5.8) : 0;
      if (t < 6) {
        say(keeper ? `${keeper.name} keeps watch over the egg…` : "Something stirs inside the egg…");
        // a halo of heat
        const halo = c.createRadialGradient(EGG_X, GROUND - 95, 10, EGG_X, GROUND - 95, 220);
        halo.addColorStop(0, `rgba(255,220,140,${0.35 + span(t, 2, 6) * 0.4})`);
        halo.addColorStop(1, "rgba(255,200,120,0)");
        c.fillStyle = halo;
        c.beginPath();
        c.arc(EGG_X, GROUND - 95, 220, 0, Math.PI * 2);
        c.fill();
        c.save();
        c.translate(EGG_X, GROUND);
        c.rotate(rock);
        egg.progress = 0.2;
        drawDragonEgg(c, egg, t, 12);
        // cracks spreading, light pouring through
        c.scale(12, 12);
        for (const cr of cracks) {
          const g = span(t, cr.at, cr.at + 0.5);
          if (g <= 0) continue;
          if (g < 0.2) sfx(`crack${cr.at}`, "crack", 0.7, 1.4);
          const n = Math.max(1, Math.round(cr.pts.length * g));
          c.lineCap = "round";
          for (const [w, col] of [[1.1, "rgba(255,230,150,0.45)"], [0.45, "#2a140c"], [0.18, "#fff2c0"]] as const) {
            c.strokeStyle = col;
            c.lineWidth = w;
            c.beginPath();
            c.moveTo(0, -9);
            for (let i = 0; i < n; i++) c.lineTo(cr.pts[i][0], cr.pts[i][1]);
            c.stroke();
          }
        }
        // light beams from the biggest cracks just before it goes
        const beam = span(t, 4.6, 5.9);
        if (beam > 0) {
          c.globalCompositeOperation = "lighter";
          for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i - 2) * 0.38 + Math.sin(t * 3 + i) * 0.05;
            const g = c.createLinearGradient(0, -9, Math.cos(a) * 40, -9 + Math.sin(a) * 40);
            g.addColorStop(0, `rgba(255,236,170,${0.55 * beam})`);
            g.addColorStop(1, "rgba(255,236,170,0)");
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(0, -9);
            c.lineTo(Math.cos(a - 0.08) * 40, -9 + Math.sin(a - 0.08) * 40);
            c.lineTo(Math.cos(a + 0.08) * 40, -9 + Math.sin(a + 0.08) * 40);
            c.closePath();
            c.fill();
          }
          c.globalCompositeOperation = "source-over";
        }
        c.restore();
      } else if (!burst) {
        // ---- it bursts ----
        burst = true;
        sfx("burst", "crack", 1.3, 0.9);
        sfx("pop", "pop", 1, 1.2);
        shards = Array.from({ length: 34 }, (_, i) => {
          const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
          const v = 260 + rnd() * 420;
          return { x: EGG_X + (rnd() - 0.5) * 40, y: GROUND - 100 + (rnd() - 0.5) * 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd() * 6, spin: (rnd() - 0.5) * 14, size: 10 + rnd() * 22, col: i % 3 === 0 ? L.spots : L.egg };
        });
      }

      // ---- shell: two halves tipping away, shards flying ----
      if (burst) {
        const tb = t - 6;
        for (const side of [-1, 1]) {
          c.save();
          c.translate(EGG_X + side * (40 + Math.min(1, tb * 2) * 150), GROUND - 10);
          c.rotate(side * Math.min(1.2, tb * 3));
          c.scale(12, 12);
          c.fillStyle = L.egg;
          c.strokeStyle = "#2a140c";
          c.lineWidth = 0.35;
          c.beginPath();
          c.ellipse(0, -3, 6.2, 4.6, 0, 0, Math.PI);
          c.lineTo(-6.2, -3);
          for (let i = 0; i <= 6; i++) c.lineTo(-6.2 + i * 2.07, -3 - (i % 2 ? 2.2 : 0));
          c.closePath();
          c.fill();
          c.stroke();
          c.restore();
        }
        const dt = 1 / 60;
        for (const s of shards) {
          if (tb < 3) {
            s.vy += 900 * dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.r += s.spin * dt;
            if (s.y > GROUND + 10) {
              s.y = GROUND + 10;
              s.vy *= -0.3;
              s.vx *= 0.6;
              s.spin *= 0.5;
            }
          }
          c.save();
          c.translate(s.x, s.y);
          c.rotate(s.r);
          c.fillStyle = s.col;
          c.beginPath();
          c.moveTo(-s.size / 2, 0);
          c.lineTo(0, -s.size / 3);
          c.lineTo(s.size / 2, s.size / 5);
          c.closePath();
          c.fill();
          c.restore();
        }
        // the flash
        if (tb < 0.9) {
          c.fillStyle = `rgba(255,248,220,${(0.9 - tb) * 0.9})`;
          c.fillRect(-400, -400, VW + 800, VH + 800);
        }
      }

      // ---- the hatchling ----
      if (t >= 6) {
        const tb = t - 6;
        // eyes closed… then open for the first time
        dragon.state = tb < 1 ? "sleep" : tb > 3.4 && tb < 9 ? "walk" : "play";
        // a wobbly stand, a stretch of the wings, then hops over to its person
        dragon.hop = tb > 0.6 && tb < 1.6 ? (1.6 - tb) * 1.4 : tb > 3.6 && tb < 6 ? (Math.sin(tb * 7) * 0.5 + 0.5) * 1.2 : 0;
        dragon.spread = tb > 1.6 && tb < 3.6 ? Math.sin(((tb - 1.6) / 2) * Math.PI) : 0;
        dragon.anim = tb * 2.5;
        // a tiny sneeze of fire
        dragon.breath = tb > 2.9 && tb < 3.3 ? 0.7 : 0;
        if (tb > 2.9) sfx("sneeze", "ignite", 0.5, 1.8);
        if (tb > 1) sfx("chirp", "screech", 0.55, 2.4);
        const walk = span(t, 9.6, 11.6);
        // it stops just in front of its person (never on top of them)
        const dx = EGG_X - walk * 100;
        c.save();
        c.translate(dx, GROUND - 4);
        c.scale(3.6, 3.6);
        drawDragon(c, dragon, t);
        c.restore();
        if (tb < 9.6 - 6 + 2) say(`${scene.name} hatched!`);
        // the bond: a thread of light between them, hearts rising, a glowing ring
        const bond = span(t, 11, 12.5);
        if (keeper && bond > 0) {
          say(`${scene.name} & ${keeper.name}`);
          sfx("bond", "chime", 0.8, 1.1);
          // from the keeper's outstretched hand to the hatchling's snout
          const hx = KEEPER_X + 40 + 70;
          const hy = GROUND - 105;
          const mx = dx - 85;
          const my = GROUND - 85;
          c.globalCompositeOperation = "lighter";
          c.strokeStyle = `rgba(255,220,120,${0.7 * bond})`;
          c.lineWidth = 6;
          c.beginPath();
          c.moveTo(hx, hy);
          c.bezierCurveTo(hx + 40, hy - 80 - Math.sin(t * 3) * 20, mx - 40, my - 80 + Math.sin(t * 3) * 20, mx, my);
          c.stroke();
          c.lineWidth = 2;
          c.strokeStyle = `rgba(255,255,230,${0.9 * bond})`;
          c.stroke();
          const ring = c.createRadialGradient((hx + mx) / 2, (hy + my) / 2 - 40, 10, (hx + mx) / 2, (hy + my) / 2 - 40, 260);
          ring.addColorStop(0, `rgba(255,210,120,${0.35 * bond})`);
          ring.addColorStop(1, "rgba(255,210,120,0)");
          c.fillStyle = ring;
          c.beginPath();
          c.arc((hx + mx) / 2, (hy + my) / 2 - 40, 260, 0, Math.PI * 2);
          c.fill();
          c.globalCompositeOperation = "source-over";
          for (let i = 0; i < 10; i++) {
            const f = (t * 0.35 + i / 10) % 1;
            const x = (hx + mx) / 2 + Math.sin(i * 2.3 + t) * 120 * f;
            const y = (hy + my) / 2 - f * 260;
            c.globalAlpha = bond * (1 - f);
            c.font = `${26 + (i % 3) * 8}px serif`;
            c.textAlign = "center";
            c.fillText(i % 3 === 0 ? "✨" : "❤️", x, y);
          }
          c.globalAlpha = 1;
        } else if (!keeper && t > 11) say(`${scene.name} has hatched!`);
      }

      // dust motes in the light
      c.fillStyle = "#ffe7b0";
      for (const m of motes) {
        const y = (m.y - t * m.v + VH * 4) % VH;
        c.globalAlpha = m.a * (0.6 + Math.sin(t + m.x) * 0.4);
        c.beginPath();
        c.arc(m.x + Math.sin(t * 0.5 + m.y) * 10, y, m.s, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      // cinematic: vignette + letterbox bars
      c.setTransform(1, 0, 0, 1, 0, 0);
      const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.6)");
      c.fillStyle = vg;
      c.fillRect(0, 0, W, H);
      const bar = H * 0.09 * (1 - span(t, LENGTH - 0.5, LENGTH + 1) * 0.3);
      c.fillStyle = "#000";
      c.fillRect(0, 0, W, bar);
      c.fillRect(0, H - bar, W, bar);
      // fade in
      if (t < 0.8) {
        c.fillStyle = `rgba(0,0,0,${1 - t / 0.8})`;
        c.fillRect(0, 0, W, H);
      }
      if (t > LENGTH) setDone(true);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      sounds = new Set();
    };
  }, [scene, run, engine]);

  if (!scene) return null;
  const replay = () => {
    setDone(false);
    setCaption("");
    setRun((r) => r + 1);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black" role="dialog" aria-modal="true" aria-label={`${scene.name} hatching`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-[11%] text-center">
        <div className="font-serif text-[clamp(22px,4.5vw,56px)] font-bold tracking-wide text-amber-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] transition-opacity duration-700">{caption}</div>
        {done && (
          <div className="mt-1 text-[clamp(12px,1.8vw,20px)] font-semibold text-amber-200/85 drop-shadow">
            {scene.icon} {scene.breed}{scene.rare ? " · golden-flecked" : ""}{scene.keeper ? " · bonded for life" : ""}
          </div>
        )}
      </div>
      <div className="absolute bottom-[11%] left-1/2 flex -translate-x-1/2 gap-3">
        <button type="button" onClick={replay} className="flex min-h-11 items-center gap-2 rounded-2xl bg-white/15 px-4 font-bold text-white backdrop-blur hover:bg-white/25 active:scale-95">
          <RotateCcw size={18} /> Replay
        </button>
        <button type="button" onClick={close} className="flex min-h-11 items-center gap-2 rounded-2xl bg-amber-400/90 px-4 font-bold text-[#3a2414] hover:bg-amber-300 active:scale-95">
          <X size={18} /> {done ? "Close" : "Skip"}
        </button>
      </div>
    </div>
  );
}
