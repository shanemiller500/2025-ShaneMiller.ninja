"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue } from "framer-motion";

/**
 * Slide something across the scene. Uses its own motion value so it still animates
 * inside a parent AnimatePresence with initial={false} (which would skip initial animations).
 */
function useGlide(from: number, to: number, duration: number, delay = 0) {
  const x = useMotionValue(from);
  useEffect(() => {
    const ctl = animate(x, to, { duration, ease: "linear", delay });
    return () => ctl.stop();
  }, [x, to, duration, delay]);
  return x;
}

/* ------------------------------------------------------------------ */
/*  Things that wander past: deer, elk, moose and mountain lions at    */
/*  the cabin, cars past the house. Drawn inside the scene SVG so the  */
/*  railing and the porch column sit in front of them.                 */
/* ------------------------------------------------------------------ */

export type Critter = "deer" | "elk" | "moose" | "lion" | "bear";

export interface Passer {
  id: number;
  kind: Critter;
  /** 1 = walking right, -1 = walking left */
  dir: 1 | -1;
  /** view-box y of their hooves */
  ground: number;
  duration: number;
  members: { offset: number; dy: number; scale: number; male: boolean }[];
}

export interface CarPass {
  id: number;
  dir: 1 | -1;
  color: string;
  duration: number;
}

const INK = "#2a1f1a";
const O = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const };

/** A leg that swings from the hip while walking. */
function Leg({ x, top, len, w, color, hoof, phase, speed }: { x: number; top: number; len: number; w: number; color: string; hoof: string; phase: 0 | 1; speed: number }) {
  return (
    <g className="wl-leg" style={{ animationDuration: `${speed}s`, animationDelay: phase ? `${-speed / 2}s` : "0s" }}>
      <rect x={x - w / 2} y={top} width={w} height={len} rx={w / 2} fill={color} {...O} />
      <rect x={x - w / 2 - 0.5} y={top + len - 5} width={w + 1} height={5} rx={1.5} fill={hoof} />
    </g>
  );
}

function Deer({ male, winter, speed }: { male: boolean; winter: boolean; speed: number }) {
  const coat = winter ? "#8f735a" : "#b07440";
  return (
    <g>
      <Leg x={-26} top={-50} len={50} w={5} color={coat} hoof="#2a1f1a" phase={1} speed={speed} />
      <Leg x={24} top={-50} len={50} w={5} color={coat} hoof="#2a1f1a" phase={0} speed={speed} />
      <g className="wl-bob" style={{ animationDuration: `${speed / 2}s` }}>
        <ellipse cx="0" cy="-60" rx="38" ry="17" fill={coat} {...O} />
        <ellipse cx="2" cy="-49" rx="24" ry="5" fill="#f1e4cc" />
        <path d="M-36 -66 C-44 -70 -46 -60 -38 -58 Z" fill="#fff" {...O} />
        <path d="M22 -70 L32 -100 L46 -97 L38 -62 Z" fill={coat} {...O} />
        <ellipse cx="52" cy="-100" rx="14" ry="8" fill={coat} {...O} transform="rotate(12 52 -100)" />
        <circle cx="65" cy="-97" r="2.6" fill={INK} />
        <circle cx="50" cy="-103" r="1.8" fill={INK} />
        <path d="M40 -104 C34 -118 42 -120 46 -106 Z" fill={coat} {...O} />
        <path d="M44 -106 C44 -120 52 -118 49 -105 Z" fill={coat} {...O} />
        {male && <path d="M44 -107 C40 -122 34 -126 30 -130 M40 -118 L46 -126 M47 -107 C50 -122 56 -126 60 -130 M52 -120 L48 -128" stroke="#e6d6b4" strokeWidth="3" fill="none" strokeLinecap="round" />}
      </g>
      <Leg x={-18} top={-50} len={50} w={5} color={coat} hoof="#2a1f1a" phase={0} speed={speed} />
      <Leg x={30} top={-50} len={50} w={5} color={coat} hoof="#2a1f1a" phase={1} speed={speed} />
    </g>
  );
}

function Elk({ male, winter, speed }: { male: boolean; winter: boolean; speed: number }) {
  const coat = winter ? "#9a7a5a" : "#b58150";
  const mane = "#5b3a22";
  return (
    <g>
      <Leg x={-34} top={-64} len={64} w={7} color={mane} hoof="#1f1712" phase={1} speed={speed} />
      <Leg x={30} top={-64} len={64} w={7} color={mane} hoof="#1f1712" phase={0} speed={speed} />
      <g className="wl-bob" style={{ animationDuration: `${speed / 2}s` }}>
        <ellipse cx="0" cy="-78" rx="50" ry="22" fill={coat} {...O} />
        <ellipse cx="-38" cy="-78" rx="14" ry="16" fill="#e2cfa6" />
        <path d="M26 -92 L40 -128 L60 -124 L48 -76 Z" fill={mane} {...O} />
        <ellipse cx="66" cy="-128" rx="18" ry="10" fill={mane} {...O} transform="rotate(16 66 -128)" />
        <circle cx="82" cy="-122" r="3" fill={INK} />
        <circle cx="62" cy="-132" r="2" fill="#fff" />
        <circle cx="62" cy="-132" r="1.2" fill={INK} />
        <path d="M54 -136 C48 -150 56 -152 60 -138 Z" fill={mane} {...O} />
        {male && (
          <path
            d="M58 -138 C50 -160 40 -176 26 -190 M50 -158 L60 -172 M42 -170 L50 -186 M34 -180 L38 -196 M62 -138 C70 -160 78 -176 90 -190 M72 -160 L64 -174 M80 -174 L74 -190"
            stroke="#ecdcb8"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </g>
      <Leg x={-24} top={-64} len={64} w={7} color={mane} hoof="#1f1712" phase={0} speed={speed} />
      <Leg x={38} top={-64} len={64} w={7} color={mane} hoof="#1f1712" phase={1} speed={speed} />
    </g>
  );
}

function Moose({ male, speed }: { male: boolean; speed: number }) {
  const coat = "#3d2c22";
  const legs = "#b3a492";
  return (
    <g>
      <Leg x={-36} top={-80} len={80} w={8} color={legs} hoof="#2a1f1a" phase={1} speed={speed} />
      <Leg x={32} top={-80} len={80} w={8} color={legs} hoof="#2a1f1a" phase={0} speed={speed} />
      <g className="wl-bob" style={{ animationDuration: `${speed / 2}s` }}>
        <path d="M-52 -96 C-54 -120 -20 -126 10 -130 C30 -140 46 -132 52 -114 C56 -96 48 -80 20 -78 L-40 -78 C-50 -80 -52 -88 -52 -96 Z" fill={coat} {...O} />
        <path d="M-10 -128 C6 -138 26 -140 40 -130" stroke="#5a4334" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M40 -120 L56 -128 C70 -126 82 -118 88 -104 C92 -94 84 -88 74 -92 L58 -100 Z" fill={coat} {...O} />
        <path d="M86 -100 C90 -96 88 -90 82 -92" fill="none" stroke={INK} strokeWidth="2" />
        <circle cx="62" cy="-118" r="2.4" fill={INK} />
        <path d="M60 -98 C60 -84 66 -80 62 -74" stroke={coat} strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M52 -126 C48 -136 54 -140 58 -130 Z" fill={coat} {...O} />
        {male && (
          <path
            d="M54 -130 C40 -150 22 -154 14 -146 C20 -142 26 -144 30 -140 C24 -150 32 -156 38 -150 C38 -156 46 -158 48 -150 Z M60 -130 C74 -150 92 -154 100 -146 C94 -142 88 -144 84 -140 C90 -150 82 -156 76 -150 C76 -156 68 -158 66 -150 Z"
            fill="#d9c69d"
            {...O}
          />
        )}
      </g>
      <Leg x={-26} top={-80} len={80} w={8} color={legs} hoof="#2a1f1a" phase={0} speed={speed} />
      <Leg x={40} top={-80} len={80} w={8} color={legs} hoof="#2a1f1a" phase={1} speed={speed} />
    </g>
  );
}

function Lion({ speed }: { speed: number }) {
  const coat = "#c99a5b";
  return (
    <g>
      <Leg x={-30} top={-32} len={32} w={8} color={coat} hoof="#8a6236" phase={1} speed={speed} />
      <Leg x={26} top={-32} len={32} w={8} color={coat} hoof="#8a6236" phase={0} speed={speed} />
      <g className="wl-bob" style={{ animationDuration: `${speed / 2}s` }}>
        <path d="M-44 -38 C-70 -40 -86 -26 -80 -8 C-78 -2 -72 -4 -74 -10 C-78 -24 -66 -32 -46 -30" fill={coat} {...O} />
        <path d="M-80 -8 C-78 -2 -72 -4 -74 -10 Z" fill="#3a2a1c" />
        <ellipse cx="-2" cy="-38" rx="46" ry="14" fill={coat} {...O} />
        <ellipse cx="0" cy="-28" rx="30" ry="4" fill="#f1dfbf" />
        <circle cx="52" cy="-44" r="13" fill={coat} {...O} />
        <path d="M44 -54 L46 -62 L52 -56 Z M54 -56 L60 -62 L60 -52 Z" fill={coat} {...O} />
        <ellipse cx="60" cy="-40" rx="7" ry="5" fill="#f1dfbf" />
        <circle cx="64" cy="-42" r="2" fill={INK} />
        <circle cx="54" cy="-47" r="2" fill="#e8d36a" />
        <circle cx="54.5" cy="-47" r="1" fill={INK} />
      </g>
      <Leg x={-22} top={-32} len={32} w={8} color={coat} hoof="#8a6236" phase={0} speed={speed} />
      <Leg x={34} top={-32} len={32} w={8} color={coat} hoof="#8a6236" phase={1} speed={speed} />
    </g>
  );
}

function Bear({ male, speed }: { male: boolean; speed: number }) {
  // "male" doubles as "grizzly": bigger shoulder hump, cinnamon coat.
  const coat = male ? "#6f4a2c" : "#262021";
  const muzzle = male ? "#b58a5e" : "#8d6a4c";
  return (
    <g>
      <Leg x={-34} top={-44} len={44} w={13} color={coat} hoof="#1a1412" phase={1} speed={speed} />
      <Leg x={30} top={-44} len={44} w={13} color={coat} hoof="#1a1412" phase={0} speed={speed} />
      <g className="wl-bob" style={{ animationDuration: `${speed / 2}s` }}>
        <path
          d={`M-52 -54 C-58 -80 -40 -96 -10 -96 C${male ? "10 -112 30 -110 38 -92" : "14 -100 30 -98 38 -86"} C50 -80 54 -64 48 -46 C40 -38 -40 -36 -52 -54 Z`}
          fill={coat}
          {...O}
        />
        <path d="M-40 -84 C-24 -94 0 -96 20 -94" stroke={male ? "#8a6240" : "#3a3234"} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M34 -80 C44 -92 62 -92 70 -80 C78 -76 80 -66 72 -62 C62 -58 46 -60 38 -66 Z" fill={coat} {...O} />
        <ellipse cx="70" cy="-68" rx="10" ry="7" fill={muzzle} {...O} />
        <circle cx="79" cy="-70" r="3.2" fill={INK} />
        <circle cx="56" cy="-80" r="2.2" fill={INK} />
        <circle cx="44" cy="-90" r="6" fill={coat} {...O} />
        <circle cx="44" cy="-90" r="2.6" fill={muzzle} />
      </g>
      <Leg x={-24} top={-44} len={44} w={13} color={coat} hoof="#1a1412" phase={0} speed={speed} />
      <Leg x={38} top={-44} len={44} w={13} color={coat} hoof="#1a1412" phase={1} speed={speed} />
    </g>
  );
}

const STRIDE: Record<Critter, number> = { deer: 0.8, elk: 0.95, moose: 1.15, lion: 1.25, bear: 1.2 };

/** A herd walking across the meadow behind the railing. View box coordinates. */
export function Herd({ passer, winter, width }: { passer: Passer; winter: boolean; width: number }) {
  const from = passer.dir === 1 ? -380 : width + 380;
  const to = passer.dir === 1 ? width + 900 : -900;
  const speed = STRIDE[passer.kind];
  const x = useGlide(from, to, passer.duration);
  return (
    <motion.g style={{ x }}>
      {passer.members.map((m, i) => (
        <g key={i} transform={`translate(${-passer.dir * m.offset} ${passer.ground + m.dy}) scale(${passer.dir * m.scale} ${m.scale})`}>
          <ellipse cx="0" cy="0" rx="46" ry="6" fill="#000" opacity={winter ? 0.12 : 0.18} />
          {passer.kind === "deer" && <Deer male={m.male} winter={winter} speed={speed} />}
          {passer.kind === "elk" && <Elk male={m.male} winter={winter} speed={speed} />}
          {passer.kind === "moose" && <Moose male={m.male} speed={speed} />}
          {passer.kind === "lion" && <Lion speed={speed} />}
          {passer.kind === "bear" && <Bear male={m.male} speed={speed} />}
        </g>
      ))}
    </motion.g>
  );
}

/** A little car driving past the house, seen through the sidelight. */
export function PassingCar({ car, winter }: { car: CarPass; winter: boolean }) {
  const from = car.dir === 1 ? 600 : 980;
  const to = car.dir === 1 ? 980 : 600;
  const x = useGlide(from, to, car.duration);
  return (
    <motion.g style={{ x }}>
      <g transform={`translate(0 516) scale(${car.dir * 1.35} 1.35)`}>
        <path d="M-46 -8 L-40 -22 L-18 -24 L-8 -36 L22 -36 L34 -22 L46 -20 L48 -6 Z" fill={car.color} {...O} strokeWidth="1.6" />
        <path d="M-6 -33 L20 -33 L28 -23 L-14 -23 Z" fill="#bfe3ff" opacity=".85" />
        <circle cx="-26" cy="-6" r="7" fill="#1d2126" />
        <circle cx="28" cy="-6" r="7" fill="#1d2126" />
        <circle cx="46" cy="-15" r="3" fill={winter ? "#fff6c9" : "#fffbe6"} />
        {winter && <path d="M-18 -24 L22 -36 L22 -38 L-10 -38 Z" fill="#fff" />}
      </g>
    </motion.g>
  );
}

/** Headlight glare sweeping across the room as a car goes by. */
export function RoomSweep({ car }: { car: CarPass }) {
  const x = useGlide(car.dir === 1 ? 1100 : -300, car.dir === 1 ? -500 : 1400, car.duration * 0.9, car.duration * 0.25);
  const opacity = useMotionValue(0);
  useEffect(() => {
    const ctl = animate(opacity, [0, 0.9, 0.9, 0], { duration: car.duration * 0.9, delay: car.duration * 0.25 });
    return () => ctl.stop();
  }, [opacity, car.duration]);
  return (
    <motion.g style={{ x, opacity }}>
      <path d="M0 0 L140 0 L420 1000 L180 1000 Z" fill="url(#wl-sweep)" />
    </motion.g>
  );
}

export function WildlifeDefs() {
  return (
    <defs>
      <linearGradient id="wl-sweep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff6d0" stopOpacity="0" />
        <stop offset=".5" stopColor="#fff6d0" stopOpacity=".35" />
        <stop offset="1" stopColor="#fff6d0" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

export const WILDLIFE_CSS = `
@keyframes wl-step { 0%,100% { transform: rotate(-16deg) } 50% { transform: rotate(16deg) } }
@keyframes wl-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }
.wl-leg { transform-box: fill-box; transform-origin: 50% 0; animation: wl-step .9s ease-in-out infinite }
.wl-bob { animation: wl-bob .45s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .wl-leg, .wl-bob { animation: none } }
`;

/* ------------------------------------------------------------------ */
/*  The visiting dog (neighborhood regular)                            */
/* ------------------------------------------------------------------ */
export type Breed = "golden" | "dalmatian" | "husky";

export function VisitorDog({ breed, walking, startled }: { breed: Breed; walking: boolean; startled: boolean }) {
  const pal = {
    golden: { coat: "#e2a64a", dark: "#c1852f", belly: "#f3cf8f" },
    dalmatian: { coat: "#f6f4ef", dark: "#1f1f22", belly: "#ffffff" },
    husky: { coat: "#7e8894", dark: "#4b535c", belly: "#f1f3f5" },
  }[breed];
  const speed = walking ? 0.55 : 0;
  const leg = (x: number, phase: 0 | 1, color: string) => (
    <g className={walking ? "wl-leg" : undefined} style={{ animationDuration: `${speed}s`, animationDelay: phase ? `${-speed / 2}s` : "0s", transformBox: "fill-box", transformOrigin: "50% 0" }}>
      <rect x={x - 5} y={-42} width={10} height={42} rx={5} fill={color} {...O} />
    </g>
  );
  return (
    <svg viewBox="-80 -120 180 128" className="h-full w-full overflow-visible" aria-hidden="true">
      <ellipse cx="6" cy="2" rx="62" ry="7" fill="#000" opacity=".22" />
      {leg(-34, 1, pal.dark)}
      {leg(30, 0, pal.dark)}
      <g className={walking ? "wl-bob" : undefined} style={{ animationDuration: ".28s" }}>
        <path d="M-50 -58 C-66 -64 -74 -80 -70 -92" stroke={pal.coat} strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M-52 -58 C-54 -76 -36 -82 -6 -82 C20 -82 44 -80 50 -64 C54 -48 40 -38 20 -38 L-36 -38 C-50 -40 -52 -48 -52 -58 Z" fill={pal.coat} {...O} />
        <ellipse cx="0" cy="-42" rx="30" ry="6" fill={pal.belly} />
        {breed === "dalmatian" &&
          [
            [-30, -64],
            [-10, -70],
            [12, -60],
            [30, -70],
            [-40, -50],
            [0, -52],
          ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5 + (i % 2)} fill="#1f1f22" />)}
        {breed === "husky" && <path d="M-44 -46 C-20 -40 20 -40 44 -48 L44 -44 C20 -36 -20 -36 -44 -42 Z" fill={pal.belly} />}
        <path d="M40 -70 L52 -96 L70 -92 L58 -62 Z" fill={pal.coat} {...O} />
        <ellipse cx="72" cy="-96" rx="17" ry="13" fill={pal.coat} {...O} />
        <path d="M80 -92 L98 -88 C100 -80 92 -76 84 -80 Z" fill={breed === "husky" ? pal.belly : pal.coat} {...O} />
        <circle cx="97" cy="-88" r="3.4" fill={INK} />
        <circle cx={startled ? 74 : 76} cy="-100" r={startled ? 3.6 : 2.4} fill={INK} />
        {startled && <circle cx="74" cy="-100" r="6" fill="none" stroke={INK} strokeWidth="1.6" />}
        {breed === "husky" ? (
          <path d="M62 -104 L66 -122 L74 -106 Z" fill={pal.dark} {...O} />
        ) : (
          <path d="M62 -104 C52 -100 50 -84 58 -78 C64 -86 66 -96 66 -104 Z" fill={pal.dark} {...O} />
        )}
        {!startled && <path d="M88 -80 C90 -72 96 -72 96 -80" fill="#e05a6a" stroke={INK} strokeWidth="1.4" />}
      </g>
      {leg(-26, 0, pal.coat)}
      {leg(38, 1, pal.coat)}
    </svg>
  );
}
